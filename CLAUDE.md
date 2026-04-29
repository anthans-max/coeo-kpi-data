# CLAUDE.md

## Commands
- `npm run dev` — dev server on port 3000
- `npm run build` — production build + type check
- `npx tsc --noEmit` — fast type check

## Environment
- `NEXT_PUBLIC_SUPABASE_URL` — bare project URL, no trailing slash or path
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` — set in Vercel env + `.env.local`

## Architecture
Next.js 14 App Router + TypeScript + Tailwind + Supabase (@supabase/ssr).

### Supabase clients
- `@/lib/supabase/server` — async createClient() for server components/route handlers
- `@/lib/supabase/browser` — createClient() for "use client" components

### Dynamic pages
Any page that queries Supabase must export:
  export const dynamic = 'force-dynamic'

### Auth
HTTP Basic Auth at the edge via `src/middleware.ts` (not middleware.ts at root).

### Tailwind
Use theme tokens (navy, orange, cream, rounded-card) not hardcoded hex values.
Do NOT use arbitrary Tailwind values like text-[13px] — use theme tokens only.

### Data corrections
Fix simple data issues directly in Supabase Table Editor, not via code changes.

### Postgres arrays
Use ARRAY['value'] syntax, not JSON-style ["value"].

## Build status (sessions)
- Session 1 (current): scaffolding + middleware + Supabase clients + `/upload` page with all six CSV parsers and persistence. The "Compute profitability" button is a disabled placeholder.
- Session 2 (next): compute server action, dashboard, `/voice`, `/circuits`, `/reconciliation`.

The schema lives in `supabase/migrations/001_schema.sql` — run it once in the Supabase SQL Editor for the project pointed to by `NEXT_PUBLIC_SUPABASE_URL`. There is no Supabase CLI integration in v1; the SQL file is the source of truth.

## CSV parsing
- Parsing runs in the browser via papaparse (`src/lib/parse/*`), one parser per source.
- Header lookup is case-insensitive and whitespace-tolerant — see `buildHeaderMap` in `src/lib/normalise.ts`.
- The client batches parsed rows (500/batch) to the `insertBatch` server action.
- Field mapping quirks to remember:
  - Inteliquent: use `duration_charge`, NOT `call_charge` (which is zero ~99.96% of the time).
  - Rev.IO Rated CDR: ignore `cost_charge` (always zero); use `charge` for revenue.
  - Bandwidth: `call_destination` is E.164 — `normaliseTN` strips the leading `+1`.
  - RazorFlow customer name: prefer `cid_customer_name_z`, fall back to `_a`.
