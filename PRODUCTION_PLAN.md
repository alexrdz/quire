# Quire Production Remediation Plan

Source: `PRODUCTION_AUDIT.md` (2026-11-18), verified against the code the same day.
Decisions: `docs/CONTEXT.md` (decisions 13, 27, 29-31) and `docs/adr/0007-separate-demo-deployment-and-no-production-fallbacks.md`.

## Audit verification

| Audit finding | Verdict |
|---|---|
| `/demo` logs anyone in; `seedDatabase()` unguarded in `/login`, `/a/[slug]`, `/i/[slug]` | Confirmed |
| Mock Google sign-in logs in as `maya@example.com` when keys are unset | Confirmed (login and zine routes) |
| Hardcoded fallback secrets in `auth.ts` and `stamping.ts` | Confirmed |
| Upload extension and MIME trusted from client; SVG allowed | Confirmed (`services/storage.ts`, upload `accept` attributes) |
| Open redirects on `/demo` and `/logout`; GET logout; `/\` bypass | Confirmed |
| No rate limiting; petitions email arbitrary addresses | Confirmed |
| Mock `succeeded` tips when `STRIPE_SECRET_KEY` missing | Confirmed |
| `requireEmailVerification: false` | Confirmed |
| Webhook: early refund/dispute returns 200 `tip_not_found`; amount from metadata; no idempotency keys | Confirmed |
| `submitNote` trusts form `artistId` / `issueId` | Confirmed |
| Payout confirmation token consumed on GET load | Confirmed |
| `adapter-auto`, local upload fallback, runtime DDL in `seed.ts` | Confirmed (target is Netlify per `CONTEXT.md`) |
| Stamp tokens not user-bound, window not re-checked | Not a defect. Tokens are only minted inside the Stamp Window; late claims and remote stamping are accepted by decision 19 and ADR 0001. No change. |
| 145 `display: flex/grid` declarations | Not actionable without per-file review; out of scope. |

## Phase 0: Runtime mode and configuration (foundation for everything else)

**Status (2026-11-18): done, uncommitted.** `pnpm check`, `pnpm test` (212), `pnpm check:sizing` and `pnpm build` green. Notes for later phases:
- Mode fails closed: anything other than `NODE_ENV=development|test` (or `DEMO_MODE=true`) is production. `pnpm preview` is therefore production; Playwright now starts it with `NODE_ENV=test`. `pnpm db:seed` and `pnpm admin` run as production unless `NODE_ENV` is set (relevant to 1.1).
- `BETTER_AUTH_URL` (or `PUBLIC_APP_URL`) is a core setting in deployed modes, beside the four listed above.
- Parts of 1.2 and 1.3 landed here because the guards made them one-liners: production never runs mock tips, mock Google sign-in, console email or the local upload fallback. The Demo suppresses email silently. Seed calls in `/login`, `/a/[slug]`, `/i/[slug]` and `/demo` are untouched (1.1).
- `check:env` exists but is not yet in a build command; wire it into `netlify.toml` in 3.4.
- Still needed: the production-preview e2e for tier 2 (Phase 5). Tier 1 was checked by hand: production preview with an incomplete config returns 503 on every route.

0.1 **Config module** `src/lib/server/config.ts`
- Single place that reads env, validated with zod.
- `mode`: `development | test | demo | production`. `demo` only when `DEMO_MODE=true`.
- Core settings: `BETTER_AUTH_SECRET`, `COOKIE_SECRET`, Turso URL and token. Minimum secret length enforced.
- Feature flags derived from presence of keys: `payments` (Stripe secret + webhook secret), `email` (Resend), `fanSignIn` (Google), `uploads` (R2).
- No other module reads `process.env` for these values. Remove every `|| 'fallback'` for secrets.

0.2 **Core failure (tier 1)** in `hooks.server.ts`
- In `production`, a missing core setting returns a static "Quire is temporarily unavailable" page with status 503 for every request.
- Add a build-time check (`scripts/check-env.ts`, run in the Netlify build command) so a misconfigured production deploy fails before going live.

0.3 **Feature failure (tier 2)**
- Expose feature flags to the UI via the root layout load.
- Payments off: tip buttons replaced by "Tips are temporarily unavailable"; payout setup disabled with explanation.
- Email off: artist signup, password reset, payout change blocked with "We can't send email right now".
- Fan sign-in off: Google button shows "Fan sign-in is temporarily unavailable".
- Uploads off: upload inputs disabled with message; URL fields and embeds still work.

Acceptance: unit tests for config parsing per mode; e2e against `pnpm build && pnpm preview` with `NODE_ENV=production` and each key removed in turn.

## Phase 1: Blockers

**Status (2026-11-18): done on `prod/phase-1` (PR into `prod/phase-0`).** `pnpm check`, `pnpm test`, `pnpm check:sizing` and `pnpm build` green; `pnpm test:e2e` green (13/13).
- Landed: `seedDatabase()` throws outside `development | test | demo`, and the error tells you to run it with `NODE_ENV=development` or `DEMO_MODE=true`. The seed calls in `/login`, `/a/[slug]` and `/i/[slug]` are gone, so seeding runs only from `hooks.server.ts` (`config.autoSeed`), `/demo` and `pnpm db:seed`. `/demo` is 404 in production. The sample Fan sign-in (`googleSignIn`, both `googleAuth` actions), the tip simulator, the console email fallback and the local `static/uploads` path now each check the mode explicitly through `allowsStandIn()` / `allowsSampleData()` in `config.ts`, so a wrongly set feature flag still can't turn them on in production. Uploads detect the type from the bytes with `file-type`, SVG is gone everywhere, every image is re-encoded with `sharp` to WebP (max edge 1600px, no EXIF/GPS, appended payloads dropped), and audio must pass the magic-byte check.
- User decisions: `/demo` works in `development`, `test` and `demo`, and is 404 in production. The e2e suite logs in through it under `NODE_ENV=test`. The `db:seed` script stays as it is in `package.json`.
- Notes for later phases: audio is stored as uploaded after the magic-byte check. Serving uploads with `X-Content-Type-Options: nosniff` and a strict `Content-Type` belongs with the R2/CDN work (3.4). `sharp` works under `pnpm build` + `pnpm preview`, where a real upload came back as WebP. The Netlify function bundle size check stays open until adapter-netlify lands in 3.4. The `/demo` `redirect` parameter is still unvalidated (open-redirect item, Phase 2).
- Out-of-scope fix (lead decision): the Brooklyn sample Issue (`neon-velvet-brooklyn-2026-10-12`) now gets a 48-hour Stamp Window starting one hour before seed time. Each seed run reopens it, including on an existing database. Its slug and date label are unchanged and the other sample Issues are untouched. Why: every sample Issue had a fixed October 2026 window, so the valid-scan e2e failed on `prod/phase-0` too. A skipped test would also have blocked the Phase 2 e2e and the Demo nightly reset. Seeding only runs in development, test and the Demo, so real Issues are never affected.

1.1 **Seed and `/demo` gated to dev, test and Demo**
- `seedDatabase()` throws unless mode is `development`, `test` or `demo`.
- Remove the seed calls from `/login` (load and all actions), `/a/[slug]` and `/i/[slug]`. Seeding happens only from `hooks.server.ts` (dev/demo) and `pnpm db:seed`.
- `/demo` returns 404 in production; it works in `development`, `test` (the e2e suite logs in through it) and `demo`.

1.2 **Mock sign-in removed outside dev/Demo**
- `googleSignIn` (login) and `googleAuth` (zine) no longer create a Maya session in production; they return the tier-2 message.
- Remove `mock_google_client_id` defaults from `auth.ts` in production.

1.3 **Mock payments and email only in dev, test and Demo**
- `createTipCheckout` mock path allowed only in `development | test | demo`. Demo uses Stripe test keys when present.
- Email fallback logs bodies only in `development | test`. In `demo`, emails are suppressed and the UI says email is off in the Demo. Never log tokens or links in production.
- Update ADR 0003 consumers (`services/payments.ts` comment) to reference ADR 0007.

1.4 **Upload hardening** (`src/lib/server/services/storage.ts`)
- Detect type from file bytes (add `file-type`); ignore client filename and MIME.
- Extension comes only from the detected type via `MIME_TO_EXT`.
- Remove `image/svg+xml` from `ALLOWED_IMAGE_MIME_TYPES`, `MIME_TO_EXT`, `EXT_TO_MIME`, and the `accept` attributes in `dashboard/issues/quick/+page.svelte` and `dashboard/bookbinder/[id]/+page.svelte`.
- Add `sharp`; re-encode every raster to WebP at max 1600px edge, which strips EXIF and GPS. Verify the Netlify function bundle builds and stays within size limits.
- Audio: verify magic bytes for each allowed audio type; reject anything else.
- Local `static/uploads` path only in `development | test | demo`.

Acceptance: tests that `x.html` labelled `image/png`, an SVG, and a polyglot are rejected; a JPEG with GPS EXIF comes back as WebP without metadata.

## Phase 2: High

2.1 **One redirect checker**
- Harden `safeRedirectPathSchema`: must start with a single `/`, reject `//`, `/\`, backslashes and control characters.
- Use it in `/demo`, `/logout`, login actions and the confirm-payout redirect.

