import { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { getDb, workflows, hiddenWorkflows, workflowShares, userProfiles, users } from "../db";

export const workflowsRouter = Router();

type Db = ReturnType<typeof getDb>;

type WorkflowRecord = {
  id: string;
  user_id: string | null;
  is_system: boolean;
  [key: string]: unknown;
};

type WorkflowAccess =
  | {
      workflow: WorkflowRecord;
      allowEdit: boolean;
      isOwner: boolean;
    }
  | null;

type AsyncRoute = (req: Request, res: Response) => Promise<unknown>;

function asyncRoute(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };
}

function serializeWorkflow(row: typeof workflows.$inferSelect): Record<string, unknown> {
  return {
    id: row.id,
    user_id: row.userId,
    title: row.title,
    type: row.type,
    prompt_md: row.promptMd,
    columns_config: row.columnsConfig,
    practice: row.practice,
    is_system: row.isSystem,
    created_at: row.createdAt,
  };
}

function withWorkflowAccess<T extends Record<string, unknown>>(
  workflow: T,
  access: { allowEdit: boolean; isOwner: boolean; sharedByName?: string | null },
) {
  return {
    ...workflow,
    allow_edit: access.allowEdit,
    is_owner: access.isOwner,
    shared_by_name: access.sharedByName ?? null,
  };
}

async function loadSharerNames(
  db: Db,
  sharerIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(sharerIds.filter(Boolean))];
  const names = new Map<string, string>();
  if (uniqueIds.length === 0) return names;

  try {
    const profiles = await db
      .select({ userId: userProfiles.userId, displayName: userProfiles.displayName })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, uniqueIds));

    for (const profile of profiles) {
      if (profile.userId && profile.displayName) {
        names.set(profile.userId, profile.displayName);
      }
    }
  } catch (err) {
    console.warn("[workflows] failed to load sharer profiles", err);
  }

  const missingIds = uniqueIds.filter((id) => !names.has(id));
  if (missingIds.length > 0) {
    try {
      const userRows = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.id, missingIds));

      for (const u of userRows) {
        if (u.id && u.email) {
          names.set(u.id, u.email);
        }
      }
    } catch (err) {
      console.warn("[workflows] failed to load sharer emails", err);
    }
  }

  return names;
}

async function resolveWorkflowAccess(
  workflowId: string,
  userId: string,
  userEmail: string | null | undefined,
  db: Db,
): Promise<WorkflowAccess> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1);

  if (!workflow) return null;
  const workflowRecord = serializeWorkflow(workflow) as WorkflowRecord;

  if (workflowRecord.user_id === userId) {
    return { workflow: workflowRecord, allowEdit: true, isOwner: true };
  }

  const normalizedUserEmail = (userEmail ?? "").trim().toLowerCase();
  if (!normalizedUserEmail) return null;

  const [share] = await db
    .select({ allowEdit: workflowShares.allowEdit })
    .from(workflowShares)
    .where(
      and(
        eq(workflowShares.workflowId, workflowId),
        eq(workflowShares.sharedWithEmail, normalizedUserEmail),
      ),
    )
    .limit(1);

  if (!share) return null;

  return { workflow: workflowRecord, allowEdit: share.allowEdit, isOwner: false };
}

// GET /workflows
workflowsRouter.get("/", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  const { type } = req.query as { type?: string };
  const db = getDb();

  const conditions = [eq(workflows.userId, userId), eq(workflows.isSystem, false)];
  if (type) conditions.push(eq(workflows.type, type));

  const own = await db
    .select()
    .from(workflows)
    .where(and(...conditions))
    .orderBy(desc(workflows.createdAt));

  const normalizedUserEmail = userEmail.trim().toLowerCase();
  const shares = await db
    .select({
      workflowId: workflowShares.workflowId,
      sharedByUserId: workflowShares.sharedByUserId,
      allowEdit: workflowShares.allowEdit,
    })
    .from(workflowShares)
    .where(eq(workflowShares.sharedWithEmail, normalizedUserEmail));

  let sharedWorkflows: Record<string, unknown>[] = [];
  if (shares.length > 0) {
    const sharedIds = shares.map((s) => s.workflowId);
    const sharedConditions = [inArray(workflows.id, sharedIds)];
    if (type) sharedConditions.push(eq(workflows.type, type));
    const wfs = await db
      .select()
      .from(workflows)
      .where(and(...sharedConditions));

    if (wfs.length > 0) {
      const sharerIds = [...new Set(shares.map((s) => s.sharedByUserId).filter(Boolean))];
      const sharerNames = await loadSharerNames(db, sharerIds);

      sharedWorkflows = wfs.map((wf) => {
        const share = shares.find((s) => s.workflowId === wf.id);
        const sharerId = share?.sharedByUserId;
        const shared_by_name = sharerId ? sharerNames.get(sharerId) ?? null : null;
        return withWorkflowAccess(serializeWorkflow(wf), {
          allowEdit: !!share?.allowEdit,
          isOwner: false,
          sharedByName: shared_by_name,
        });
      });
    }
  }

  const ownWithFlag = own.map((wf) =>
    withWorkflowAccess(serializeWorkflow(wf), { allowEdit: true, isOwner: true }),
  );
  res.json([...ownWithFlag, ...sharedWorkflows]);
}));

