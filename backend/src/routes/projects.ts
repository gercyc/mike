import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { eq, ne, desc, asc, sql, and } from "drizzle-orm";
import {
  getDb,
  projects,
  documents,
  documentVersions,
  chats,
  tabularReviews,
  projectSubfolders,
} from "../db";
import {
  attachActiveVersionPaths,
  attachLatestVersionNumbers,
} from "../lib/documentVersions";
import { downloadFile, uploadFile, storageKey } from "../lib/storage";
import { docxToPdf, convertedPdfKey } from "../lib/convert";
import { checkProjectAccess } from "../lib/access";
import { singleFileUpload } from "../lib/upload";

export const projectsRouter = Router();
const ALLOWED_TYPES = new Set(["pdf", "docx", "doc", "txt", "md"]);

function normalizeDocumentFilename(nextName: unknown, currentName: string) {
  if (typeof nextName !== "string") return null;
  const trimmed = nextName.trim().slice(0, 200);
  if (!trimmed) return null;
  if (/\.[a-z0-9]{1,6}$/i.test(trimmed)) return trimmed;
  const ext = currentName.match(/\.[a-z0-9]{1,6}$/i)?.[0] ?? "";
  return `${trimmed}${ext}`;
}

type DrizzleDoc = {
  id: string;
  currentVersionId?: string | null;
  latestVersionNumber?: number | null;
  storagePath?: string | null;
  pdfStoragePath?: string | null;
  activeVersionNumber?: number | null;
  [k: string]: unknown;
};

function serializeProject(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  if ("userId" in out) { out.user_id = out.userId; delete out.userId; }
  if ("createdAt" in out) { out.created_at = out.createdAt; delete out.createdAt; }
  if ("updatedAt" in out) { out.updated_at = out.updatedAt; delete out.updatedAt; }
  if ("cmNumber" in out) { out.cm_number = out.cmNumber; delete out.cmNumber; }
  if ("sharedWith" in out) { out.shared_with = out.sharedWith; delete out.sharedWith; }
  return out;
}

function serializeDoc(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  if ("userId" in out) { out.user_id = out.userId; delete out.userId; }
  if ("projectId" in out) { out.project_id = out.projectId; delete out.projectId; }
  if ("folderId" in out) { out.folder_id = out.folderId; delete out.folderId; }
  if ("fileType" in out) { out.file_type = out.fileType; delete out.fileType; }
  if ("sizeBytes" in out) { out.size_bytes = out.sizeBytes; delete out.sizeBytes; }
  if ("pageCount" in out) { out.page_count = out.pageCount; delete out.pageCount; }
  if ("structureTree" in out) { out.structure_tree = out.structureTree; delete out.structureTree; }
  if ("currentVersionId" in out) { out.current_version_id = out.currentVersionId; delete out.currentVersionId; }
  if ("createdAt" in out) { out.created_at = out.createdAt; delete out.createdAt; }
  if ("updatedAt" in out) { out.updated_at = out.updatedAt; delete out.updatedAt; }
  if ("storagePath" in out) { out.storage_path = out.storagePath; delete out.storagePath; }
  if ("pdfStoragePath" in out) { out.pdf_storage_path = out.pdfStoragePath; delete out.pdfStoragePath; }
  if ("latestVersionNumber" in out) { out.latest_version_number = out.latestVersionNumber; delete out.latestVersionNumber; }
  if ("activeVersionNumber" in out) { out.active_version_number = out.activeVersionNumber; delete out.activeVersionNumber; }
  return out;
}

function serializeFolder(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  if ("projectId" in out) { out.project_id = out.projectId; delete out.projectId; }
  if ("userId" in out) { out.user_id = out.userId; delete out.userId; }
  if ("parentFolderId" in out) { out.parent_folder_id = out.parentFolderId; delete out.parentFolderId; }
  if ("createdAt" in out) { out.created_at = out.createdAt; delete out.createdAt; }
  if ("updatedAt" in out) { out.updated_at = out.updatedAt; delete out.updatedAt; }
  return out;
}

