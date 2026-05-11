import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import https from "node:https";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
// Importing this initialises the SQLite singleton (creates ~/.mike/mike.db
// if missing) before any other module touches the DB.
import { runMigrations } from "./lib/db";
import { chatRouter } from "./routes/chat";
import { projectsRouter } from "./routes/projects";
import { projectChatRouter } from "./routes/projectChat";
import { documentsRouter } from "./routes/documents";
import { tabularRouter } from "./routes/tabular";
import { workflowsRouter } from "./routes/workflows";
import { userRouter } from "./routes/user";
import { downloadsRouter } from "./routes/downloads";
import { filesRouter } from "./routes/files";
import { eventsRouter } from "./routes/events";
import { authHandoffRouter } from "./routes/authHandoff";
import { aiKeysRouter } from "./routes/aiKeys";
import { mcpTokensRouter } from "./routes/mcpTokens";
import { localAuthRouter } from "./routes/localAuth";
import { pairRouter } from "./routes/pair";
import { desktopRouter } from "./routes/desktop";
import { getOrCreateLoopbackCert } from "./lib/cert";

// Bring schema up to date before any route handler reads from the DB.
runMigrations();

// Wipe sessions on boot.
//
// The encrypted-secrets cache is in-memory only and is unlocked from
// the user's plaintext password during /auth/login. After a server
// restart the cache is empty even though the user's session row still
// exists in SQLite — that means /user/ai-keys writes would fail with
// "Secrets store is locked". Forcing a re-login on every boot keeps
// the cache and the session lifecycle in sync. Cheap on a single-user
// local app.
import { db as _db } from "./lib/db";
_db.prepare("DELETE FROM sessions").run();

const app = express();
const HTTP_PORT = Number(process.env.PORT ?? 3001);
const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 3002);

const allowedOrigins = [
  process.env.FRONTEND_URL ?? "http://localhost:3000",
  process.env.ADDIN_URL ?? "https://localhost:3002",
  "http://127.0.0.1:3000",
  "https://127.0.0.1:3002",
  "https://localhost:3002",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, Postman,
      // and Office task panes which sometimes send a null Origin).
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));

// ---------------------------------------------------------------------------
// Word add-in static bundle.
//
// Wave 3 ships the add-in's built `dist/` from the same backend that hosts
// the API. The Electron shell builds it once on launch (or in CI), and the
// add-in fetches both its own JS and its API calls from the same HTTPS
// origin (https://127.0.0.1:3002). Keeping it on the same origin avoids
// the mixed-content + cross-origin-cookie pain.
// ---------------------------------------------------------------------------
const ADDIN_DIST = path.resolve(__dirname, "../../word-addin/dist");
if (fs.existsSync(ADDIN_DIST)) {
  app.use(
    "/addin",
    express.static(ADDIN_DIST, {
      // The bundle filenames are not hash-busted, so we have to disable
      // browser-side caching entirely — otherwise Word's WKWebView serves
      // a stale bundle for up to 24h after a rebuild and the user sees
      // mysterious "Load failed" errors against the live backend.
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-store, max-age=0");
      },
    }),
  );
} else {
  // Don't crash — the add-in is optional. Just log so the user knows.
  console.warn(
    `[addin] ${ADDIN_DIST} not found — Word add-in will not be served. Run \`cd word-addin && npm run build\` to enable it.`,
  );
}

// Token-authenticated local file downloads. Registered before any auth
// middleware — the token in the URL is the credential.
app.use("/files", filesRouter);

// Auth endpoints — registered before requireAuth-protected routes so
// /auth/status and /auth/login work without a session.
app.use("/auth", localAuthRouter);
// Wave 3 desktop ↔ add-in pairing.
app.use("/auth/pair", pairRouter);
// Legacy local-handoff path is kept so old clients get a clean 410 instead
// of a 404; it's mounted under the same /auth prefix it always lived at.
app.use("/auth/local-handoff", authHandoffRouter);

app.use("/chat", chatRouter);
app.use("/projects", projectsRouter);
app.use("/projects/:projectId/chat", projectChatRouter);
app.use("/single-documents", documentsRouter);
app.use("/tabular-review", tabularRouter);
app.use("/workflows", workflowsRouter);
app.use("/user", userRouter);
app.use("/users", userRouter);
app.use("/download", downloadsRouter);
app.use("/events", eventsRouter);
app.use("/desktop", desktopRouter);
app.use("/user/ai-keys", aiKeysRouter);
app.use("/user/mcp-tokens", mcpTokensRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

// HTTP listener (frontend + most clients).
http.createServer(app).listen(HTTP_PORT, "127.0.0.1", () => {
  console.log(`Mike backend (HTTP)  listening on http://127.0.0.1:${HTTP_PORT}`);
});

// HTTPS listener (required for the Word add-in). Best-effort — if cert
// generation fails (e.g. no openssl), we skip it and only the desktop UI
// works. The add-in surfaces a friendly error to the user in that case.
const certPair = getOrCreateLoopbackCert();
if (certPair) {
  https
    .createServer({ key: certPair.key, cert: certPair.cert }, app)
    .listen(HTTPS_PORT, "127.0.0.1", () => {
      console.log(
        `Mike backend (HTTPS) listening on https://127.0.0.1:${HTTPS_PORT} (self-signed)`,
      );
    });
} else {
  console.warn(
    `[https] Skipping HTTPS listener — install openssl and restart to enable the Word add-in.`,
  );
}
