import { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { eq, and } from "drizzle-orm";
import { getDb, workflows, workflowAssets, workflowShares } from "../db";
import { singleFileUpload } from "../lib/upload";
import { uploadFile, deleteFile, getSignedUrl } from "../lib/storage";
import { randomUUID } from "crypto";

export const workflowAssetsRouter = Router({ mergeParams: true });

type AsyncRoute = (req: Request, res: Response) => Promise<unknown>;

function asyncRoute(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };
}

function assetStorageKey(userId: string, workflowId: string, assetId: string, filename: string): string {
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
  return `workflows/${userId}/${workflowId}/assets/${assetId}${ext}`;
}

async function resolveAccess(
  workflowId: string,
  userId: string,
  userEmail: string | undefined,
  db: ReturnType<typeof getDb>,
): Promise<{ allowed: boolean; canEdit: boolean }> {
  const [wf] = await db
    .select({ id: workflows.id, userId: workflows.userId, isSystem: workflows.isSystem })
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1);

  if (!wf) return { allowed: false, canEdit: false };

  // Owner
  if (wf.userId === userId) return { allowed: true, canEdit: true };

  // Check share
  const normalizedEmail = (userEmail ?? "").trim().toLowerCase();
  if (!normalizedEmail) return { allowed: false, canEdit: false };

  const [share] = await db
    .select({ allowEdit: workflowShares.allowEdit })
    .from(workflowShares)
    .where(
      and(
        eq(workflowShares.workflowId, workflowId),
        eq(workflowShares.sharedWithEmail, normalizedEmail),
      ),
    )
    .limit(1);

  if (!share) return { allowed: false, canEdit: false };
  return { allowed: true, canEdit: share.allowEdit };
}

function serializeAsset(row: typeof workflowAssets.$inferSelect, downloadUrl?: string | null) {
  return {
    id: row.id,
    workflow_id: row.workflowId,
    user_id: row.userId,
    name: row.name,
    type: row.type,
    content: row.content,
    mime_type: row.mimeType,
    size_bytes: row.sizeBytes,
    download_url: downloadUrl ?? null,
    created_at: row.createdAt,
  };
}

// GET /workflows/:workflowId/assets
workflowAssetsRouter.get("/", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { workflowId } = req.params;

  const db = getDb();
  const access = await resolveAccess(workflowId, userId, userEmail, db);
  if (!access.allowed) return void res.status(404).json({ detail: "Workflow not found" });

  const rows = await db
    .select()
    .from(workflowAssets)
    .where(eq(workflowAssets.workflowId, workflowId));

  const serialized = await Promise.all(
    rows.map(async (row) => {
      let downloadUrl: string | null = null;
      if (row.type === "image" && row.storagePath) {
        downloadUrl = await getSignedUrl(row.storagePath, 3600).catch(() => null);
      }
      return serializeAsset(row, downloadUrl);
    }),
  );

  res.json(serialized);
}));

// POST /workflows/:workflowId/assets — create HTML or text asset (JSON body)
workflowAssetsRouter.post("/", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { workflowId } = req.params;

  const db = getDb();
  const access = await resolveAccess(workflowId, userId, userEmail, db);
  if (!access.allowed || !access.canEdit) {
    return void res.status(403).json({ detail: "Not authorized to edit this workflow" });
  }

  const { name, type, content } = req.body as { name?: string; type?: string; content?: string };
  if (!name?.trim()) return void res.status(400).json({ detail: "name is required" });
  if (!type || !["html", "text"].includes(type)) {
    return void res.status(400).json({ detail: "type must be 'html' or 'text'" });
  }

  const [inserted] = await db
    .insert(workflowAssets)
    .values({
      workflowId,
      userId,
      name: name.trim(),
      type,
      content: content ?? "",
      mimeType: type === "html" ? "text/html" : "text/plain",
      sizeBytes: content ? Buffer.byteLength(content, "utf8") : 0,
    })
    .returning();

  res.status(201).json(serializeAsset(inserted));
}));

