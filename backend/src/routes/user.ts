import { Router } from "express";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { getDb, userProfiles, users } from "../db";
import { DEFAULT_TABULAR_MODEL, resolveModel } from "../lib/llm";
import {
  type ApiKeyStatus,
  getUserApiKeyStatus,
  getUserApiKeys,
  hasEnvApiKey,
  normalizeApiKeyProvider,
  saveUserApiKey,
} from "../lib/userApiKeys";

export const userRouter = Router();

const MONTHLY_CREDIT_LIMIT = 999999;

type ProfileRow = typeof userProfiles.$inferSelect;

function serializeProfile(row: ProfileRow, apiKeyStatus?: ApiKeyStatus) {
  const creditsUsed = row.messageCreditsUsed ?? 0;
  return {
    displayName: row.displayName,
    organisation: row.organisation,
    messageCreditsUsed: creditsUsed,
    creditsResetDate: row.creditsResetDate,
    creditsRemaining: Math.max(MONTHLY_CREDIT_LIMIT - creditsUsed, 0),
    tier: row.tier || "Free",
    tabularModel: resolveModel(row.tabularModel, DEFAULT_TABULAR_MODEL),
    ...(apiKeyStatus ? { apiKeyStatus } : {}),
  };
}

function validateProfilePayload(body: unknown):
  | { ok: true; update: Partial<Pick<ProfileRow, "displayName" | "organisation" | "tabularModel">> }
  | { ok: false; detail: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, detail: "Expected a JSON object" };
  }
  const raw = body as Record<string, unknown>;
  const allowedFields = new Set(["displayName", "organisation", "tabularModel"]);
  const invalidField = Object.keys(raw).find((k) => !allowedFields.has(k));
  if (invalidField) return { ok: false, detail: `Unsupported profile field: ${invalidField}` };

  const update: Partial<Pick<ProfileRow, "displayName" | "organisation" | "tabularModel">> = {};

  if ("displayName" in raw) {
    if (raw.displayName !== null && typeof raw.displayName !== "string") {
      return { ok: false, detail: "displayName must be a string or null" };
    }
    update.displayName = (raw.displayName as string | null)?.trim() || null;
  }
  if ("organisation" in raw) {
    if (raw.organisation !== null && typeof raw.organisation !== "string") {
      return { ok: false, detail: "organisation must be a string or null" };
    }
    update.organisation = (raw.organisation as string | null)?.trim() || null;
  }
  if ("tabularModel" in raw) {
    if (typeof raw.tabularModel !== "string") return { ok: false, detail: "tabularModel must be a string" };
    const resolved = resolveModel(raw.tabularModel, "");
    if (!resolved) return { ok: false, detail: "Unsupported tabularModel" };
    update.tabularModel = resolved;
  }

  return { ok: true, update };
}

async function ensureProfileRow(userId: string): Promise<void> {
  await getDb().insert(userProfiles).values({ userId }).onConflictDoNothing();
}

async function loadProfile(userId: string, options: { repairMissing?: boolean } = {}) {
  const db = getDb();
  let [row] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);

  if (!row) {
    if (!options.repairMissing) return { data: null, error: new Error("Profile not found") };
    await ensureProfileRow(userId);
    [row] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    if (!row) return { data: null, error: new Error("Profile not found after insert") };
  }

  if (row.creditsResetDate && new Date() > new Date(row.creditsResetDate)) {
    const newResetDate = new Date();
    newResetDate.setDate(newResetDate.getDate() + 30);
    const [updated] = await db
      .update(userProfiles)
      .set({ messageCreditsUsed: 0, creditsResetDate: newResetDate, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId))
      .returning();
    if (!updated) return { data: null, error: new Error("Failed to reset credits") };
    row = updated;
  }

  return { data: serializeProfile(row), error: null };
}

// POST /user/profile
userRouter.post("/profile", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  try {
    await ensureProfileRow(userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ detail: err instanceof Error ? err.message : "Internal error" });
  }
});

// GET /user/profile
userRouter.get("/profile", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const { data, error } = await loadProfile(userId, { repairMissing: true });
  if (error) return void res.status(500).json({ detail: error.message });
  const apiKeyStatus = await getUserApiKeyStatus(userId);
  res.json({ ...data, apiKeyStatus });
});

// PATCH /user/profile
userRouter.patch("/profile", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const parsed = validateProfilePayload(req.body);
  if (!parsed.ok) return void res.status(400).json({ detail: parsed.detail });

  await ensureProfileRow(userId);
  await getDb()
    .update(userProfiles)
    .set({ ...parsed.update, updatedAt: new Date() })
    .where(eq(userProfiles.userId, userId));

  const { data, error } = await loadProfile(userId);
  if (error) return void res.status(500).json({ detail: error.message });
  const apiKeyStatus = await getUserApiKeyStatus(userId);
  res.json({ ...data, apiKeyStatus });
});

// GET /user/api-keys
userRouter.get("/api-keys", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const status = await getUserApiKeyStatus(userId);
  res.json(status);
});

// PUT /user/api-keys/:provider
userRouter.put("/api-keys/:provider", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const provider = normalizeApiKeyProvider(req.params.provider);
  if (!provider) return void res.status(400).json({ detail: "Unsupported provider" });

  const apiKey = typeof req.body?.api_key === "string" ? req.body.api_key : null;
  try {
    if (hasEnvApiKey(provider)) {
      return void res.status(409).json({
        detail: "This provider is configured by the server environment and cannot be changed from the browser.",
      });
    }
    await saveUserApiKey(userId, provider, apiKey);
    const status = await getUserApiKeyStatus(userId);
    res.json(status);
  } catch (err) {
    console.error("[user/api-keys] save failed", { provider, error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ detail: "Failed to save API key" });
  }
});

type OpenRouterModelRaw = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt: string; completion: string };
};

function extraModelIds(): Set<string> {
  const raw = process.env.OPENROUTER_EXTRA_MODELS?.trim() ?? "";
  if (!raw) return new Set();
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

function isFree(m: OpenRouterModelRaw): boolean {
  return m.pricing?.prompt === "0" && m.pricing?.completion === "0";
}

// GET /user/openrouter-models
userRouter.get("/openrouter-models", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  try {
    const keys = await getUserApiKeys(userId);
    const apiKey = keys.openrouter?.trim();
    if (!apiKey) return void res.json({ data: [] });

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return void res.status(502).json({ detail: `OpenRouter returned ${response.status}: ${text || response.statusText}` });
    }

    const json = (await response.json()) as { data?: OpenRouterModelRaw[] };
    const all = json.data ?? [];
    const extras = extraModelIds();
    const filtered = all.filter((m) => isFree(m) || extras.has(m.id));

    filtered.sort((a, b) => {
      const aFree = isFree(a) ? 0 : 1;
      const bFree = isFree(b) ? 0 : 1;
      if (aFree !== bFree) return aFree - bFree;
      return (a.name ?? a.id).localeCompare(b.name ?? b.id);
    });

    return void res.json({ data: filtered });
  } catch (err) {
    console.error("[user/openrouter-models] fetch failed", err);
    res.status(500).json({ detail: "Failed to fetch OpenRouter models" });
  }
});

// DELETE /user/account
userRouter.delete("/account", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  try {
    await getDb().delete(users).where(eq(users.id, userId));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ detail: err instanceof Error ? err.message : "Internal error" });
  }
});
