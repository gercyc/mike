// /user/mcp-tokens/* — manage MCP bearer tokens.
//
// On creation, the plaintext secret is returned exactly once and never
// stored. The list endpoint returns only the masked preview.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  listMcpTokens,
  createMcpToken,
  revokeMcpToken,
} from "../lib/mcpTokens";

export const mcpTokensRouter = Router();

mcpTokensRouter.get("/", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  res.json(await listMcpTokens(userId));
});

mcpTokensRouter.post("/", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const { label, scope } = req.body as {
    label?: string;
    scope?: "read" | "read_write";
  };
  if (!label?.trim()) {
    return void res.status(400).json({ detail: "label is required" });
  }
  try {
    const { token, secret } = await createMcpToken(
      userId,
      label.trim(),
      scope ?? "read_write",
    );
    res.status(201).json({ token, secret });
  } catch (err) {
    res.status(500).json({ detail: (err as Error).message });
  }
});

mcpTokensRouter.delete("/:tokenId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  await revokeMcpToken(userId, req.params.tokenId);
  res.status(204).end();
});