// GET /projects
projectsRouter.get("/", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  const db = getDb();

  const ownRows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt));

  let sharedRows: typeof ownRows = [];
  if (userEmail) {
    sharedRows = await db
      .select()
      .from(projects)
      .where(
        sql`${projects.userId} != ${userId} AND ${projects.sharedWith} @> ${JSON.stringify([userEmail.toLowerCase()])}::jsonb`,
      )
      .orderBy(desc(projects.createdAt));
  }

  const allProjects = [...ownRows, ...sharedRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const result = await Promise.all(
    allProjects.map(async (p) => {
      const [docCount, chatCount, reviewCount] = await Promise.all([
        db.select({ id: documents.id }).from(documents).where(eq(documents.projectId, p.id)),
        db.select({ id: chats.id }).from(chats).where(eq(chats.projectId, p.id)),
        db.select({ id: tabularReviews.id }).from(tabularReviews).where(eq(tabularReviews.projectId, p.id)),
      ]);
      return {
        ...serializeProject(p as unknown as Record<string, unknown>),
        is_owner: p.userId === userId,
        document_count: docCount.length,
        chat_count: chatCount.length,
        review_count: reviewCount.length,
      };
    }),
  );
  res.json(result);
});

// POST /projects
projectsRouter.post("/", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { name, cm_number, shared_with } = req.body as {
    name: string;
    cm_number?: string;
    shared_with?: string[];
  };
  if (!name?.trim())
    return void res.status(400).json({ detail: "name is required" });

  const normalizedUserEmail = userEmail?.trim().toLowerCase();
  const cleanedSharedWith: string[] = [];
  const seenSharedEmails = new Set<string>();
  if (Array.isArray(shared_with)) {
    for (const raw of shared_with) {
      if (typeof raw !== "string") continue;
      const e = raw.trim().toLowerCase();
      if (!e || seenSharedEmails.has(e)) continue;
      if (normalizedUserEmail && e === normalizedUserEmail) {
        return void res
          .status(400)
          .json({ detail: "You cannot share a project with yourself." });
      }
      seenSharedEmails.add(e);
      cleanedSharedWith.push(e);
    }
  }

  const [row] = await getDb()
    .insert(projects)
    .values({
      userId,
      name: name.trim(),
      cmNumber: cm_number ?? null,
      sharedWith: cleanedSharedWith,
    })
    .returning();

  if (!row) return void res.status(500).json({ detail: "Failed to create project" });
  res.status(201).json({ ...serializeProject(row as unknown as Record<string, unknown>), documents: [] });
});

// GET /projects/:projectId
projectsRouter.get("/:projectId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  const { projectId } = req.params;

  const access = await checkProjectAccess(projectId, userId, userEmail);
  if (!access.ok)
    return void res.status(404).json({ detail: "Project not found" });

  const db = getDb();
  const [docsRows, folderRows] = await Promise.all([
    db.select().from(documents).where(eq(documents.projectId, projectId)).orderBy(asc(documents.createdAt)),
    db.select().from(projectSubfolders).where(eq(projectSubfolders.projectId, projectId)).orderBy(asc(projectSubfolders.createdAt)),
  ]);

  const docsTyped = docsRows as unknown as DrizzleDoc[];
  await attachLatestVersionNumbers(docsTyped);
  await attachActiveVersionPaths(docsTyped);

  res.json({
    ...serializeProject(access.project as unknown as Record<string, unknown>),
    is_owner: access.isOwner,
    documents: docsTyped.map((d) => serializeDoc(d as unknown as Record<string, unknown>)),
    folders: folderRows.map((f) => serializeFolder(f as unknown as Record<string, unknown>)),
  });
});

