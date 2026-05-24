import { eq } from "drizzle-orm";
import { getDb, userProfiles } from "../db";
import { resolveModel, DEFAULT_TITLE_MODEL, DEFAULT_TABULAR_MODEL, OPENAI_LOW_MODELS, type UserApiKeys } from "./llm";
import { getUserApiKeys as getStoredUserApiKeys } from "./userApiKeys";

export type UserModelSettings = {
  title_model: string;
  tabular_model: string;
  api_keys: UserApiKeys;
};

function resolveTitleModel(apiKeys: UserApiKeys): string {
  if (apiKeys.gemini?.trim()) return DEFAULT_TITLE_MODEL;
  if (apiKeys.openai?.trim()) return OPENAI_LOW_MODELS[0];
  if (apiKeys.claude?.trim()) return "claude-haiku-4-5";
  return DEFAULT_TITLE_MODEL;
}

export async function getUserModelSettings(userId: string): Promise<UserModelSettings> {
  const [row] = await getDb()
    .select({ tabularModel: userProfiles.tabularModel })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const api_keys = await getStoredUserApiKeys(userId);
  return {
    title_model: resolveTitleModel(api_keys),
    tabular_model: resolveModel(row?.tabularModel, DEFAULT_TABULAR_MODEL),
    api_keys,
  };
}

export async function getUserApiKeys(userId: string): Promise<UserApiKeys> {
  return getStoredUserApiKeys(userId);
}