2.2 **Logout is POST-only**
- Delete the GET handler in `routes/logout/+server.ts`.
- Replace the three `<a href="/logout">` links (`ArtistTopNav.svelte`, `a/[slug]/+page.svelte`, `me/stubs/+page.svelte`) with small forms styled as the current links.

2.3 **Rate limiting in Turso**
- Better Auth `rateLimit` with `storage: 'database'` for sign-in, sign-up and reset.
- New `rate_limits` table (drizzle migration) and `src/lib/server/services/rate-limit.ts` (fixed window, key = action + subject).
- Client IP from Netlify's `x-nf-client-connection-ip` via `getClientAddress`.
- Starting limits, kept in one config object:
  - Tips: 10/hour per device (signed cookie) and 100/hour per IP, so crowds on venue Wi-Fi are not blocked.
  - Petitions: 3/day per IP and 1/day per petitioner email.
  - Notes: 5 per 10 minutes per IP.
  - Flags: 20/hour per IP.
  - Scans: 60/minute per IP.
- Over-limit responses are form failures with a plain message, never silent drops.

2.4 **Artist email verification gate**
- Configure Better Auth `sendVerificationEmail` via Resend; keep `requireEmailVerification: false` so sign-in works immediately.
- Gate on `user.emailVerified`: publishing an Issue (Quick Issue and Bookbinder), all uploads, Stripe Connect onboarding.
- "Confirm your email to publish" bar with resend action (rate-limited).