// GET /projects/:projectId/people
projectsRouter.get("/:projectId/people", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId } = req.params;

  const access = await checkProjectAccess(projectId, userId, userEmail);
  if (!access.ok)
    return void res.status(404).json({ detail: "Project not found" });

  const p = access.project;
  const sharedWith = (Array.isArray(p.sharedWith) ? (p.sharedWith as string[]) : []).map((e) => e.toLowerCase());

  // Resolve display names from user_profiles by email lookup
  const { userProfiles: profilesTable, users: usersTable } = await import("../db");
  const db = getDb();

  // Owner info
  const [ownerProfile] = await db
    .select({ displayName: profilesTable.displayName })
    .from(profilesTable)
    .where(eq(profilesTable.userId, p.userId))
    .limit(1);

  // For shared members, look up users by email then their profiles
  const memberDetails = await Promise.all(
    sharedWith.map(async (email) => {
      const [user] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);
      if (!user) return { email, display_name: null };
      const [profile] = await db
        .select({ displayName: profilesTable.displayName })
        .from(profilesTable)
        .where(eq(profilesTable.userId, user.id))
        .limit(1);
      return { email, display_name: profile?.displayName ?? null };
    }),
  );

  // Owner email from users table
  const [ownerUser] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, p.userId))
    .limit(1);

  res.json({
    owner: {
      user_id: p.userId,
      email: ownerUser?.email ?? null,
      display_name: ownerProfile?.displayName ?? null,
    },
    members: memberDetails,
  });
});

// PATCH /projects/:projectId
projectsRouter.patch("/:projectId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId } = req.params;

  const updates: Partial<typeof projects.$inferInsert> = {};
  if (req.body.name != null) updates.name = req.body.name;
  if (req.body.cm_number != null) updates.cmNumber = req.body.cm_number;
  if (Array.isArray(req.body.shared_with)) {
    const normalizedUserEmail = userEmail?.trim().toLowerCase();
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of req.body.shared_with) {
      if (typeof raw !== "string") continue;
      const e = raw.trim().toLowerCase();
      if (!e || seen.has(e)) continue;
      if (normalizedUserEmail && e === normalizedUserEmail) {
        return void res
          .status(400)
          .json({ detail: "You cannot share a project with yourself." });
      }
      seen.add(e);
      cleaned.push(e);
    }
    updates.sharedWith = cleaned;
  }

  const db = getDb();
  const [updated] = await db
    .update(projects)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning();

  if (!updated)
    return void res.status(404).json({ detail: "Project not found" });

  const [docsRows, folderRows] = await Promise.all([
    db.select().from(documents).where(eq(documents.projectId, projectId)).orderBy(asc(documents.createdAt)),
    db.select().from(projectSubfolders).where(eq(projectSubfolders.projectId, projectId)).orderBy(asc(projectSubfolders.createdAt)),
  ]);
  const docsTyped = docsRows as unknown as DrizzleDoc[];
  await attachActiveVersionPaths(docsTyped);

  res.json({
    ...serializeProject(updated as unknown as Record<string, unknown>),
    documents: docsTyped.map((d) => serializeDoc(d as unknown as Record<string, unknown>)),
    folders: folderRows.map((f) => serializeFolder(f as unknown as Record<string, unknown>)),
  });
});

// DELETE /projects/:projectId
projectsRouter.delete("/:projectId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const { projectId } = req.params;
  await getDb()
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  res.status(204).send();
});

// GET /projects/:projectId/documents
projectsRouter.get("/:projectId/documents", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId } = req.params;

  const access = await checkProjectAccess(projectId, userId, userEmail);
  if (!access.ok)
    return void res.status(404).json({ detail: "Project not found" });

  const db = getDb();
  const docsRows = await db
    .select()
    .from(documents)
    .where(eq(documents.projectId, projectId))
    .orderBy(asc(documents.createdAt));

  const docsTyped = docsRows as unknown as DrizzleDoc[];
  await attachActiveVersionPaths(docsTyped);
  res.json(docsTyped.map((d) => serializeDoc(d as unknown as Record<string, unknown>)));
});

