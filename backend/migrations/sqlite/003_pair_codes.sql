-- Wave 3: short-lived pairing codes used to hand a session token from the
-- desktop shell to the Word add-in (which lives in a separate browser
-- context and cannot share cookies/localStorage).
--
-- Flow:
--   1. Desktop user clicks "Pair Word add-in" → POST /auth/pair/create.
--      Server mints a fresh session token, stores (code, token) here,
--      returns the 6-digit code.
--   2. User types the code into the add-in. Add-in calls
--      POST /auth/pair/redeem { code }; server returns the session token
--      and deletes the row.
--
-- Rows expire after 60s if unredeemed.

CREATE TABLE IF NOT EXISTS pair_codes (
  code          TEXT PRIMARY KEY,
  session_token TEXT NOT NULL,
  expires_at    TEXT NOT NULL
);
