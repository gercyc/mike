import { eq, ne, inArray, sql } from "drizzle-orm";
import { getDb, projects, documents } from "../db";

export type ProjectAccess =
  | { ok: true; isOwner: boolean; project: { id: string; userId: string; sharedWith: unknown } }
  | { ok: false };

export async function checkProjectAccess(
  projectId: string,
  userId: string,
  userEmail: string | null | undefined,
): Promise<ProjectAccess> {
  const [project] = await getDb()
    .select({ id: projects.id, userId: projects.userId, sharedWith: projects.sharedWith })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) return { ok: false };
  if (project.userId === userId) return { ok: true, isOwner: true, project };

  const sharedWith = Array.isArray(project.sharedWith) ? (project.sharedWith as string[]) : [];
  const email = (userEmail ?? "").toLowerCase();
  if (email && sharedWith.some((e) => (e ?? "").toLowerCase() === email)) {
    return { ok: true, isOwner: false, project };
  }

  return { ok: false };
}

export async function ensureDocAccess(
  doc: { userId: string; projectId: string | null },
  userId: string,
  userEmail: string | null | undefined,
): Promise<{ ok: true; isOwner: boolean } | { ok: false }> {
  if (doc.userId === userId) return { ok: true, isOwner: true };
  if (!doc.projectId) return { ok: false };
  const access = await checkProjectAccess(doc.projectId, userId, userEmail);
  return access.ok ? { ok: true, isOwner: false } : { ok: false };
}

export async function ensureReviewAccess(
  review: { userId: string; projectId: string | null; sharedWith?: unknown },
  userId: string,
  userEmail: string | null | undefined,
): Promise<{ ok: true; isOwner: boolean } | { ok: false }> {
  if (review.userId === userId) return { ok: true, isOwner: true };

  const email = (userEmail ?? "").toLowerCase();
  const sharedWith = Array.isArray(review.sharedWith) ? (review.sharedWith as string[]) : [];
  if (email && sharedWith.some((e) => (e ?? "").toLowerCase() === email)) {
    return { ok: true, isOwner: false };
  }

  if (!review.projectId) return { ok: false };
  const access = await checkProjectAccess(review.projectId, userId, userEmail);
  return access.ok ? { ok: true, isOwner: false } : { ok: false };
}

export async function filterAccessibleDocumentIds(
  documentIds: string[],
  userId: string,
  userEmail: string | null | undefined,
): Promise<string[]> {
  if (documentIds.length === 0) return [];

  const docs = await getDb()
    .select({ id: documents.id, userId: documents.userId, projectId: documents.projectId })
    .from(documents)
    .where(inArray(documents.id, documentIds));

  if (docs.length === 0) return [];

  const accessibleProjectIds = new Set(await listAccessibleProjectIds(userId, userEmail));
  return docs
    .filter((d) => d.userId === userId || (d.projectId && accessibleProjectIds.has(d.projectId)))
    .map((d) => d.id);
}

export async function listAccessibleProjectIds(
  userId: string,
  userEmail: string | null | undefined,
): Promise<string[]> {
  const db = getDb();

  const own = await db.select({ id: projects.id }).from(projects).where(eq(projects.userId, userId));
  const ids = new Set<string>(own.map((p) => p.id));

  if (userEmail) {
    const shared = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        sql`${projects.userId} != ${userId} AND ${projects.sharedWith} @> ${JSON.stringify([userEmail])}::jsonb`,
      );
    for (const p of shared) ids.add(p.id);
  }

  return [...ids];
}
