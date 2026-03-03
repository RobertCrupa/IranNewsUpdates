# AGENTS PLAYBOOK
Guidance for autonomous coding agents working in this repo. Follow commands, conventions, and safety notes below.

## 1) Core commands
- Install deps: `npm install`
- Dev server: `npm run dev` (Next.js 16, App Router)
- Build: `npm run build`
- Start production build locally: `npm run start`
- Lint: `npm run lint`
- Tests: No test runner configured yet. If you add tests, prefer `npm test -- <pattern>` with vitest or `next test`. Document any new scripts here.
- Single test guidance: until a runner exists, create a temporary script (e.g., `"test": "vitest"`) and run `npm test -- path/to/file.test.ts`.

## 2) Environment & secrets
- Copy `.env.example` to `.env.local`. Required keys: `MONGODB_URI`, `APIFY_API_TOKEN`, `OPENAI_API_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_BASE_URL`, optional `LOG_LEVEL`.
- Do NOT commit real secrets. `.env.local` is gitignored.
- Vercel Cron calls `/api/cron/update` every 15 minutes; local dev can call without auth, production expects `Authorization: Bearer <CRON_SECRET>`.

## 3) Project shape
- Framework: Next.js 16 App Router (TypeScript, `app/` directory).
- Styling: Tailwind CSS v4 in `app/globals.css` and component classes.
- API routes live in `app/api/*/route.ts`; runtime defaults to Node unless overridden.
- Data: MongoDB via Mongoose models in `lib/models/*`; connection helper in `lib/db.ts` with global cache.
- LLM: OpenAI helpers in `lib/openai.ts` (not fully inspected here, follow patterns used).
- Scraping: Apify client helpers in `lib/apify.ts` feed Article documents.

## 4) Linting & formatting
- ESLint uses `eslint.config.mjs` with `eslint-config-next` (core-web-vitals + typescript). Respect rules; run `npm run lint` before shipping.
- No Prettier config present; match existing style (2-space indent? actually files use 2-space? Source uses 2 spaces in JSON, but TS uses 2 spaces). Use TypeScript default formatting with semicolons.
- Avoid disabling lint rules unless necessary; prefer local fixes.

## 5) Imports
- Path alias `@/*` maps to repo root (see `tsconfig.json`). Prefer alias over deep relative paths for shared code.
- Group imports: external packages first, then `@/lib`, components, local files. Keep type-only imports using `import type { ... }` to avoid runtime cost.
- Avoid default exports for utilities unless pattern already exists; components can remain default as in repo.

## 6) TypeScript conventions
- `strict` mode enabled. Avoid `any`; use discriminated unions and literal types where possible.
- Define response types in `lib/types.ts`; extend there when adding API shapes.
- Ensure server-only code stays free of browser-only globals; client components should include "use client" pragma when they use hooks/state.
- When dealing with Mongo ObjectIds, type as `Types.ObjectId` server-side; serialize to string for clients.
- Use `unknown` for unsafe inputs, validate with zod (dependency available) before narrowing.

## 7) Naming
- Components: PascalCase files (`Header.tsx`, `NewsFeed.tsx`), default exports.
- Hooks: `useX` prefix, camelCase file names if colocated.
- API handlers: export `GET`, `POST`, etc. functions in route files; keep handler names uppercase per Next convention.
- Constants: SCREAMING_SNAKE for env-derived constants; camelCase for local helpers; PascalCase for types/interfaces.

## 8) Error handling
- API routes should return `NextResponse.json({ error }, { status })`; include minimal details in production, richer in development (see `app/api/cron/update/route.ts`).
- For DB and external calls, log errors via `logger.error(scope, message, meta)`; do not expose stack traces to clients.
- Favor early returns on validation failures; respond with 400 for bad input, 401 for auth failures, 500 for server issues, 502 for upstream failures.

