/**
 * Local file-token download route.
 *
 * Serves files referenced by a token previously issued by `getSignedUrl`.
 * Authentication is implicit in the token (single-purpose, time-limited),
 * so this route is mounted BEFORE `requireAuth` in index.ts.
 */
import { Router } from "express";

import {
  buildContentDisposition,
  downloadFile,
  readFileMeta,
} from "../lib/storage";
import { consumeFileToken } from "../lib/fileTokens";

export const filesRouter = Router();

filesRouter.get("/:token", async (req, res) => {
  const entry = consumeFileToken(req.params.token);
  if (!entry) return void res.status(404).json({ detail: "Invalid link" });

  const raw = await downloadFile(entry.key);
  if (!raw) return void res.status(404).json({ detail: "File not found" });

  const meta = await readFileMeta(entry.key);
  const contentType =
    entry.contentType ?? meta?.contentType ?? "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  if (entry.filename) {
    res.setHeader(
      "Content-Disposition",
      buildContentDisposition("attachment", entry.filename),
    );
  }
  res.send(Buffer.from(raw));
});
