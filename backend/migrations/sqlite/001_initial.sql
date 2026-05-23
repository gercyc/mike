-- Mike — initial SQLite schema (Wave 1 local refactor).
-- Ports backend/migrations/000_one_shot_schema.sql + 001_ai_keys_and_mcp.sql to
-- SQLite. RLS, auth.users FKs, and Postgres-specific functions are dropped —
-- this is a single-user local database.
--
-- Conventions:
--   * UUIDs are stored as TEXT (generated app-side via crypto.randomUUID()).
--   * JSONB → TEXT (JSON-encoded strings; helpers in lib/db.ts wrap parsing).
--   * `timestamptz default now()` → `TEXT DEFAULT (datetime('now'))` (ISO).
--   * Foreign keys use ON DELETE CASCADE / SET NULL where the Postgres schema did.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Local auth (Wave 1)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS local_auth (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen   TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT
);

-- ---------------------------------------------------------------------------
-- User profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_profiles (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL UNIQUE,
  display_name          TEXT,
  organisation          TEXT,
  tier                  TEXT NOT NULL DEFAULT 'Free',
  message_credits_used  INTEGER NOT NULL DEFAULT 0,
  credits_reset_date    TEXT NOT NULL DEFAULT (datetime('now', '+30 days')),
  tabular_model         TEXT NOT NULL DEFAULT 'gemini-3-flash-preview',
  claude_api_key        TEXT,
  gemini_api_key        TEXT,
  ai_keys               TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  cm_number    TEXT,
  visibility   TEXT NOT NULL DEFAULT 'private',
  shared_with  TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

CREATE TABLE IF NOT EXISTS project_subfolders (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL,
  name              TEXT NOT NULL,
  parent_folder_id  TEXT REFERENCES project_subfolders(id) ON DELETE CASCADE,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_project_subfolders_project ON project_subfolders(project_id);

-- ---------------------------------------------------------------------------
-- Documents + versions + edits
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS documents (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT REFERENCES projects(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL,
  filename            TEXT NOT NULL,
  file_type           TEXT,
  size_bytes          INTEGER NOT NULL DEFAULT 0,
  page_count          INTEGER,
  structure_tree      TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  folder_id           TEXT REFERENCES project_subfolders(id) ON DELETE SET NULL,
  current_version_id  TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_user_project ON documents(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_folder ON documents(project_id, folder_id);

CREATE TABLE IF NOT EXISTS document_versions (
  id                TEXT PRIMARY KEY,
  document_id       TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  storage_path      TEXT NOT NULL,
  pdf_storage_path  TEXT,
  source            TEXT NOT NULL DEFAULT 'upload',
  version_number    INTEGER,
  display_name      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS document_versions_document_id_idx
  ON document_versions(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS document_versions_doc_vnum_idx
  ON document_versions(document_id, version_number);

CREATE TABLE IF NOT EXISTS document_edits (
  id                 TEXT PRIMARY KEY,
  document_id        TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chat_message_id    TEXT,
  version_id         TEXT NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  change_id          TEXT NOT NULL,
  del_w_id           TEXT,
  ins_w_id           TEXT,
  deleted_text       TEXT NOT NULL DEFAULT '',
  inserted_text      TEXT NOT NULL DEFAULT '',
  context_before     TEXT,
  context_after      TEXT,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','accepted','rejected')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at        TEXT
);

CREATE INDEX IF NOT EXISTS document_edits_document_id_idx
  ON document_edits(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS document_edits_message_id_idx
  ON document_edits(chat_message_id);
CREATE INDEX IF NOT EXISTS document_edits_version_id_idx
  ON document_edits(version_id);

-- ---------------------------------------------------------------------------
-- Workflows
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workflows (
  id              TEXT PRIMARY KEY,
  user_id         TEXT,
  title           TEXT NOT NULL,
  type            TEXT NOT NULL,
  prompt_md       TEXT,
  columns_config  TEXT,
  practice        TEXT,
  is_system       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workflows_user ON workflows(user_id);

CREATE TABLE IF NOT EXISTS hidden_workflows (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, workflow_id)
);

CREATE INDEX IF NOT EXISTS idx_hidden_workflows_user ON hidden_workflows(user_id);

CREATE TABLE IF NOT EXISTS workflow_shares (
  id                 TEXT PRIMARY KEY,
  workflow_id        TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  shared_by_user_id  TEXT NOT NULL,
  shared_with_email  TEXT NOT NULL,
  allow_edit         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workflow_id, shared_with_email)
);

CREATE INDEX IF NOT EXISTS workflow_shares_workflow_id_idx
  ON workflow_shares(workflow_id);
CREATE INDEX IF NOT EXISTS workflow_shares_email_idx
  ON workflow_shares(shared_with_email);

-- ---------------------------------------------------------------------------
-- Assistant chats
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS chats (
  id          TEXT PRIMARY KEY,
  project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  title       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_project ON chats(project_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id           TEXT PRIMARY KEY,
  chat_id      TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,
  content      TEXT,
  files        TEXT,
  workflow     TEXT,
  annotations  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id);

-- ---------------------------------------------------------------------------
-- Tabular reviews
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tabular_reviews (
  id              TEXT PRIMARY KEY,
  project_id      TEXT REFERENCES projects(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  title           TEXT,
  columns_config  TEXT,
  workflow_id     TEXT REFERENCES workflows(id) ON DELETE SET NULL,
  practice        TEXT,
  shared_with     TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tabular_reviews_user ON tabular_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_tabular_reviews_project ON tabular_reviews(project_id);

CREATE TABLE IF NOT EXISTS tabular_cells (
  id            TEXT PRIMARY KEY,
  review_id     TEXT NOT NULL REFERENCES tabular_reviews(id) ON DELETE CASCADE,
  document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  column_index  INTEGER NOT NULL,
  content       TEXT,
  citations     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tabular_cells_review
  ON tabular_cells(review_id, document_id, column_index);

CREATE TABLE IF NOT EXISTS tabular_review_chats (
  id          TEXT PRIMARY KEY,
  review_id   TEXT NOT NULL REFERENCES tabular_reviews(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  title       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS tabular_review_chats_review_idx
  ON tabular_review_chats(review_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS tabular_review_chats_user_idx
  ON tabular_review_chats(user_id);

CREATE TABLE IF NOT EXISTS tabular_review_chat_messages (
  id           TEXT PRIMARY KEY,
  chat_id      TEXT NOT NULL REFERENCES tabular_review_chats(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,
  content      TEXT,
  annotations  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS tabular_review_chat_messages_chat_idx
  ON tabular_review_chat_messages(chat_id, created_at);

-- ---------------------------------------------------------------------------
-- MCP tokens (Phase 4)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mcp_tokens (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  label         TEXT NOT NULL,
  secret_hash   TEXT NOT NULL UNIQUE,
  preview       TEXT NOT NULL,
  scope         TEXT NOT NULL CHECK (scope IN ('read', 'read_write')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at  TEXT
);

CREATE INDEX IF NOT EXISTS mcp_tokens_user_id_idx ON mcp_tokens(user_id);

-- Seed the local user's profile so callsites that read user_profiles
-- (userSettings, aiKeys) don't have to special-case "row not found yet".
INSERT OR IGNORE INTO user_profiles (id, user_id) VALUES ('local-profile', 'local');
