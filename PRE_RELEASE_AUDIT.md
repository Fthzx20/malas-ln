Pre-Release Audit: Rano LN
==========================

Summary (high level)
- Server logging standardized: added `server/utils/logger.ts` and replaced many `console.*` usages with `logger`.
- Seed script gated: `server/database/seed.ts` requires `CONFIRM_SEED=true` and refuses to run in production.
- Smoke test extended and stabilized: `scripts/smoke-test.js` now probes novels list, novel detail, and chapter endpoints; dev server readiness check used during runs.
- Many server-side warning/err messages converted to `logger` to control production verbosity.

Top priority issues found
1. Dummy/demo data and dev fallbacks
   - `app/pages/read/[chapterId].vue`: contains `dummyComments` used as fallback for non-auth/dev — should be gated or removed before pre-release.
   - `app/pages/index.vue`: dummy contributors fallback.
2. Seed script with heavy console logs (now gated) — still prints many seed logs; acceptable for CLI but ensure not shipped to production images.
3. Duplicate / stray files
   - `server/api/novels/featured.get.get.ts` (duplicate naming) — verify intent and remove duplicates.
4. Console/logging spread in client code
   - Several client-side plugins/pages still use `console.error`/`console.warn` (e.g., `app/plugins/error-handler.client.ts`, `app/plugins/supabase-auth.client.ts`, `app/components/editor/TiptapEditor.client.vue`) — consider a client-side logger wrapper or silence in production builds.
5. Cache invalidation patterns
   - `purgeOnWrite()` used widely but best-effort errors are currently logged and swallowed; consider monitoring/push failures to telemetry and adding retries for critical cache targets.
6. Auth-protected endpoints in smoke tests
   - Extended smoke tests only probe public endpoints; auth-protected endpoints need test tokens or e2e flows for full coverage.
7. Rate-limiting and request validation
   - Many write endpoints validate inputs but do not rate-limit; consider adding coarse rate limits for comment, post, rating endpoints to avoid abuse.

Folder-by-folder high-level notes
- app/
  - UI: many placeholder `placeholder` attributes and dummy fallbacks. Remove development-only fallbacks or gate behind `process.env.NODE_ENV !== 'production'`.
  - Editor: `TiptapEditor.client.vue` includes debug logs and heavy bundles; ensure `@tiptap` extensions are tree-shaken and lazy-loaded.
  - Plugins: client error handlers log to console — replace with client logger or silence in production.

- server/
  - plugins/: `env-check` and `error-handler` now use `logger` but continue to block API routes when critical env/db problems exist (good). Consider exposing a `/healthz` endpoint for readiness probes.
  - api/: many handlers updated to use `withDB` and `throwApiError`. Remaining work: standardize all handlers to return consistent error shapes, add input schemas (zod or similar) for validation.
  - utils/: `db.ts` improved (`withDB`), `purge.ts` and `notifications.ts` now use `logger`.
  - database/: `seed.ts` gated. Review migrations and remove demo data prior to pre-release.

- public/, assets/
  - Placeholder images and unused assets identified; run an asset audit to remove unused files and optimize existing images (webp/avif, proper sizes).

- scripts/
  - `smoke-test.js` extended. Add a `ci/smoke.yml` readiness probe to wait for preview server before executing tests.

Security & deployment notes
- Ensure `.env` and secrets are not committed; verify `drizzle.config.ts` and other configs do not leak secrets.
- Upload handlers validate content-type and size; ensure additional server-side checks on file contents and signed URLs for R2.
- Supabase service role keys must be protected; `env-check` already warns when missing.
- Add Content-Security-Policy headers and review SSR injection points (editor) for XSS risks.

Performance & scaling notes
- DB: `withDB` reduces connection churn; consider connection pooling and monitoring (PG bouncer) for production.
- Caching: `defineCachedEventHandler` used — ensure cache keys and SWR timings align with write-side purge events.
- Images: add server-side optimization or integrate with a CDN/responsive images.
- Frontend: lazy-load heavy components (`TiptapEditor`, `UiToast`) — already lazy where possible.

Next recommended actions (execution order)
1. Complete audit: produce detailed folder-by-folder issue list (I can generate this file next).
2. Remove or gate all dummy/demo fallbacks (read page, index, admin placeholders).
3. Replace remaining client `console.*` with a client logger or gate to dev only.
4. Add `healthz` and readiness endpoints and update CI `smoke.yml` to wait for readiness.
5. Add input schema validation (zod) for critical write endpoints.
6. Add basic rate-limiting for comment/post/rating endpoints.
7. Run asset optimization and bundle-size analysis (vite build + rollup plugin).
8. Production hardening: CSP, helmet-like headers, secret scanning, CI scanning.

Files changed so far (high impact)
- server/utils/logger.ts (new)
- server/plugins/env-check.ts (use logger)
- server/plugins/error-handler.ts (use logger)
- server/utils/purge.ts (use logger)
- server/utils/notifications.ts (use logger)
- server/database/seed.ts (gated via CONFIRM_SEED)
- package.json (db:seed script updated)
- scripts/smoke-test.js (extended)
- multiple server API handlers switched from console.* to logger.*

If you want, I will now:
- A) Generate a full folder-by-folder detailed report (including file lists and line references), or
- B) Start removing/gating dummy demo fallbacks in the frontend (`app/pages/read/[chapterId].vue`, `app/pages/index.vue`) and replace with proper loading/empty states.

Which should I do next? (I'll proceed automatically with your choice.)
