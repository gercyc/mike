# Mike Desktop Shell

Electron wrapper that auto-starts the entire Mike stack and loads the frontend.

## What it boots

| Service | Command | Port |
|---|---|---|
| Backend (Express + SQLite) | `tsx src/index.ts` in `../backend` | 3001 (HTTP) / 3002 (HTTPS) |
| Frontend (Next.js) | `next start` (or `next dev` in MIKE_DEV=1) in `../frontend` | 3000 |

## First launch

This repo uses **Bun** for workspace management (the root `package.json` declares
`workspace:*` deps, which npm does not support). Install Bun first if needed:
`curl -fsSL https://bun.sh/install | bash`.

```sh
# 1. Install workspace deps once (from repo root)
bun install

# 2. Build the frontend
cd frontend && bun run build

# 3. (Optional) Build the Word add-in
cd ../word-addin && bun run build

# 4. Boot the desktop app
cd ../electron && bun install && bun start
```

## Developer mode

`MIKE_DEV=1 bun start` runs `next dev` and skips the frontend production build requirement.

## Where data lives

Everything is under `~/.mike/`:

- `mike.db` — SQLite database
- `storage/` — uploaded documents
- `secrets.enc` + `secrets.salt` — encrypted LLM API keys
- `cert/` — self-signed loopback cert for the HTTPS listener

## Word add-in pairing

Sideload `../word-addin/manifest.xml` into Word once. With Mike running:

1. Mike menu → **Pair Word Add-in…** — shows a 6-digit code (60s expiry)
2. In Word, open the Mike task pane → **I have a pairing code** → enter the code
3. The add-in is now signed in; both surfaces share the same SQLite DB and stay in sync via the SSE event bus.
