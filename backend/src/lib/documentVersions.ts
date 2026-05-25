import { eq, inArray, and, isNotNull, max } from "drizzle-orm";
import { getDb, documents, documentVersions } from "../db";

interface DocRow {
  id: string;
  currentVersionId?: string | null;
  latestVersionNumber?: number | null;
  storagePath?: string | null;
  pdfStoragePath?: string | null;
  activeVersionNumber?: number | null;
  [k: string]: unknown;
}

export interface ActiveVersion {
  id: string;
  storagePath: string;
  pdfStoragePath: string | null;
  versionNumber: number | null;
  displayName: string | null;
  source: string | null;
}

export async function loadActiveVersion(
  documentId: string,
  versionId?: string | null,
): Promise<ActiveVersion | null> {
  const [doc] = await getDb()
    .select({ currentVersionId: documents.currentVersionId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  const targetVersionId = (typeof versionId === "string" && versionId) || doc?.currentVersionId || null;
  if (!targetVersionId) return null;

  const [v] = await getDb()
    .select()
    .from(documentVersions)
    .where(and(eq(documentVersions.id, targetVersionId), eq(documentVersions.documentId, documentId)))
    .limit(1);

  if (!v || !v.storagePath) return null;
  return {
    id: v.id,
    storagePath: v.storagePath,
    pdfStoragePath: v.pdfStoragePath ?? null,
    versionNumber: v.versionNumber ?? null,
    displayName: v.displayName ?? null,
    source: v.source ?? null,
  };
}

export async function attachActiveVersionPaths<T extends DocRow>(docs: T[]): Promise<T[]> {
  if (docs.length === 0) return docs;

  const versionIds = docs
    .map((d) => d.currentVersionId)
    .filter((id): id is string => typeof id === "string");

  if (versionIds.length === 0) {
    for (const d of docs) { d.storagePath = null; d.pdfStoragePath = null; }
    return docs;
  }

  const rows = await getDb()
    .select({ id: documentVersions.id, storagePath: documentVersions.storagePath, pdfStoragePath: documentVersions.pdfStoragePath, versionNumber: documentVersions.versionNumber })
    .from(documentVersions)
    .where(inArray(documentVersions.id, versionIds));

  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const d of docs) {
    const v = d.currentVersionId ? byId.get(d.currentVersionId) : null;
    d.storagePath = v?.storagePath ?? null;
    d.pdfStoragePath = v?.pdfStoragePath ?? null;
    d.activeVersionNumber = v?.versionNumber ?? null;
  }

  return docs;
}

export async function attachLatestVersionNumbers<T extends DocRow>(docs: T[]): Promise<T[]> {
  if (docs.length === 0) return docs;

  const ids = docs.map((d) => d.id);
  const rows = await getDb()
    .select({ documentId: documentVersions.documentId, max: max(documentVersions.versionNumber) })
    .from(documentVersions)
    .where(
      and(
        inArray(documentVersions.documentId, ids),
        eq(documentVersions.source, "assistant_edit"),
        isNotNull(documentVersions.versionNumber),
      ),
    )
    .groupBy(documentVersions.documentId);

  const latestByDoc = new Map(rows.map((r) => [r.documentId, r.max]));
  for (const d of docs) {
    d.latestVersionNumber = latestByDoc.get(d.id) ?? null;
  }

  return docs;
}
