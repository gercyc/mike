// SQLite singleton + migration runner for Wave 1 of the local refactor.
//
// We deliberately use `better-sqlite3` (synchronous, single-process) — Mike
// is now a single-user local app and the throughput requirements are tiny
// compared to the convenience of "no async overhead, no connection pool".
//
// On first boot we ensure ~/.mike/ exists, open the DB, then apply any
// migrations from backend/migrations/sqlite/ that haven't been recorded in
// the `_migrations` table.

import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME_DIR = path.join(os.homedir(), ".mike");
const DB_PATH = process.env.MIKE_DB_PATH ?? path.join(HOME_DIR, "mike.db");

function ensureHomeDir(): void {
  if (!fs.existsSync(HOME_DIR)) {
    fs.mkdirSync(HOME_DIR, { recursive: true });
  }
}

ensureHomeDir();

export const db: Database.Database = new Database(DB_PATH);

// Sensible defaults — WAL for concurrent reads while a writer is open, and
// foreign keys on so our ON DELETE CASCADE / SET NULL clauses fire.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/** Apply any unrun migrations from migrations/sqlite/ in lexical order. */
export function runMigrations(): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name       TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  );
  const applied = new Set(
    (db.prepare("SELECT name FROM _migrations").all() as { name: string }[])
      .map((r) => r.name),
  );

  // Resolve the migrations dir relative to this file so it works in both
  // `tsx watch` (src/) and compiled-to-dist runs.
  const candidates = [
    path.resolve(__dirname, "../../migrations/sqlite"),
    path.resolve(process.cwd(), "migrations/sqlite"),
    path.resolve(process.cwd(), "backend/migrations/sqlite"),
  ];
  const migrationsDir = candidates.find((p) => fs.existsSync(p));
  if (!migrationsDir) {
    console.warn("[db] No migrations directory found — skipping migrations");
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`[db] applying migration ${file}`);
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
    });
    tx();
  }
}

/** Convenience: parse a TEXT column known to hold JSON, returning null on miss. */
export function jsonGet<T = unknown>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Convenience: stringify before writing a JSON column. Pass-through for null/string. */
export function jsonSet(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
