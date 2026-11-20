# Pre-launch audit (Phase 5)

Date: 2026-11-20. Commit: `f570969` on `main` (after #18 to #21). Task: P5V-T03.

This report covers the external audit, a review of every finding in `PRODUCTION_AUDIT.md` against the code on `main`, and the final gate numbers. It changes no code.

## External audit (commit.show)

**External score: not run (pending user decision).**

`npx commitshow audit .` sends the repository URL to commit.show's backend and creates a public commit.show entry for `alexrdz/quire`, so it waits for the user. If they approve it, it runs as a separate follow-up task, which adds the score and classifies its findings the same way as below. There is no earlier score to compare against: the run behind `PRODUCTION_AUDIT.md` (`commitshow@0.3.23`) exited with `bad_target` because the repository had no git remote.

## `PRODUCTION_AUDIT.md`, finding by finding

Classes: **Fixed** (with where), **Real** (worth a task), **Not applicable** (with why). Plan items are in `PRODUCTION_PLAN.md`.

### Blockers

| Finding | Class | Where |
|---|---|---|
| `/demo` signs anyone in; `seedDatabase()` unguarded; mock Google sign-in as Maya; hardcoded sample password | Fixed | 1.1, 1.2. `/demo` is 404 in production and the seed throws outside development, test and Demo. The production-mode e2e checks `/demo` is 404 and nothing is seeded (`tests/e2e/production/production-mode.spec.ts`), and that every Google sign-in action refuses with no sample-Fan session (`feature-messages.spec.ts`). The sample password only exists where seeding is allowed. |
| Hardcoded fallbacks for `BETTER_AUTH_SECRET` and `COOKIE_SECRET` | Fixed | 0.1, 0.2. `config.ts` uses its development secrets only in development and test. In the Demo and production a missing or placeholder secret is a core failure: every route returns 503 and `pnpm check:env` refuses the build (`tests/e2e/production/core-missing.spec.ts` runs a production server with a missing core key). The P4L-T03 local preview values apply only on a `file:` database off Netlify. |
| Stored XSS through uploads (`x.html` as `image/png`, SVG) | Fixed | 1.4. The type comes from the file bytes, the extension from the detected type, SVG is gone, and rasters are re-encoded to WebP (`tests/unit/services/upload-hardening.test.ts`; `tests/e2e/production/uploads.spec.ts` shows production writes nothing with uploads off). Production has no local upload fallback, and CDN files get `nosniff` (3.4). |

### High

| Finding | Class | Where |
|---|---|---|
| Open redirects on `/demo` and `/logout`; GET logout; `/\` bypass | Fixed | 2.1, 2.2. One checker (`resolveSafeRedirect`, `tests/unit/schemas/redirect.test.ts`). `/logout` is POST-only (`tests/e2e/logout.spec.ts`, and in production mode `tests/e2e/production/logout-and-redirects.spec.ts`: GET is 405, payloads fall back on this origin, Better Auth never redirects off-site). |
| No rate limiting; tip action enables card testing; petitions email anyone | Fixed | 2.3. `RATE_LIMITS` in `services/rate-limit.ts` covers sign-in, sign-up, reset, petitions, notes, flags, scans, tip taps and Venmo changes. Card testing no longer applies: no card is taken (Phase V). |
| Mock `succeeded` tips without `STRIPE_SECRET_KEY` | Fixed, then moot | 1.3, then V.1. Stripe is dormant (ADR 0008); tips are Venmo links and Quire records only taps, never payments (`tests/e2e/production/venmo-tip.spec.ts`: exact Venmo links, no Stripe key). |
| Email verification off | Fixed | 2.4, V.3. `requireEmailVerification` stays `false` so sign-in works at once (a decision), but publishing, uploads and setting a Venmo username need a confirmed email (`tests/unit/routes/email-verification-gate.test.ts`). |
| Production email not configured; dev fallback logs links | Fixed in code; setup left for the user | 1.3. Bodies are logged only in development and test; the Demo suppresses email. `RESEND_API_KEY` is a production deploy variable (`check-env` reports `email: OFF` without it). See "Left for the user". |

### Medium

| Finding | Class | Where |
|---|---|---|
| Stripe webhook gaps; no idempotency keys | Not applicable | 3.1 parked. Stripe is dormant and `/api/webhooks/stripe` returns 404 (V.1). Revisit only if Stripe is revived. |
| `submitNote` trusts form `artistId` / `issueId` | Fixed | 3.2. Walls resolve from the URL slug only; `flagWallNote` rejects a note from another Wall. |
| Attendance tokens long-lived, not user-bound; key in query string | Not applicable | Accepted by decision 19 and ADR 0001 (see "Audit verification"). The query string is never logged (3.6). |
| Payout token consumed on GET | Fixed, then moot | 3.3 became V.3: the Venmo change page load only shows the pending change; a POST consumes the token. The Stripe payout flow is dormant. |
| `adapter-auto`; local upload fallback; runtime DDL in `seed.ts` | Fixed | 3.4 (`adapter-netlify`, `netlify.toml`), 1.4 (no local uploads in production or on the Netlify Demo), 3.5 (drizzle migrations only; `drizzle-kit generate` reports no changes, checked by a unit test). |
| No security headers or CSP | Fixed | 3.4. CSP, `nosniff` and the referrer policy on every response (`tests/e2e/security-headers.spec.ts`, and the production-mode e2e). |
| No error handling or monitoring | Fixed; error tracking deferred | 3.6. `handleError` with a request id, `/healthz`. An error tracking service was deferred by decision; Netlify function logs are the launch baseline. |
| Multi-step writes not in transactions | Fixed | 3.7. Signup is atomic by compensation: Better Auth writes the user outside any transaction Quire can join, so the Artist rows go in one libsql batch and a failure deletes the new user (`services/account.ts`, `createArtistForNewUser`). `flagWallNote` is one atomic batch. |

### Low

| Finding | Class | Where |
|---|---|---|
| Photos keep EXIF and GPS | Fixed | 1.4. `sharp` re-encodes every raster to WebP, which drops metadata. |
| `.env` and `.env.example` differ | Fixed | 4.1. `.env.example` lists all 22 variables `config.ts` reads. |
| Auth checks repeated per route | Fixed | 4.3. `src/lib/server/guards.ts`; `getSession` is called only in `hooks.server.ts`. |
| No leaked secrets | Not applicable | Not a defect. Still true on `main`: the only secret-like strings are the development and local-preview values, which `config.ts` refuses in the Demo and production, and the sample Issues' scan keys in `seed.ts`, which only seed where seeding is allowed. |
| AGENTS.md compliance; 145 flex/grid declarations | Not applicable | Out of scope by decision (`PRODUCTION_PLAN.md`, "Out of scope"). `pnpm check:sizing` passes. |

### New in this review

None worth a task. Notes:

- `PRODUCTION_AUDIT.md` opened with a stray line of agent narration before its first sentence. Removed in this PR, with a pointer to this report.
- Phase 5 production-mode e2e: done in P5V-T01 (#21). The suite in `tests/e2e/production/` covers the missing core key, feature messages, open-redirect payloads, uploads and the Venmo link, and is in the gate below.

## Gate on `main` (`f570969`)

Fresh clone, `pnpm install --frozen-lockfile`, fresh `local.db`, `CI=1` (no server reuse).

| Check | Result |
|---|---|
| `pnpm check` | 0 errors, 0 warnings (2286 files) |
| `pnpm test` | 622 passed, 51 files |
| `pnpm check:sizing` | passed (50 files) |
| `pnpm build` | passed (`adapter-netlify`) |
| `pnpm test:e2e` | 88 passed, 1 known failure (test, Demo and production-mode projects, including the missing-core-key server) |
| `pnpm check:env` | refuses, as it should with no secrets set: core `BETTER_AUTH_SECRET`, `COOKIE_SECRET`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_URL`; email, Fan sign-in and uploads off |

**Known failure, not a finding:** `production/venmo-tip.spec.ts`, "a custom amount carries the right amount". P5V-T01 marked it `test.fail()` for the custom-tip bug, which P5V-T02 (#20) fixed, so Playwright now reports "Expected to fail, but passed". It clears when Jim's B1-T01 removes the marker.

Any `[error] status=404` lines and the Better Auth "Provider not found" line in the e2e log are expected. They come from the 404-page checks, the Demo upload check (which reads the file from disk because `vite preview` serves only the built static folder), and the check that production has no Google provider.

## Left for the user

1. **Deploy the Demo first**, per `docs/demo-site.md`: its own Netlify site and Turso database, `DEMO_MODE=true`, the core variables, no Stripe or Resend keys. Then use Run now on the `demo-reset` scheduled function once and check `/healthz`.
2. **Then production**: the core variables, plus `RESEND_API_KEY`, the Google keys and the R2 keys for email, Fan sign-in and uploads. `check:env` names what is missing; set `PUBLIC_PRODUCTION_URL` on the Demo site for its sign-up link.
3. **Baseline any existing database** before its first migrated deploy, per `docs/database-migrations.md` (`pnpm db:baseline --dry-run`, then `pnpm db:baseline`). A new database needs nothing.