// POST /projects/:projectId/documents/:documentId — assign or copy existing doc into project
projectsRouter.post(
  "/:projectId/documents/:documentId",
  requireAuth,
  async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string | undefined;
    const { projectId, documentId } = req.params;

    const access = await checkProjectAccess(projectId, userId, userEmail);
    if (!access.ok)
      return void res.status(404).json({ detail: "Project not found" });

    const db = getDb();
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .limit(1);
    if (!doc)
      return void res.status(404).json({ detail: "Document not found" });

    if (doc.projectId === projectId)
      return void res.json(serializeDoc(doc as unknown as Record<string, unknown>));

    if (doc.projectId === null) {
      const [updated] = await db
        .update(documents)
        .set({ projectId, updatedAt: new Date() })
        .where(eq(documents.id, documentId))
        .returning();
      if (!updated)
        return void res.status(500).json({ detail: "Failed to update document" });
      return void res.json(serializeDoc(updated as unknown as Record<string, unknown>));
    } else {
      const [copy] = await db
        .insert(documents)
        .values({
          projectId,
          userId,
          filename: doc.filename,
          fileType: doc.fileType,
          sizeBytes: doc.sizeBytes,
          pageCount: doc.pageCount,
          structureTree: doc.structureTree,
          status: doc.status ?? "pending",
        })
        .returning();
      if (!copy)
        return void res.status(500).json({ detail: "Failed to copy document" });

      let copyVersionRowId: string | null = null;
      if (doc.currentVersionId) {
        const [srcV] = await db
          .select()
          .from(documentVersions)
          .where(eq(documentVersions.id, doc.currentVersionId))
          .limit(1);
        if (srcV?.storagePath) {
          const srcBytes = await downloadFile(srcV.storagePath);
          if (!srcBytes)
            return void res.status(500).json({ detail: "Failed to read source document bytes" });

          const newKey = storageKey(userId, copy.id, doc.filename);
          const contentType =
            doc.fileType === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          await uploadFile(newKey, srcBytes, contentType);

          let newPdfPath: string | null = null;
          if (srcV.pdfStoragePath) {
            if (srcV.pdfStoragePath === srcV.storagePath) {
              newPdfPath = newKey;
            } else {
              const pdfBytes = await downloadFile(srcV.pdfStoragePath);
              if (pdfBytes) {
                const newPdfKey = convertedPdfKey(userId, copy.id);
                await uploadFile(newPdfKey, pdfBytes, "application/pdf");
                newPdfPath = newPdfKey;
              }
            }
          }

          const [newV] = await db
            .insert(documentVersions)
            .values({
              documentId: copy.id,
              storagePath: newKey,
              pdfStoragePath: newPdfPath,
              source: srcV.source ?? "upload",
              versionNumber: srcV.versionNumber ?? 1,
              displayName: srcV.displayName ?? doc.filename,
            })
            .returning({ id: documentVersions.id });
          copyVersionRowId = newV?.id ?? null;
          if (copyVersionRowId) {
            await db
              .update(documents)
              .set({ currentVersionId: copyVersionRowId })
              .where(eq(documents.id, copy.id));
          }
        }
      }
      return void res.status(201).json(serializeDoc(copy as unknown as Record<string, unknown>));
    }
  },
);

// PATCH /projects/:projectId/documents/:documentId — rename a project document
projectsRouter.patch("/:projectId/documents/:documentId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId, documentId } = req.params;

  const access = await checkProjectAccess(projectId, userId, userEmail);
  if (!access.ok)
    return void res.status(404).json({ detail: "Project not found" });

  const db = getDb();
  const [doc] = await db
    .select({ id: documents.id, filename: documents.filename, currentVersionId: documents.currentVersionId })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.projectId, projectId)))
    .limit(1);
  if (!doc)
    return void res.status(404).json({ detail: "Document not found" });

  const filename = normalizeDocumentFilename(req.body?.filename, doc.filename);
  if (!filename)
    return void res.status(400).json({ detail: "filename is required" });

  const [updated] = await db
    .update(documents)
    .set({ filename, updatedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.projectId, projectId)))
    .returning();
  if (!updated)
    return void res.status(404).json({ detail: "Document not found" });

  if (doc.currentVersionId) {
    await db
      .update(documentVersions)
      .set({ displayName: filename })
      .where(and(eq(documentVersions.id, doc.currentVersionId), eq(documentVersions.documentId, documentId)));
  }

  res.json(serializeDoc(updated as unknown as Record<string, unknown>));
});