2.5 **Stripe Radar** (manual, Stripe dashboard): enable a rule blocking cards after repeated failures; confirm the webhook secret is set on the production endpoint.

## Phase 3: Medium

3.1 **Webhooks** (`services/tips.ts`)
- Refund or dispute with no matching tip: return 500 so Stripe retries, rather than 200 `tip_not_found`.
- Record gross from `amount_received`; validate `artistId` metadata against the connected account on the event.
- Idempotency keys on `paymentIntents.create` and `checkout.sessions.create` (derived from a per-tap nonce).
- Replace check-then-insert with insert-on-conflict-do-nothing on `stripePaymentId`.

3.2 **Wall notes**: `submitNote` loads the Issue from the URL slug and uses its `artistId` and `id`; form values for these are ignored. General Wall derives the Artist from its own slug.

3.3 **Payout confirmation**: load only validates and shows the pending change; a POST action consumes the token after the Stripe calls succeed.

3.4 **Deployment target and headers**
- Replace `adapter-auto` with `@sveltejs/adapter-netlify`; add `netlify.toml` with the build command including `check-env`.
- Security headers in `hooks.server.ts`: CSP allowing self, Stripe.js, YouTube/Vimeo/Bandcamp frames, the R2 public domain; `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'` except the Full-Screen Case Display if it is ever embedded.

3.5 **Schema source of truth**: remove runtime DDL (`ensureSchemaTables`) from `seed.ts`; drizzle migrations are the only schema path, run in the Netlify build for both sites.

3.6 **Observability**
- `handleError` hook in `hooks.server.ts`: log with a request id, return a generic message.
- `/healthz` endpoint: checks DB reachability and reports feature flags (no secrets).
- Error tracking service (Sentry or similar) deferred; Netlify function logs are the launch baseline.

3.7 **Transactions**: wrap artist signup (user + artist rows) in a transaction; `flagWallNote` uses a single atomic `UPDATE ... SET flag_count = flag_count + 1` inside the same transaction as the flag insert.

## Phase 4: Low and operations

4.1 `.env.example` lists every variable the config module reads, including `DEMO_MODE`, Resend and Stripe publishable key; `.env` matches it.

4.2 **Demo deployment** (ADR 0007)
- Second Netlify site on a `demo.` subdomain with its own Turso database, `DEMO_MODE=true`, Stripe test keys, no Resend key.
- Persistent "You're in the Demo" banner on every page (layout primitive, no inline styles).
- Nightly reset via a Netlify scheduled function that re-runs migrations and the seed.

4.3 **Auth guard consolidation** (refactor, last): use `event.locals.user` from `hooks.server.ts`; add a `/dashboard` layout guard; remove per-route `getSession` calls.

## Phase 5: Verification

- `pnpm check`, `pnpm test`, `pnpm test:e2e`, `pnpm check:sizing` green.
- New e2e suite run against a production-mode preview: missing core key returns 503; each missing feature key shows its message; `/demo` is 404; GET `/logout` is 405; open-redirect payloads are rejected; malicious uploads are rejected.
- Add a git remote and re-run `npx commitshow audit .` for an external score.
- Deploy Demo first, then production.

## Out of scope

- Passwordless email link for Fans (after launch, decision 13).
- Scan Token binding and lifetime (accepted by decision 19).
- Flex/grid declaration review.
