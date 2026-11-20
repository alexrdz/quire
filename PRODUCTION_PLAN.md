# Quire Production Remediation Plan

Source: `PRODUCTION_AUDIT.md` (2026-11-18), verified against the code the same day.
Decisions: `docs/CONTEXT.md` (decisions 13, 27, 29-31) and `docs/adr/0007-separate-demo-deployment-and-no-production-fallbacks.md`.

> **Pivot 2026-11-18: tips moved from Stripe to direct Venmo links (ADR 0008).** Stripe code stays but is dormant. Stripe-only items below are marked *Parked* or *Changed*; the new work is **Phase V** (between Phase 2 and Phase 3). Phase 1 and Phase 2 land as written.

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

**Status (2026-11-18): 2.1-2.4 done on `prod/phase-2` (PR into `prod/phase-0`); 2.5 pending with the user (Stripe dashboard).** `pnpm check`, `pnpm test` (285), `pnpm check:sizing`, `pnpm build` and `pnpm test:e2e` (16) green. Notes for later phases:
- One redirect checker: `isSafeRedirectPath` / `resolveSafeRedirect` in `src/lib/schemas/auth.ts`. It checks the raw value and the value after up to three rounds of percent-decoding. Any new redirect parameter must go through it.
- `/logout` has no GET handler (SvelteKit answers 405). Sign-out controls are `<form class="signout-form">` with a `redirectTo` hidden field where needed.
- All limits live in `RATE_LIMITS` (`src/lib/server/services/rate-limit.ts`). Keys are `action:HMAC(subject)` with `COOKIE_SECRET`, so raw IPs and emails are never stored. Rotating `COOKIE_SECRET` resets every counter and every tip device cookie.
- Better Auth's own limiter only covers HTTP calls to `/api/auth`; the login, signup and reset form actions call `auth.api.*` directly, so they are limited by the same numbers through `rate-limit.ts` (`signInIp`, `signUpIp`, `passwordResetIp`). Better Auth stores its counters in `auth_rate_limits` (model `authRateLimit`), is off in `test` mode, and reads the client IP from `x-nf-client-connection-ip` (3.4 must keep Netlify as the edge so that header is trustworthy).
- Verification resend: 3 per hour per artist (`verificationResendUser`), also applied to Better Auth's `/send-verification-email`.
- Expired `rate_limits` rows are pruned every 200 checks; if the limiter's database call fails, the request is allowed and the error logged (a fan at a gig keeps the page).
- `drizzle/0002_schema_catch_up.sql` brings the migrations in line with `schema.ts`, which had drifted: it adds `payout_change_tokens`, `slug_petitions`, `artists.account_status`/`closed_at` (by rebuilding `artists`, whose `tip_presets_json` default also changed), `issues.archived_at`, `tips.status`/`refunded_at`, and 30 missing indexes. Drizzle-kit's generated `INSERT INTO __new_artists ... SELECT` also listed `account_status` and `closed_at`, which the old table did not have, so the migration failed; both columns were removed from that statement and they take their defaults. Verified: a fresh migrate of 0000-0002 succeeds and `drizzle-kit generate`/`push` against the `prod/phase-0` schema report no drift; the same holds for 0000-0003 against this branch's schema. Not safe on a database `ensureSchemaTables` created: 0002 has no `IF NOT EXISTS` and fails on `payout_change_tokens already exists`, but so does 0000 (`accounts already exists`). Migrations and runtime DDL are separate schema paths today; 3.5 has to pick migrations and baseline any existing database.
- `0003_rate_limits.sql` adds only `rate_limits` and `auth_rate_limits`.
- `seed.ts` `ensureSchemaTables` creates both new tables until 3.5 removes runtime DDL.
- Email confirmation gate helpers live in `src/lib/server/email/verification.ts`. The bar is `EmailConfirmBar.svelte`, rendered by the new `dashboard/+layout.svelte`; resend posts to `/dashboard?/resendVerification` (the settings page keeps its own resend, sharing the same helper and limit). Disconnecting payouts is not gated.
- 4.3 (auth guard consolidation) can move the per-route `emailVerified` checks into the dashboard layout guard, but the action-level checks must stay.
- e2e: `tests/e2e/helpers/db.ts` clears `rate_limits` before the logout spec, because every e2e request comes from 127.0.0.1 and counters persist in `local.db` between runs. The scan spec's expired sample Stamp Window is fixed in Phase 1 (`seed.ts`), not here.
- 2.5 (Stripe Radar rule and production webhook secret) is with the user.

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

