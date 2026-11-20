> Superseded for launch by `docs/PRE-LAUNCH-AUDIT.md` (2026-11-20), which classifies every finding below against `main`.

The external engine couldn't audit Quire. `npx commitshow@0.3.23 audit .` exited with `bad_target` because the repo has no git remote, and `--no-network` gave the same error. So there is no score or delta. The findings below come from my own read of the server code, routes, schema and config.

> Note 2026-11-18: payments later moved from Stripe to direct Venmo links (ADR 0008). Stripe findings here are historical; see the Phase V notes in `PRODUCTION_PLAN.md`.

The CLI wrote `.commitshow/audit.json` (the error) and `audit.stderr.log`. I didn't edit `.gitignore` or any app code. I didn't run `pnpm test` or `pnpm check`. I did run `pnpm check:sizing`, and it passed.

## Blockers

- **[Auth] `/demo` signs anyone in as a demo account in production.**
  - `routes/demo/+server.ts` has no environment guard. It calls `seedDatabase()` and then `createSessionForUser` for `the-neon-velvet` (artist) or `maya@example.com` (fan).
  - `seedDatabase()` is also called from the `/login` load and its login, signup and petition actions. Nothing in it checks `NODE_ENV`, and `hooks.server.ts` guards only its own seeding call.
  - The seeded artist has the hardcoded password `neonvelvet123`.
  - The `googleSignIn` action in `login/+page.server.ts` and the `googleAuth` action in `(zine)/i/[slug]/+page.server.ts` log the caller in as Maya whenever the Google keys are unset.
  - Confirmed in code.
- **[Secrets] Auth and attendance signing keys fall back to hardcoded strings.**
  - `auth.ts` uses `BETTER_AUTH_SECRET || 'quire_development_secret…'`, and `stamping.ts` uses `COOKIE_SECRET || 'quire_attendance_hmac…'`.
  - If either variable is missing in production, anyone can forge session cookies or stamp tokens.
  - The app doesn't fail on startup when they're missing. Your local `.env` sets both. I can't verify the production host.
- **[Uploads] Stored XSS through uploaded files.**
  - `storage.ts` `resolveSafeExtension` takes the file extension from the client's filename, and the MIME type also comes from the client. A file named `x.html` sent as `image/png` is saved as `/uploads/<uuid>.html` and served from your own origin when R2 isn't configured.
  - SVG uploads are also allowed.
  - Artist signup is open and doesn't require email verification.
  - Confirmed in code. On R2 with a separate public domain, the impact is smaller.

## High

- **[Auth] Open redirects and GET logout.**
  - `/demo?redirect=` and `/logout?redirect=` pass the value straight to `redirect()`. The existing `safeRedirectPathSchema` isn't used there.
  - `logout` accepts GET, so any page can sign users out.
  - `safeRedirectPathSchema` rejects `//` but not `/\`, which browsers treat as `//`.
- **[Abuse] No rate limiting anywhere.**
  - Login, signup, password reset, slug petitions, scan and tip creation have none.
  - The tip action lets unauthenticated visitors create unlimited Stripe PaymentIntents, which enables card testing.
  - Petitions send email to arbitrary addresses.
  - better-auth's own limiter may cover its handler, but I didn't verify that.
- **[Payments] Mock tips are recorded when Stripe isn't configured.**
  - `createTipCheckout` in `tips.ts` inserts a `succeeded` tip with a `mock_pi_` ID if `STRIPE_SECRET_KEY` is missing.
  - This is the same kind of config-dependent risk as the hardcoded secrets.
- **[Auth] Email verification is off.** `requireEmailVerification: false` in `auth.ts`. This pairs with the open upload and signup paths above.
- **[Email] Production email delivery isn't configured.**
  - Your `.env` has no `RESEND_API_KEY`. The dev fallback in `email/index.ts` then logs the full email body to server logs. That includes verification, reset and payout-confirmation links.
  - Without the key, no user receives those emails.

## Medium

- **[Webhook] Stripe webhook gaps in `tips.ts`.**
  - A `charge.refunded` or dispute event that arrives before `payment_intent.succeeded` returns 200 with `tip_not_found`. Stripe won't retry, so the reversal is lost.
  - Idempotency is a check-then-insert on `stripePaymentId`. The unique constraint makes a race return 500 and Stripe retries, so that part recovers.
  - The recorded amount and `artistId` come from metadata, not from `amount_received`.
  - `paymentIntents.create` and `checkout.sessions.create` have no idempotency keys.
- **[Wall] `submitNote` trusts form values.**
  - `artistId` and `issueId` come from the form and aren't checked against the issue in the URL slug. A note can land on another artist's wall.
  - The closed and archived checks use the slug, not the supplied IDs.
- **[Stamps] Attendance tokens are long-lived and not tied to a user.**
  - `claimStampForFan` never re-checks the 48-hour window. The cookie lasts 30 days, and the token can be copied between users.
  - The scan secret `k` travels in the URL query string, so it appears in access logs.
- **[Payouts] Confirmation token is consumed on a GET load.**
  - In `confirm-payout/+page.server.ts` the token is consumed before the Stripe check. A link prefetcher or a Stripe error burns it.
- **[Deploy] Deployment target and file storage.**
  - `adapter-auto` doesn't pin a deployment target.
  - Uploads fall back to local `static/uploads`, which doesn't survive on serverless hosts.
  - `seed.ts` creates tables with raw SQL at runtime alongside drizzle migrations, so schema drift is possible. I didn't verify this.
- **[Headers] No security headers or CSP.** The zine page embeds YouTube, Vimeo and Bandcamp iframes.
- **[Observability] No error handling or monitoring.** There is no `handleError`, no health endpoint, no error tracking, and only two `console.error` calls.
- **[Data] Multi-step writes aren't in transactions.**
  - Signup creates the user, then the artist, and rolls back manually.
  - `flagWallNote` inserts the flag and then updates the count, so concurrent flags can race.

## Low

- **[Privacy] Photos keep their EXIF data.** `sharp` isn't installed, so `optimizeRasterImageBuffer` passes images through unchanged, including GPS metadata.
- **[Config] `.env` and `.env.example` don't match.** `.env` has `STRIPE_CLIENT_ID`. `.env.example` has `STRIPE_PUBLISHABLE_KEY` and the Resend variables.
- **[Structure] Auth checks are repeated per route.** Each load and action calls `getSession` itself, and `event.locals.user` from `hooks.server.ts` is never used. There is no layout-level guard for `/dashboard`.
- **[Secrets] No leaked secrets.** `.env` and `local.db` are gitignored and never appear in the git history.
- **[Rules] AGENTS.md compliance is mostly clean.**
  - The only static `style=` attributes are the `--h` equalizer custom properties, which the exception allows.
  - There are no emojis.
  - I counted 145 `display: flex/grid` declarations in component styles and CSS layers. Whether they break the "never ad-hoc flex/grid" rule depends on how you read it.