// POST /workflows
workflowsRouter.post("/", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const { title, type, prompt_md, columns_config, practice } = req.body as {
    title: string;
    type: string;
    prompt_md?: string;
    columns_config?: unknown;
    practice?: string | null;
  };
  if (!title?.trim())
    return void res.status(400).json({ detail: "title is required" });
  if (!["assistant", "tabular"].includes(type))
    return void res
      .status(400)
      .json({ detail: "type must be 'assistant' or 'tabular'" });

  const db = getDb();
  const [data] = await db
    .insert(workflows)
    .values({
      userId,
      title: title.trim(),
      type,
      promptMd: prompt_md ?? null,
      columnsConfig: columns_config ?? null,
      practice: practice ?? null,
      isSystem: false,
    })
    .returning();

  res.status(201).json(serializeWorkflow(data));
}));

async function handleWorkflowUpdate(req: Request, res: Response) {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { workflowId } = req.params;
  const updates: Partial<typeof workflows.$inferInsert> = {};
  if (req.body.title != null) updates.title = req.body.title;
  if (req.body.prompt_md != null) updates.promptMd = req.body.prompt_md;
  if (req.body.columns_config != null)
    updates.columnsConfig = req.body.columns_config;
  if ("practice" in req.body) updates.practice = req.body.practice ?? null;

  const db = getDb();
  const access = await resolveWorkflowAccess(workflowId, userId, userEmail, db);
  if (!access || access.workflow.is_system || !access.allowEdit) {
    return void res
      .status(404)
      .json({ detail: "Workflow not found or not editable" });
  }

  const [data] = await db
    .update(workflows)
    .set(updates)
    .where(and(eq(workflows.id, workflowId), eq(workflows.isSystem, false)))
    .returning();

  if (!data)
    return void res
      .status(404)
      .json({ detail: "Workflow not found or not editable" });

  res.json(
    withWorkflowAccess(serializeWorkflow(data), {
      allowEdit: access.allowEdit,
      isOwner: access.isOwner,
    }),
  );
}

// PUT /workflows/:workflowId
workflowsRouter.put("/:workflowId", requireAuth, asyncRoute(handleWorkflowUpdate));

// PATCH /workflows/:workflowId
workflowsRouter.patch("/:workflowId", requireAuth, asyncRoute(handleWorkflowUpdate));

// DELETE /workflows/:workflowId
workflowsRouter.delete("/:workflowId", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const { workflowId } = req.params;
  const db = getDb();
  await db
    .delete(workflows)
    .where(
      and(
        eq(workflows.id, workflowId),
        eq(workflows.userId, userId),
        eq(workflows.isSystem, false),
      ),
    );
  res.status(204).send();
}));

// GET /workflows/hidden
workflowsRouter.get("/hidden", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const db = getDb();
  const data = await db
    .select({ workflowId: hiddenWorkflows.workflowId })
    .from(hiddenWorkflows)
    .where(eq(hiddenWorkflows.userId, userId));
  res.json(data.map((r) => r.workflowId));
}));

// POST /workflows/hidden
workflowsRouter.post("/hidden", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const { workflow_id } = req.body as { workflow_id: string };
  if (!workflow_id?.trim())
    return void res.status(400).json({ detail: "workflow_id is required" });
  const db = getDb();
  await db
    .insert(hiddenWorkflows)
    .values({ userId, workflowId: workflow_id })
    .onConflictDoNothing({ target: [hiddenWorkflows.userId, hiddenWorkflows.workflowId] });
  res.status(204).send();
}));

