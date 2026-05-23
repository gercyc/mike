# Mike

An open-source alternative to Harvey and Legora: a Word Addin and a full local-first application with a Bun backend. 


### Why a Word Addin?

Every lawyer in the world has one thing in common: they use Microsoft Word. It's been the default document layer for legal work for 30+ years across every jurisdiction, firm size, and legal system. Rather than asking lawyers to abandon their workflows, Mike meets them inside the tools they already trust.

The Word Addin integrates directly into Microsoft Word with real-time sync to the desktop app. AI can edit documents using Track Changes mode or Add Comments mode, depending on the workflow. Every AI redline carries a one-sentence justification attached as a Word comment. The reviewer sees both the change and the reason—the same workflow a reviewing attorney already uses.

### Shared Backend

Chats, projects, and uploads are visible from either the Word Addin or the desktop app. Review in the desktop, draft in Word, no state mismatch.

### Why Local-First?

Legal work is one of the worst environments for a cloud-first AI tool. The original Mike required deploying Cloudflare R2 and Supabase separately, along with running separate npm commands for the backend and frontend—a real barrier for lawyers without a technical background.

This version simplifies everything:
- **Single Electron app** with straightforward dependency setup
- **SQLite database** at `~/.mike/mike.db` — no Supabase deployment required
- **Local filesystem storage** at `~/.mike/storage/` — documents live on the lawyer's own machine
- **One command to start**: `bun start`

### Why Bun?

This repo contains multiple packages: backend, frontend, word-addin, electron, and more. Bun's `workspace:*` protocol resolves all dependencies in a single install pass, making development and deployment simpler.

## Contents

- `backend/` - Express API, database access, document processing, and migrations
- `frontend/` - Next.js desktop application
- `electron/` - Electron app wrapper
- `word-addin/` - Microsoft Word Addin
- `packages/mcp-server/` - Model Context Protocol server - to be developed
- `packages/shared/` - Shared types and utilities

## Setup

Install dependencies using Bun:

```bash
bun install
```

Create local env files from the examples:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Start the development server:

```bash
bun start
```

This starts both the backend and frontend in development mode. Open the Electron app or navigate to `http://localhost:3000`.

## Building

```bash
bun run build
bun run build --filter word-addin
bun run build --filter frontend
bun run lint
```

## Required Services

- At least one supported model provider key, depending on which models you enable
- LibreOffice for DOC/DOCX to PDF conversion (optional, for document conversion)

## License

AGPL-3.0-only. See `LICENSE`.