// POST /workflows/:workflowId/assets/upload — upload image asset (multipart)
workflowAssetsRouter.post(
  "/upload",
  requireAuth,
  singleFileUpload("file"),
  asyncRoute(async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string | undefined;
    const { workflowId } = req.params;

    const db = getDb();
    const access = await resolveAccess(workflowId, userId, userEmail, db);
    if (!access.allowed || !access.canEdit) {
      return void res.status(403).json({ detail: "Not authorized to edit this workflow" });
    }

    const file = req.file;
    if (!file) return void res.status(400).json({ detail: "file is required" });

    const { name } = req.body as { name?: string };
    const assetName = name?.trim() || file.originalname;
    const assetId = randomUUID();
    const storageKey = assetStorageKey(userId, workflowId, assetId, file.originalname);

    await uploadFile(storageKey, file.buffer.buffer as ArrayBuffer, file.mimetype);

    const [inserted] = await db
      .insert(workflowAssets)
      .values({
        id: assetId,
        workflowId,
        userId,
        name: assetName,
        type: "image",
        storagePath: storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      })
      .returning();

    const downloadUrl = await getSignedUrl(storageKey, 3600).catch(() => null);
    res.status(201).json(serializeAsset(inserted, downloadUrl));
  }),
);

// PUT /workflows/:workflowId/assets/:assetId — update name or content
workflowAssetsRouter.put("/:assetId", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { workflowId, assetId } = req.params;

  const db = getDb();
  const access = await resolveAccess(workflowId, userId, userEmail, db);
  if (!access.allowed || !access.canEdit) {
    return void res.status(403).json({ detail: "Not authorized to edit this workflow" });
  }

  const [existing] = await db
    .select()
    .from(workflowAssets)
    .where(and(eq(workflowAssets.id, assetId), eq(workflowAssets.workflowId, workflowId)))
    .limit(1);

  if (!existing) return void res.status(404).json({ detail: "Asset not found" });

  const { name, content } = req.body as { name?: string; content?: string };
  const updateData: Partial<typeof workflowAssets.$inferInsert> = {};
  if (name?.trim()) updateData.name = name.trim();
  if (content !== undefined && existing.type !== "image") {
    updateData.content = content;
    updateData.sizeBytes = Buffer.byteLength(content, "utf8");
  }

  if (Object.keys(updateData).length === 0) {
    return void res.json(serializeAsset(existing));
  }

  const [updated] = await db
    .update(workflowAssets)
    .set(updateData)
    .where(eq(workflowAssets.id, assetId))
    .returning();

  res.json(serializeAsset(updated));
}));

// GET /workflows/:workflowId/assets/:assetId/download — signed URL for image
workflowAssetsRouter.get("/:assetId/download", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { workflowId, assetId } = req.params;

  const db = getDb();
  const access = await resolveAccess(workflowId, userId, userEmail, db);
  if (!access.allowed) return void res.status(404).json({ detail: "Workflow not found" });

  const [asset] = await db
    .select()
    .from(workflowAssets)
    .where(and(eq(workflowAssets.id, assetId), eq(workflowAssets.workflowId, workflowId)))
    .limit(1);

  if (!asset) return void res.status(404).json({ detail: "Asset not found" });
  if (!asset.storagePath) return void res.status(400).json({ detail: "Asset has no file" });

  const url = await getSignedUrl(asset.storagePath, 3600, asset.name);
  if (!url) return void res.status(503).json({ detail: "Storage not available" });

  res.json({ url });
}));

// DELETE /workflows/:workflowId/assets/:assetId
workflowAssetsRouter.delete("/:assetId", requireAuth, asyncRoute(async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { workflowId, assetId } = req.params;

  const db = getDb();
  const access = await resolveAccess(workflowId, userId, userEmail, db);
  if (!access.allowed || !access.canEdit) {
    return void res.status(403).json({ detail: "Not authorized to edit this workflow" });
  }

  const [asset] = await db
    .select()
    .from(workflowAssets)
    .where(and(eq(workflowAssets.id, assetId), eq(workflowAssets.workflowId, workflowId)))
    .limit(1);

  if (!asset) return void res.status(404).json({ detail: "Asset not found" });

  if (asset.storagePath) {
    await deleteFile(asset.storagePath).catch(() => {});
  }

  await db.delete(workflowAssets).where(eq(workflowAssets.id, assetId));

  res.status(204).send();
}));

workflowAssetsRouter.use(
  (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    console.error("[workflow-assets] unhandled error", err);
    res.status(500).json({ detail: "Failed to process asset request" });
  },
);
