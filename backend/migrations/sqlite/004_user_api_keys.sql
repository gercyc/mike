-- Wave 3: per-provider API keys stored encrypted in SQLite.
-- Previously keys lived in ~/.mike/secrets.enc only; this table allows
-- the userApiKeys route layer to store provider keys with per-row
-- encryption (AES-256-GCM) alongside env-var fallbacks.

CREATE TABLE IF NOT EXISTS user_api_keys (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id       TEXT NOT NULL,
  provider      TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  iv            TEXT NOT NULL,
  auth_tag      TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user ON user_api_keys(user_id);