## 9) Logging
- Use `lib/logger.ts`: methods `debug|info|warn|error(scope, message, meta?)`.
- `LOG_LEVEL` controls verbosity; `debug` is always printed in non-production.
- Include a clear scope string (e.g., `api/cron/update`, `db`, `scrape`) and concise metadata.

## 10) Data & models
- Models live under `lib/models/` (Article, SituationUpdate, TravelAlert). Use `connectDB()` before model use in API handlers.
- `connectDB` caches connections globally; handles non-ready states by resetting cache. Do not create new connections manually.
- When persisting scraped data, prefer `findOneAndUpdate` with `upsert` to avoid duplicates (see cron route example).

## 11) API patterns
- Keep handlers side-effect free beyond their scope; reuse helpers in `lib/apify`, `lib/openai`, `lib/db`.
- Use `export const runtime = "nodejs";` when relying on Node APIs (cron route already sets it).
- Add `maxDuration` where long-running tasks occur; current cron route uses `60` seconds.
- Provide pagination metadata for list endpoints (see `/api/news` response shape).

## 12) Client components & data fetching
- Client components declare "use client" and use React hooks. Avoid server-only modules inside client code.
- Server components can fetch with `fetch(..., { next: { revalidate } })` for ISR caching; keep base URL from `NEXT_PUBLIC_BASE_URL` as in `app/page.tsx`.
- Polling: `NewsFeed` uses `setInterval` (2 min); clean up intervals in `useEffect` cleanup.
- Prefer optimistic UI for small interactions; keep network errors silent unless user-facing is required.

## 13) Styling
- Tailwind v4 utility classes dominate; stay consistent with palette (zinc/indigo/amber/emerald/purple).
- Layout uses dark minimalist UI. Maintain rounded borders, subtle borders (`border-zinc-800`) and spacing similar to existing components.
- Avoid adding global CSS unless necessary; prefer component-level classes.

## 14) Accessibility & UX
- Use semantic elements (`<section>`, `<main>`, `<aside>`, `<h1>` etc.).
- Links that open new tabs must include `rel="noopener noreferrer"`.
- Buttons need accessible labels; avoid div-onclick patterns.
- Keep text contrast sufficient against dark background.

## 15) Performance
- Avoid unbounded re-renders; memoize expensive computations where needed.
- When adding data fetching, use pagination and server-side filtering.
- For lists, provide stable `key` props (already using `_id`).
- Do not block cron route; handle partial failures and log them while returning structured errors.

## 16) Authentication & security
- Cron/auth: `isAuthorizedCronRequest` validates Bearer token when `CRON_SECRET` is set. Preserve this check for any new cron-like routes.
- Sanitize/validate incoming request bodies; reject unexpected fields. Use zod schemas for request validation when adding inputs.
- Do not echo secrets in responses or logs. Keep environment-driven branching for dev vs prod error detail.

## 17) File paths & aliases
- Use `@/` alias for cross-cutting modules: `@/lib/db`, `@/lib/logger`, `@/components/...`.
- Keep models and shared types in `lib/` to avoid duplication; client-only helpers belong in `app` or `components`.

## 18) Versioning & dependencies
- Node/Next relies on package versions in `package.json` (Next 16.1.6, React 19.2.3, TypeScript 5.9.3).
- Tailwind 4 is alpha-style via `@tailwindcss/postcss`; avoid legacy config assumptions.
- When adding deps, prefer exact minor versions aligned with Next 16/React 19 compatibility.

## 19) Testing guidance (future-proof)
- No tests currently. If adding:
  - Choose `vitest` or `jest` with `@testing-library/react` for components; align with Next 16 support.
  - Add script `"test": "vitest"` and optionally `"test:watch": "vitest watch"`.
  - Single test: `npm test -- src/foo.test.ts`.
  - For API route tests, mock `NextRequest/NextResponse` or use integration tests with `next` test utils.
- Update this file with any added scripts to keep agents informed.

## 20) Build & deployment notes
- `next.config.ts` controls Next setup (check before altering runtimes/experiments).
- Production deploy expects MongoDB reachable and CRON auth enforced.
- `vercel.json` schedules cron every 15 minutes to `/api/cron/update`.
- For local data seeding, run `curl -i http://localhost:3000/api/cron/update` after `npm run dev`.

