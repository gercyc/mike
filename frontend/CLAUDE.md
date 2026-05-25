# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next.js 16 (App Router) frontend deployed to **Cloudflare Workers** via `@opennextjs/cloudflare`. Uses React 19, TypeScript strict mode, Tailwind v4, shadcn/ui, Supabase for auth, and next-intl for i18n (English + Portuguese-BR).

## Commands

```bash
npm run dev          # local dev server
npm run build        # production build (Next.js)
npm run lint         # ESLint (flat config, eslint.config.mjs)
npm run preview      # build + preview Cloudflare deployment locally
npm run deploy       # build + deploy to Cloudflare Workers
npm run cf-typegen   # regenerate Cloudflare env types (cloudflare-env.d.ts)
```

> **Do NOT use Vercel or `next export`** — deployment target is Cloudflare Workers only.

## Required Environment Variables

Copy `.env.local.example` and fill in values. These are required even for local dev:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001   # separate backend service
```

Optional (needed for file upload features):
```
R2_ENDPOINT_URL=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

## Development Dependencies

- **Backend API** at `localhost:3001` must be running for most features to work.
- **Supabase credentials** are required even in local dev — the app will not authenticate without them.
- **R2 Storage** is optional; upload functionality is gated by `storageEnabled` in `src/lib/storage.ts`.

## Architecture

### Routing & i18n

- App Router with `src/app/[locale]/` dynamic segment for all localized pages.
- Locales: `en` (default, no URL prefix) and `pt-BR` (prefix: `/pt-BR/...`).
- Cookie: `MIKE_LOCALE`. Config in `src/i18n/routing.ts`.
- Translation files in `src/messages/{en,pt-BR}/*.json` split by domain (common, account, assistant, projects, workflows, tabular, modals).
- Use `next-intl` hooks (`useTranslations`, `getTranslations`) — never hardcode user-facing strings.

### Auth

- Supabase JWT auth. Server-side validation via `getUserFromRequest()` in `src/lib/auth.ts`.
- Use `@supabase/auth-helpers-nextjs` helpers for client and server components.

### UI

- Component library: shadcn/ui ("new-york" style) with Radix UI primitives.
- Tailwind v4 with CSS variables. Theme defined in `src/app/globals.css`.
- Icons: lucide-react.
- Utility: `cn()` from `src/lib/utils.ts` for conditional class merging.
- Path alias: `@/*` → `src/*`.

### LLM / AI

- OpenRouter SDK (`@openrouter/sdk`) as the LLM provider.

### Document Processing

Supports DOCX, XLSX, PDF, Markdown, LaTeX (KaTeX). Processing utilities in `src/lib/fileConverter.ts`. Rich text editor via Tiptap.

## Code Style

- TypeScript strict mode — no `any`, no `as` casts unless unavoidable.
- ESLint v9 flat config (`eslint.config.mjs`). No Prettier — format manually or via IDE.
- Prefer `type` aliases; React components as named function declarations or arrow functions.
- React Compiler is enabled (`reactCompiler: true` in `next.config.ts`) — avoid manual `useMemo`/`useCallback` unless profiling shows a need.

## Branch & PR Conventions

- Branch naming: `feature/description`, `fix/description`, `chore/description`.
- PRs should target `main`; the active feature branch is `feature/openrouter-provider`.

## License

AGPL-3.0-only. Ensure any derivative work complies.