// POST /projects/:projectId/documents — upload
projectsRouter.post(
  "/:projectId/documents",
  requireAuth,
  singleFileUpload("file"),
  async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string | undefined;
    const { projectId } = req.params;

    const access = await checkProjectAccess(projectId, userId, userEmail);
    if (!access.ok)
      return void res.status(404).json({ detail: "Project not found" });

    await handleDocumentUpload(req, res, userId, projectId);
  },
);

// GET /projects/:projectId/chats
projectsRouter.get("/:projectId/chats", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId } = req.params;

  const access = await checkProjectAccess(projectId, userId, userEmail);
  if (!access.ok)
    return void res.status(404).json({ detail: "Project not found" });

  const rows = await getDb()
    .select()
    .from(chats)
    .where(eq(chats.projectId, projectId))
    .orderBy(desc(chats.createdAt));

  res.json(rows.map((r) => {
    const out: Record<string, unknown> = { ...r };
    if ("userId" in out) { out.user_id = out.userId; delete out.userId; }
    if ("projectId" in out) { out.project_id = out.projectId; delete out.projectId; }
    if ("createdAt" in out) { out.created_at = out.createdAt; delete out.createdAt; }
    return out;
  }));
});

// ── Folder routes ─────────────────────────────────────────────────────────────

// POST /projects/:projectId/folders
projectsRouter.post("/:projectId/folders", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId } = req.params;
  const { name, parent_folder_id } = req.body as { name: string; parent_folder_id?: string | null };
  if (!name?.trim()) return void res.status(400).json({ detail: "name is required" });

  const access = await checkProjectAccess(projectId, userId, userEmail);
  if (!access.ok) return void res.status(404).json({ detail: "Project not found" });

  const db = getDb();
  if (parent_folder_id) {
    const parent = await loadProjectFolder(projectId, parent_folder_id);
    if (!parent) return void res.status(404).json({ detail: "Parent folder not found" });
  }

  const [row] = await db
    .insert(projectSubfolders)
    .values({
      projectId,
      userId,
      name: name.trim(),
      parentFolderId: parent_folder_id ?? null,
    })
    .returning();
  if (!row) return void res.status(500).json({ detail: "Failed to create folder" });
  res.status(201).json(serializeFolder(row as unknown as Record<string, unknown>));
});

// PATCH /projects/:projectId/folders/:folderId
projectsRouter.patch("/:projectId/folders/:folderId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId, folderId } = req.params;
  const body = req.body as { name?: string; parent_folder_id?: string | null };

  const access = await checkProjectAccess(projectId, userId, userEmail);
  if (!access.ok) return void res.status(404).json({ detail: "Project not found" });

  const updates: Partial<typeof projectSubfolders.$inferInsert> & { updatedAt?: Date } = { updatedAt: new Date() };
  if (body.name != null) updates.name = body.name.trim();
  if ("parent_folder_id" in body) {
    if (body.parent_folder_id) {
      const parent = await loadProjectFolder(projectId, body.parent_folder_id);
      if (!parent) return void res.status(404).json({ detail: "Parent folder not found" });

      let cur: string | null = body.parent_folder_id;
      while (cur) {
        if (cur === folderId) return void res.status(400).json({ detail: "Cannot move a folder into itself or a descendant" });
        const p = await loadProjectFolder(projectId, cur);
        if (!p) return void res.status(404).json({ detail: "Parent folder not found" });
        cur = p.parentFolderId ?? null;
      }
    }
    updates.parentFolderId = body.parent_folder_id ?? null;
  }

  const db = getDb();
  const [updated] = await db
    .update(projectSubfolders)
    .set(updates)
    .where(and(eq(projectSubfolders.id, folderId), eq(projectSubfolders.projectId, projectId)))
    .returning();
  if (!updated) return void res.status(404).json({ detail: "Folder not found" });
  res.json(serializeFolder(updated as unknown as Record<string, unknown>));
});