// DELETE /workflows/hidden/:workflowId
workflowsRouter.delete("/hidden/:workflowId", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const { workflowId } = req.params;
  const db = getDb();
  await db
    .delete(hiddenWorkflows)
    .where(
      and(
        eq(hiddenWorkflows.userId, userId),
        eq(hiddenWorkflows.workflowId, workflowId),
      ),
    );
  res.status(204).send();
}));

// GET /workflows/:workflowId
workflowsRouter.get("/:workflowId", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { workflowId } = req.params;
  const db = getDb();
  const access = await resolveWorkflowAccess(workflowId, userId, userEmail, db);
  if (!access)
    return void res.status(404).json({ detail: "Workflow not found" });
  res.json(
    withWorkflowAccess(access.workflow, {
      allowEdit: access.allowEdit,
      isOwner: access.isOwner,
    }),
  );
}));

// GET /workflows/:workflowId/shares
workflowsRouter.get("/:workflowId/shares", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const { workflowId } = req.params;
  const db = getDb();

  const [wf] = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(
      and(
        eq(workflows.id, workflowId),
        eq(workflows.userId, userId),
        eq(workflows.isSystem, false),
      ),
    )
    .limit(1);

  if (!wf) return void res.status(404).json({ detail: "Workflow not found or not editable" });

  const shares = await db
    .select({
      id: workflowShares.id,
      shared_with_email: workflowShares.sharedWithEmail,
      allow_edit: workflowShares.allowEdit,
      created_at: workflowShares.createdAt,
    })
    .from(workflowShares)
    .where(eq(workflowShares.workflowId, workflowId))
    .orderBy(workflowShares.createdAt);

  res.json(shares);
}));

// DELETE /workflows/:workflowId/shares/:shareId
workflowsRouter.delete("/:workflowId/shares/:shareId", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const { workflowId, shareId } = req.params;
  const db = getDb();

  const [wf] = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(
      and(
        eq(workflows.id, workflowId),
        eq(workflows.userId, userId),
      ),
    )
    .limit(1);

  if (!wf) return void res.status(404).json({ detail: "Workflow not found" });

  await db
    .delete(workflowShares)
    .where(
      and(
        eq(workflowShares.id, shareId),
        eq(workflowShares.workflowId, workflowId),
      ),
    );

  res.status(204).send();
}));

// POST /workflows/:workflowId/share
workflowsRouter.post("/:workflowId/share", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { workflowId } = req.params;
  const { emails, allow_edit } = req.body as { emails: string[]; allow_edit: boolean };

  if (!emails?.length) return void res.status(400).json({ detail: "emails is required" });
  const normalizedEmails = [
    ...new Set(
      emails
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (normalizedEmails.length === 0) {
    return void res.status(400).json({ detail: "emails is required" });
  }
  const normalizedUserEmail = userEmail?.trim().toLowerCase();
  if (normalizedUserEmail && normalizedEmails.includes(normalizedUserEmail)) {
    return void res
      .status(400)
      .json({ detail: "You cannot share a workflow with yourself." });
  }

  const db = getDb();
  // Verify ownership
  const [wf] = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(
      and(
        eq(workflows.id, workflowId),
        eq(workflows.userId, userId),
        eq(workflows.isSystem, false),
      ),
    )
    .limit(1);

  if (!wf) return void res.status(404).json({ detail: "Workflow not found or not editable" });

  const rows = normalizedEmails.map((email: string) => ({
    workflowId,
    sharedByUserId: userId,
    sharedWithEmail: email,
    allowEdit: allow_edit ?? false,
  }));

  await db
    .insert(workflowShares)
    .values(rows)
    .onConflictDoUpdate({
      target: [workflowShares.workflowId, workflowShares.sharedWithEmail],
      set: {
        allowEdit: sql`excluded.allow_edit`,
        sharedByUserId: sql`excluded.shared_by_user_id`,
      },
    });

  res.status(204).send();
}));

workflowsRouter.use(
  (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    console.error("[workflows] unhandled route error", err);
    res.status(500).json({ detail: "Failed to process workflow request" });
  },
);