2.5 *Parked (ADR 0008, Stripe dormant).* **Stripe Radar** (manual, Stripe dashboard): enable a rule blocking cards after repeated failures; confirm the webhook secret is set on the production endpoint.

## Phase V: Venmo tips (pivot, ADR 0008)

Lands after Phase 2. Two PRs, in this order: V-A (Dwight), then V-B (Jim).

**V-A status (2026-11-18): done on `prod/venmo-a` (PR into `main`).** On a fresh `local.db`: `pnpm check` 0 errors, `pnpm test` 364/364, `pnpm check:sizing`, `pnpm build` and `pnpm test:e2e` 16/16 all pass.
- V.1: `STRIPE_DORMANT` in `config.ts` means `live.payments` is never true and no Stripe key is required in any mode. `check-env` reports Stripe as dormant and `.env.example` marks `STRIPE_*` optional. `/api/webhooks/stripe` returns 404 for every method; the old handler stays compiling as `_dormantStripeWebhookHandler`. The Stripe Connect UI and actions are gone from `/dashboard/settings`, while `services/tips.ts`, `payments/stripe.ts`, the `tips` table and the Stripe columns stay. A public flag `tipsOpenVenmo` (on `PublicFeatures`, so pages read `data.features.tipsOpenVenmo`) is true only in production.
- V.2: migration `0004_venmo_tips` adds `artists.venmo_username`, `tip_taps` (indexed on artist_id, issue_id; no Fan identity) and `venmo_change_tokens` (SHA-256 hash, 1 hour, single use via `used_at`). It is a new table rather than a reuse of `payout_change_tokens`, whose `action` enum and Stripe target belong to the dormant flow. The seed gives the sample Artist `@quire-sample-band` and 8 taps across three Issues and General. `$domain/venmo` has `parseVenmoUsername`, `buildVenmoPayUrl`, `buildVenmoProfileUrl`, `formatVenmoAmount` and `tipNote`. Checked against venmo.com: the pay link `venmo.com/<u>?txn=pay&amount=&note=` redirects to account.venmo.com with the query kept, and the public profile is `venmo.com/u/<u>`.
- V.3: `services/venmo.ts` plus `saveVenmo` / `removeVenmo` on Settings. First set needs only a confirmed email (the 2.4 gate moved here) and works with email off. A change or removal needs the password, is rate-limited (`venmoChange`, 3 per hour per Artist, counted before the password check), and emails a link to `/dashboard/settings/confirm-venmo`. The page load only inspects the token; the POST claims it atomically (`used_at` from NULL) and applies it, then a notice email follows. A new request replaces an earlier unconfirmed link. With email off, changes are blocked with "We can't send email right now". "Test your link" opens Venmo only in production; elsewhere it shows the URL. `/dashboard/settings/confirm-payout` is **redirected** (303) to Settings, not deleted, so old emails still land somewhere useful.
- Notes for V-B: `features.payments` is false in production now, so the old tip UI in `/a/[slug]` and `/i/[slug]` stays hidden until V.4 replaces it. Copy still mentioning Stripe (ArtistTopNav "Settings & Payouts", the dashboard's "Stripe Connect Onboarding Pending", home, FAQ, terms) is V.5. Existing dev databases keep working (runtime DDL adds the new tables and column), but they only get the sample username and taps after `rm local.db`.

**Status V-B (2026-11-18): V.4 and V.5 done on `prod/venmo-b`, stacked on V-A (`prod/venmo-a`).** `pnpm check`, `pnpm test` (398), `pnpm check:sizing`, `pnpm build` and `pnpm test:e2e` (18) green on a fresh database, rebased on V-A 07c6ff1. Notes for later phases:
- The tip button is `src/lib/components/tips/VenmoTipPanel.svelte`, rendered inline on the Cover (`/i/[slug]`, id `tip`) and the Back Page (`/a/[slug]`). It shows only when the Artist has a `venmo_username` and is not closed. Hero and floating triggers are plain `#tip` links, so the buttons work without JavaScript. The old Stripe `tip` form actions, the tip drawers and the `payments` FeatureNotice are gone from both pages.
- Production (`features.tipsOpenVenmo`): each amount is a real `<a href>` built with `buildVenmoPayUrl(username, amount, tipNote(artistName))`, so the Fan's own tap opens Venmo. The tap is reported with `navigator.sendBeacon` (fallback `fetch` with `keepalive`) and never awaited. Demo, development and tests: buttons, no `href`, never navigate; the tap is recorded and the Fan sees "In the Demo, this would open Venmo to pay $5 to @username." The would-be URL is in `data-venmo-url`.
- `/api/tip-tap` (POST JSON `{ artistSlug, issueSlug | null, amountCents }`) goes through `services/tip-taps.ts` `recordTipTap`, which never throws. Ids come only from the slugs; ids sent by the client are ignored. Not recorded: invalid input (400), unknown or closed Artist, Artist without Venmo, draft or another Artist's Issue (404), double tap (200, `duplicate`), over the limit (429), database failure (503).
- Double taps: the client ignores a second tap on the same amount within 2 seconds (no second Venmo open, no second beacon). The server counts one tap per device, button and amount within 3 seconds (`tipTapRepeat`, a sliding window via `claimOnceWithin` in `rate-limit.ts`), before the hourly limits, so a double tap does not use them up.
- Rate limits are the Phase 2 tip limits, moved from the checkout action: `tipDevice` 10/hour per signed device cookie and `tipIp` 100/hour per IP, counted independently.
- Dashboard: Gig Recap, gig list and General row show `countTipTaps` counts ("14 tip taps") with "Check Venmo for what came in." The per-tip ledger, gross, fees, net, payouts and reversals are removed. Launchpad step 3 is "Add your Venmo" (complete when `venmo_username` is set), and the Stripe onboarding callout is now an "Add your Venmo" callout. `amount_selected_cents` is stored but never shown or summed.
- Copy: home ("Your Venmo QR collects tips. Quire brings the people too."), FAQ, terms and privacy no longer mention Stripe, cards, the 5% fee, payouts or refunds through Quire. The landing simulator no longer shows a payment confirmation. Tests guard all of this (`tests/unit/routes/venmo-copy.test.ts`).
- Left for later: the dormant Stripe `tips` table, services and schemas are untouched (V-A keeps Stripe dormant). The settings and confirm-payout pages belong to V-A.

V.1 **Stripe dormant** (V-A)
- Stripe code, `tip` table and Stripe columns stay; nothing reaches them. No Stripe key is a core setting or feature flag requirement in any mode; `check-env` and config stop requiring them. `/api/webhooks/stripe` returns 404. No page or setting links to Stripe Connect.
- The `payments` tier-2 flag no longer gates tips. Config exposes a public `tipsOpenVenmo` flag, true only in production; the Demo, development and tests never open Venmo.
- The 2.4 email gate on Stripe Connect onboarding moves to setting the Venmo username.

V.2 **Venmo schema** (V-A, pushed first so V-B can build on it)
- `artists.venmo_username` (nullable), `tip_taps` (id, artist_id, issue_id NULL = General, amount_selected_cents, created_at; no Fan identity), and a pending-change token table for Venmo changes (single-use, hashed, expiring). One drizzle migration; the seed gives the sample Artist a sample username and some sample taps.

V.3 **Venmo username setup and change** (V-A; subsumes 3.3)
- `/dashboard/settings`: one field, validated (5 to 30 chars of letters, numbers, `-`, `_`; leading `@` stripped), "Test your link", setup copy (Quire takes no cut; Venmo expects a business profile for goods and services).
- First set: confirmed email required (2.4), nothing else. Change or remove: password re-entry, then a Resend link to the account email; the old username stays live until confirmed. The confirm page load only shows the pending change; a POST action consumes the token and applies it. A notice email follows the change. Email off: changes blocked with "We can't send email right now".

V.4 **Tip button and Tip Taps** (V-B)
- Tip buttons show only when the Artist has a Venmo username. Presets $2 to $500, USD.
- A tap records a Tip Tap (rate-limited with the 2.3 tip limits) and opens Venmo with amount and note `Tip for <Artist name> via Quire` (no venue, city or date). Recording is best-effort: over the limit or on failure, Venmo still opens and the tap isn't counted. Venmo opens only from the tap; no automatic redirect.
- Demo, development and tests: record the tap, never open Venmo, show "In the Demo, this would open Venmo to pay $5 to @username."

V.5 **Dashboard and copy** (V-B)
- Gig Recap, gig list and General row show tip-tap counts only, labeled as taps, with "Check Venmo for what came in." No dollar figures, fees, net or payouts anywhere. Studio Launchpad step 3 becomes "Add your Venmo".
- Public copy (home, FAQ, terms, privacy): Quire doesn't process payments and takes no cut; tips go through Venmo under Venmo's terms; Venmo payments may be public depending on the Fan's Venmo settings.

Acceptance: unit tests for username validation, the change flow (password, token single-use and expiry, GET doesn't consume, notice email), tap recording and rate limits, Venmo URL building, and the Demo intercept; e2e for a tap in test mode (tap recorded, Venmo not opened) and the dashboard showing taps without dollar amounts.

## Phase 3: Medium

3.1 *Parked (ADR 0008, Stripe dormant): revisit only if Stripe is revived.* **Webhooks** (`services/tips.ts`)
- Refund or dispute with no matching tip: return 500 so Stripe retries, rather than 200 `tip_not_found`.
- Record gross from `amount_received`; validate `artistId` metadata against the connected account on the event.
- Idempotency keys on `paymentIntents.create` and `checkout.sessions.create` (derived from a per-tap nonce).
- Replace check-then-insert with insert-on-conflict-do-nothing on `stripePaymentId`.

3.2 **Wall notes**: `submitNote` loads the Issue from the URL slug and uses its `artistId` and `id`; form values for these are ignored. General Wall derives the Artist from its own slug.
*Done (P3M-T01).* Both pages resolve the Wall from `params.slug` only (`resolveIssueWall`, `resolveGeneralWall`); unknown and draft Issues are 404, archived Issues and closed Artists 403, and no note is written. Both `flagNote` actions pass that Wall to `flagWallNote`, which rejects a note from another Issue, Artist or Wall as `NOTE_NOT_FOUND` (404).

3.3 *Changed: done as part of V.3 for the Venmo username change.* ~~**Payout confirmation**: load only validates and shows the pending change; a POST action consumes the token after the Stripe calls succeed.~~

3.4 **Deployment target and headers**

**Status (2026-11-19): done on `prod/p3-deploy-observability` (PR into `main`, together with 3.6).**
- **Adapter and build:**
  - `@sveltejs/adapter-netlify` ^6.0.4: 7.x needs SvelteKit 3. It runs as one Node function, no edge, no split.
  - `netlify.toml` runs `pnpm check:env && pnpm build`, publishes `build`, and pins Node 22. `package.json` pins `packageManager: pnpm@9.15.9`.
  - The same file gives CDN-served static files `nosniff` and the referrer policy, since they never reach the hook.
- **Headers:**
  - `hooks.server.ts` wraps `handle`, so every response gets the CSP, `nosniff` and `strict-origin-when-cross-origin`. That includes `/api/auth/*`, the 503 page, the email-off JSON and a crash inside the hook.
  - The CSP is built at runtime in `src/lib/server/http/security-headers.ts`, because `R2_PUBLIC_URL` is a deploy variable. Config exposes its origin as `mediaOrigin`, independent of the R2 keys.
  - `kit.csp` (mode `auto`) owns only `script-src`, adding its hydration nonce; the hook keeps it and rewrites every other directive. Scripts never get `'unsafe-inline'`; styles do, for the runtime custom-property attributes.
- **Allowances beyond the original list:**
  - `frame-src 'self'` plus `frame-ancestors 'self'` on `/i/*` only, for the Bookbinder's live reader preview. Every other path is `'none'`.
  - `https://*.bandcamp.com`, which the reader embeds.
  - `images.unsplash.com` in every mode: the landing page's Zine Simulator uses it in production.
  - `blob:` for image and media previews.
  - `ws:`/`wss:` in development for Vite.
  - `form-action` includes `accounts.google.com`; an e2e test proves Chrome follows the no-JS 303 to Google.
  - Arbitrary video-file URLs in `video` pages outside R2 are now blocked by `media-src`.
- **Function bundle:** zipped as Netlify does with zip-it-and-ship-it on linux-x64 dependencies: 25.0 MB zipped, 60 MB unzipped. It holds `@img/sharp-linux-x64` and `sharp-libvips-linux-x64`, plus the musl variants (about 19 MB unzipped, unused on Netlify), and `@libsql/linux-x64-gnu`. That is about half of Netlify's 50 MB zipped limit, which closes the Phase 1 bundle-size note.
- Replace `adapter-auto` with `@sveltejs/adapter-netlify`; add `netlify.toml` with the build command including `check-env`.
- Security headers in `hooks.server.ts`: CSP allowing self, YouTube/Vimeo/Bandcamp frames (no Stripe.js; Venmo is a plain link and needs no CSP entry), the R2 public domain; `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'` except the Full-Screen Case Display if it is ever embedded.

3.5 **Schema source of truth**: remove runtime DDL (`ensureSchemaTables`) from `seed.ts`; drizzle migrations are the only schema path, run in the Netlify build for both sites.

3.6 **Observability**

**Status (2026-11-19): done with 3.4 (same PR).**
- `handleError` logs `[error] id=<id> status=<n> <METHOD> <path>` plus the error. The query string is never logged, since it can carry scan keys and confirmation tokens. It returns `{ message: 'Something went wrong.', id }`; a 404 returns `Page not found.` and logs one line with no stack.
- The id is Netlify's `x-nf-request-id` when it looks like an id, otherwise a random UUID. `handle` sets it on `locals.requestId`, and the new root `+error.svelte` shows it as a reference.
- `GET /healthz` returns `{ ok, mode, core, db, features }` with `no-store`. `core` is `ok` or `invalid`, `db` is `ok` or `down`, and `features` holds the public flags. It returns 200 when healthy and 503 when the DB query (`select 1`, 3 s timeout) fails or core config is invalid; with invalid core config the DB is never queried.
- `hooks.server.ts` sends `/healthz` straight to the route, with no auto-seed, no session lookup and no 503 page. No secrets, env values, config issue names or user data are returned.
- `handleError` hook in `hooks.server.ts`: log with a request id, return a generic message.
- `/healthz` endpoint: checks DB reachability and reports feature flags (no secrets).
- Error tracking service (Sentry or similar) deferred; Netlify function logs are the launch baseline.

3.7 **Transactions**: wrap artist signup (user + artist rows) in a transaction; `flagWallNote` uses a single atomic `UPDATE ... SET flag_count = flag_count + 1` inside the same transaction as the flag insert.
*Done (P3M-T01).* `flagWallNote` runs the flag insert and one `flag_count = flag_count + 1` UPDATE (auto-hide as a SQL `CASE` on `FLAG_AUTO_HIDE_THRESHOLD`) as one libsql batch, which commits atomically; the existing unique `(note_id, fan_user_id)` index makes a repeat flag roll the batch back as `ALREADY_FLAGGED`. A batch, not `db.transaction`: interactive libsql transactions hold the write lock across round trips, so concurrent flags failed with `SQLITE_BUSY`. Signup: Better Auth creates the user outside our handle, so `createArtistForNewUser` inserts the artist and template page in one batch and, if it fails, deletes the new user with its sessions and accounts (compensating delete).

## Phase 4: Low and operations

4.1 `.env.example` lists every variable the config module reads, including `DEMO_MODE` and Resend (Stripe variables listed as dormant and optional, ADR 0008); `.env` matches it.
*Done (P4L-T01).* `.env.example` lists all 22 variables `config.ts` reads (`drizzle.config.ts` reads only `DATABASE_URL` and `DATABASE_AUTH_TOKEN`, and `check-env.ts` reads through `parseConfig`). They are grouped as Mode, Core (required in demo and production), Features and a dormant Stripe group, with empty values only. `NODE_ENV` and `VITEST` are set by the tooling and stay commented out. `tests/unit/server/env-example.test.ts` records the names the code actually reads, across every mode, and fails on a missing or unknown variable. The user's own `.env` and the Netlify settings still need to be checked against it by hand.

4.2 **Demo deployment** (ADR 0007)
- Second Netlify site on a `demo.` subdomain with its own Turso database, `DEMO_MODE=true`, no Stripe keys, no Resend key. Tip buttons never open Venmo there (ADR 0008).
- Persistent "You're in the Demo" banner on every page (layout primitive, no inline styles).
  *Done (P4L-T02).* `DemoBanner` renders in the root layout (so the error page has it too) and as a compact variant in the Full-Screen Case Display, only when `features.mode` is `demo`. It sits in the page flow as a labelled `aside`. Unit tests render each page in every mode. The 360px no-overlap e2e runs against `DEMO_BASE_URL` and is skipped until P4L-T03 adds a local Demo-mode preview. The sign-up link waits for the production URL.
- Nightly reset via a Netlify scheduled function that re-runs migrations and the seed.

4.3 **Auth guard consolidation** (refactor, last): use `event.locals.user` from `hooks.server.ts`; add a `/dashboard` layout guard; remove per-route `getSession` calls.
*Done (P4L-T04).* `src/lib/server/guards.ts` adds `requireArtist` (loads; redirects to `/login?redirect=` with the safe-redirect rules), `requireArtistAction` (actions; 401 signed out, 403 without an active Artist), `requireFan`, `requireFanPage` and `optionalUser`, all reading locals only. `auth.api.getSession` is now called only in `hooks.server.ts` (`resolveSessionLocals`). The `/dashboard` layout guard is defense in depth: every dashboard load and action still calls its own guard, because layout loads skip actions and run in parallel. `tests/unit/routes/auth-guards.test.ts` enumerates every exported action and dashboard load.

## Phase 5: Verification

- `pnpm check`, `pnpm test`, `pnpm test:e2e`, `pnpm check:sizing` green.
- New e2e suite run against a production-mode preview: missing core key returns 503; each missing feature key shows its message; `/demo` is 404; GET `/logout` is 405; open-redirect payloads are rejected; malicious uploads are rejected. A tip tap opens a `venmo.com` link with the right username, amount and generic note, and no Stripe key is required.
- Add a git remote and re-run `npx commitshow audit .` for an external score.
- Deploy Demo first, then production.

## Out of scope

- Passwordless email link for Fans (after launch, decision 13).
- Scan Token binding and lifetime (accepted by decision 19).
- Flex/grid declaration review.
