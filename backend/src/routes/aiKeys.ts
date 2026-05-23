// /user/ai-keys/* — manage per-user AI provider keys.
// See backend/src/lib/aiKeys.ts for storage details.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getAiKeysMasked,
  setAiKey,
  deleteAiKey,
  getDecryptedKey,
} from "../lib/aiKeys";
import { eventBus } from "../lib/eventBus";
import type { AiProvider, AiProviderKey } from "@mike/shared";

export const aiKeysRouter = Router();

aiKeysRouter.get("/", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  res.json(await getAiKeysMasked(userId));
});

aiKeysRouter.put("/:provider", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const provider = req.params.provider as AiProvider;
  const body = req.body as AiProviderKey;
  if (typeof body?.enabled !== "boolean") {
    return void res
      .status(400)
      .json({ detail: "Body must include `enabled: boolean`" });
  }
  try {
    const next = await setAiKey(userId, provider, body);
    eventBus.publish(userId, {
      type: "ai_keys.updated",
      providers: Object.keys(next),
    });
    res.json(next);
  } catch (err) {
    res.status(400).json({ detail: (err as Error).message });
  }
});

aiKeysRouter.delete("/:provider", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const provider = req.params.provider as AiProvider;
  const next = await deleteAiKey(userId, provider);
  eventBus.publish(userId, {
    type: "ai_keys.updated",
    providers: Object.keys(next),
  });
  res.json(next);
});

// Smoke-test a provider with a tiny call. We don't import each provider's
// SDK directly here — we just hit each provider's "list models" endpoint
// over plain HTTP to keep this dependency-light.
aiKeysRouter.post("/:provider/test", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const provider = req.params.provider as AiProvider;
  const key = await getDecryptedKey(userId, provider);
  if (!key) {
    return void res
      .status(400)
      .json({ ok: false, latency_ms: 0, error: "Key not set or disabled" });
  }
  const start = Date.now();
  try {
    let response: Response;
    switch (provider) {
      case "anthropic":
        response = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
        });
        break;
      case "openai":
        response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
      case "gemini":
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
        );
        break;
      case "openrouter":
        response = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        break;
      case "custom":
        return void res
          .status(400)
          .json({ ok: false, latency_ms: 0, error: "Custom test not supported" });
      default:
        return void res.status(400).json({ ok: false, error: "Unknown provider" });
    }
    const latency = Date.now() - start;
    if (response.ok) {
      res.json({ ok: true, latency_ms: latency });
    } else {
      res.status(200).json({
        ok: false,
        latency_ms: latency,
        error: `HTTP ${response.status}`,
      });
    }
  } catch (err) {
    res.status(200).json({
      ok: false,
      latency_ms: Date.now() - start,
      error: (err as Error).message,
    });
  }
});