// DELETE /projects/:projectId/folders/:folderId
projectsRouter.delete("/:projectId/folders/:folderId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId, folderId } = req.params;

  const access = await checkProjectAccess(projectId, userId, userEmail);
  if (!access.ok) return void res.status(404).json({ detail: "Project not found" });

  const folder = await loadProjectFolder(projectId, folderId);
  if (!folder) return void res.status(404).json({ detail: "Folder not found" });

  const db = getDb();
  await db
    .update(documents)
    .set({ folderId: null })
    .where(and(eq(documents.folderId, folderId), eq(documents.projectId, projectId)));

  await db
    .delete(projectSubfolders)
    .where(and(eq(projectSubfolders.id, folderId), eq(projectSubfolders.projectId, projectId)));

  res.status(204).send();
});

// PATCH /projects/:projectId/documents/:documentId/folder
projectsRouter.patch("/:projectId/documents/:documentId/folder", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const { projectId, documentId } = req.params;
  const { folder_id } = req.body as { folder_id: string | null };

  const access = await checkProjectAccess(projectId, userId, userEmail);
  if (!access.ok) return void res.status(404).json({ detail: "Project not found" });

  if (folder_id) {
    const folder = await loadProjectFolder(projectId, folder_id);
    if (!folder) return void res.status(404).json({ detail: "Folder not found" });
  }

  const db = getDb();
  const [updated] = await db
    .update(documents)
    .set({ folderId: folder_id ?? null, updatedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.projectId, projectId)))
    .returning();
  if (!updated) return void res.status(404).json({ detail: "Document not found" });
  res.json(serializeDoc(updated as unknown as Record<string, unknown>));
});