## 21) Error surfaces & UX messaging
- Keep user-facing error text minimal and non-technical; log technical detail server-side.
- API errors should use consistent JSON shape: `{ error: string, ...context }`.
- Loading states: use `loading` flags as in `NewsFeed`; disable buttons during fetch.

## 22) Logging scopes reference
- Common scopes: `api/cron/update`, `db`, `scrape`, `openai`, `news`, `travel`, `updates`, `logger`.
- Include `durationMs` for long-running steps; include counts (e.g., `totalCount`, `categoryCounts`).

## 23) Data freshness & polling
- UI auto-refreshes: News every 2 minutes, updates every 15 minutes (via API revalidation/polling). Maintain or adjust with care; consider cache headers if adding routes.

## 24) Schema & validation expectations
- Articles: expect `title`, `url`, `source`, `content`, `publishedAt`, `category`, optional `imageUrl`, `scrapedAt`.
- SituationUpdate: `title`, `summary`, `keyPoints[]`, `severity`, `generatedAt`, `sourceArticleIds`.
- TravelAlert: `country`, optional `city`, `alertLevel`, `title`, `description`, `advice[]`, optional embassy fields.
- When extending schemas, keep lean server return types and serialize dates to ISO strings for clients.

## 25) Frontend patterns
- Keep layout widths within `max-w-7xl`, padding `px-4 sm:px-6`, sections spaced with `space-y-*`.
- Badges and pills use soft backgrounds and bold text; match category colors used in `NewsFeed` for consistency.
- Use `line-clamp` for preview text to avoid overflow.

## 26) Migrations & data safety
- No migration framework present. For schema changes, ensure backward compatibility or include manual migration scripts.
- Avoid destructive mutations in cron; prefer additive fields and safe fallbacks.

## 27) Performance budgets
- Cron `maxDuration` is 60s; scraping plus summary must finish within. Keep external calls bounded with timeouts (Apify/Mongo defaults may need tuning if slow).
- UI bundle: avoid large client dependencies; keep client components lean and server components for data fetching where possible.

## 28) Security checklist for new work
- Validate input; reject unexpected JSON shape.
- Authenticate cron-like endpoints; do not expose administrative triggers without auth.
- Strip protocol/domain validation for URLs if presenting links; consider allowlist for official sources.
- Never log full request bodies containing secrets.

## 29) Tooling notes for agents
- No Cursor or Copilot rule files present; no additional platform constraints beyond this guide.
- Use `@/` paths to reduce brittle relative imports.
- Prefer `apply_patch` for single-file edits; avoid committing unless user asks.

## 30) Contribution cadence
- Before changes: skim `README.md` for context; align with described features (official source feed, AI updates, travel alerts).
- After changes: run `npm run lint`; smoke test `npm run dev` if touching runtime paths; document new env vars.
- Keep this AGENTS.md updated when adding commands, rules, or processes.

## 31) Quick checklists
- When adding an API:
  - [ ] Validate input (zod recommended)
  - [ ] Call `connectDB()` before model access
  - [ ] Use `NextResponse.json` with proper status codes
  - [ ] Log scope + outcome
  - [ ] Export handler for allowed methods only
- When adding UI:
  - [ ] Respect dark theme tokens and spacing
  - [ ] Ensure responsive layout (`grid`, `space-y`, `max-w-7xl`)
  - [ ] Clean up effects and intervals
- When adding tests:
  - [ ] Add npm scripts
  - [ ] Prefer vitest + testing-library/react
  - [ ] Keep fixtures small and deterministic

## 32) When in doubt
- Mirror existing patterns in `app/api/cron/update/route.ts` for structure, logging, and error handling.
- Keep responses predictable and minimal; favor robustness over perfect UX for admin endpoints.
- Update this file when introducing new workflows so future agents stay aligned.
