-- Wave 2: AI provider keys are now stored in `~/.mike/secrets.enc`
-- (AES-256-GCM, key derived from the local password via scrypt).
-- The legacy `user_profiles.ai_keys` JSON column is no longer read or
-- written by the application.
--
-- SQLite does not support `ALTER TABLE ... DROP COLUMN` cleanly across
-- the versions we target (it requires the table-rebuild dance: rename,
-- create new, copy, drop). Since the column is harmless as long as
-- nothing reads it, we leave it in place and just clear any stale
-- ciphertext that may have been written during Wave 1.
--
-- If we ever do want to drop it, the recipe is:
--   BEGIN;
--   CREATE TABLE user_profiles_new (... without ai_keys ...);
--   INSERT INTO user_profiles_new SELECT id, user_id, ... FROM user_profiles;
--   DROP TABLE user_profiles;
--   ALTER TABLE user_profiles_new RENAME TO user_profiles;
--   COMMIT;

UPDATE user_profiles SET ai_keys = '{}' WHERE ai_keys IS NOT NULL AND ai_keys != '{}';