async function loadProjectFolder(
  projectId: string,
  folderId: string,
): Promise<{ id: string; parentFolderId: string | null } | null> {
  const [row] = await getDb()
    .select({ id: projectSubfolders.id, parentFolderId: projectSubfolders.parentFolderId })
    .from(projectSubfolders)
    .where(and(eq(projectSubfolders.id, folderId), eq(projectSubfolders.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function handleDocumentUpload(
  req: import("express").Request,
  res: import("express").Response,
  userId: string,
  projectId: string | null,
) {
  const file = req.file;
  if (!file) return void res.status(400).json({ detail: "file is required" });

  const filename = file.originalname;
  const suffix = filename.includes(".")
    ? filename.split(".").pop()!.toLowerCase()
    : "";
  if (!ALLOWED_TYPES.has(suffix))
    return void res.status(400).json({
      detail: `Unsupported file type: ${suffix}. Allowed: pdf, docx, doc, txt, md`,
    });

  const content = file.buffer;
  const db = getDb();
  const [doc] = await db
    .insert(documents)
    .values({
      projectId: projectId ?? null,
      userId,
      filename,
      fileType: suffix,
      sizeBytes: content.byteLength,
      status: "processing",
    })
    .returning();

  if (!doc)
    return void res.status(500).json({ detail: "Failed to create document record" });

  try {
    const docId = doc.id;
    const key = storageKey(userId, docId, filename);
    const isPlainText = suffix === "txt" || suffix === "md";
    const contentType =
      suffix === "pdf"
        ? "application/pdf"
        : isPlainText
          ? "text/plain; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    await uploadFile(
      key,
      content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer,
      contentType,
    );

    const rawBuf = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
    const tree = await extractStructureTree(rawBuf, suffix, filename);
    const pageCount = suffix === "pdf" ? await countPdfPages(rawBuf) : null;

    let pdfStoragePath: string | null = null;
    if (suffix === "docx" || suffix === "doc") {
      try {
        const pdfBuf = await docxToPdf(content);
        const pdfKey = convertedPdfKey(userId, docId);
        await uploadFile(
          pdfKey,
          pdfBuf.buffer.slice(pdfBuf.byteOffset, pdfBuf.byteOffset + pdfBuf.byteLength) as ArrayBuffer,
          "application/pdf",
        );
        pdfStoragePath = pdfKey;
      } catch (err) {
        console.error(`[upload] DOCX→PDF conversion failed for ${filename}:`, err);
      }
    } else if (suffix === "pdf") {
      pdfStoragePath = key;
    }

    const [versionRow] = await db
      .insert(documentVersions)
      .values({
        documentId: docId,
        storagePath: key,
        pdfStoragePath,
        source: "upload",
        versionNumber: 1,
        displayName: filename,
      })
      .returning({ id: documentVersions.id });

    if (!versionRow)
      throw new Error("Failed to record upload version");

    await db
      .update(documents)
      .set({
        currentVersionId: versionRow.id,
        sizeBytes: content.byteLength,
        pageCount,
        structureTree: tree ?? null,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(documents.id, docId));

    const [updated] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
    const responseDoc = updated
      ? serializeDoc({ ...(updated as unknown as Record<string, unknown>), storagePath: key, pdfStoragePath })
      : null;
    return void res.status(201).json(responseDoc);
  } catch (e) {
    await db.update(documents).set({ status: "error" }).where(eq(documents.id, doc.id));
    return void res.status(500).json({ detail: `Document processing failed: ${String(e)}` });
  }
}

async function countPdfPages(buf: ArrayBuffer): Promise<number | null> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
    const pdf = await (
      pdfjsLib as unknown as {
        getDocument: (opts: unknown) => { promise: Promise<{ numPages: number }> };
      }
    ).getDocument({ data: new Uint8Array(buf) }).promise;
    return pdf.numPages;
  } catch {
    return null;
  }
}

async function extractStructureTree(
  content: ArrayBuffer,
  fileType: string,
  filename: string,
): Promise<unknown[] | null> {
  try {
    if (fileType === "pdf") {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
      const pdf = await (
        pdfjsLib as unknown as {
          getDocument: (opts: unknown) => {
            promise: Promise<{
              numPages: number;
              getOutline: () => Promise<{ title?: string }[]>;
            }>;
          };
        }
      ).getDocument({ data: new Uint8Array(content) }).promise;
      if (pdf.numPages <= 5) return null;
      const outline = await pdf.getOutline();
      if (outline?.length) {
        return outline.map((item, i) => ({
          id: `h1-${i}`,
          title: item.title ?? `Item ${i + 1}`,
          level: 1,
          page_number: null,
          children: [],
        }));
      }
      return Array.from({ length: pdf.numPages }, (_, i) => ({
        id: `page-${i + 1}`,
        title: `Page ${i + 1}`,
        level: 1,
        page_number: i + 1,
        children: [],
      }));
    } else if (fileType === "txt" || fileType === "md") {
      const text = Buffer.from(content).toString("utf-8");
      const lines = text.split("\n").filter((l) => l.trim());
      const nodes = lines.slice(0, 30).map((line, i) => ({
        id: `h1-${i}`,
        title: line.slice(0, 100),
        level: 1,
        page_number: null,
        children: [],
      }));
      return nodes.length ? nodes : null;
    } else {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(content) });
      const lines = result.value.split("\n").filter((l) => l.trim());
      const nodes = lines.slice(0, 30).map((line, i) => ({
        id: `h1-${i}`,
        title: line.slice(0, 100),
        level: 1,
        page_number: null,
        children: [],
      }));
      return nodes.length ? nodes : null;
    }
  } catch {
    return null;
  }
}
