# The Demo site

The Demo is a second Netlify site built from this same repository (ADR 0007).
It runs with `DEMO_MODE=true`:

- It has sample data, and `/demo` signs visitors in as the sample Artist.
- It has its own Turso database and its own secrets.
- It never sends email.
- Tip buttons never open Venmo (ADR 0008).
- Every page carries the "You're in the Demo" banner.
- Every night a scheduled function empties its database and reseeds the sample data.

This page is the setup runbook. Steps marked **you** happen in Turso, Netlify or
your DNS provider; nothing in the repo needs to change.

## What is different from production

| | Production | Demo |
|---|---|---|
| `DEMO_MODE` | unset | `true` |
| Database | the production Turso database | its own Turso database |
| `BETTER_AUTH_SECRET`, `COOKIE_SECRET` | production values | **different** values |
| `BETTER_AUTH_URL` | `https://<domain>` | `https://demo.<domain>` |
| `RESEND_API_KEY` | set | **not set** (the Demo never sends email anyway) |
| `STRIPE_*` | not set (dormant, ADR 0008) | not set |
| R2 keys | the production bucket | optional: a **separate** demo bucket, or none |
| `PUBLIC_PRODUCTION_URL` | not set | `https://<domain>` (the banner's sign-up link) |
| Nightly reset | the function is deployed but does nothing | empties and reseeds the database |

## 1. Create the Demo database (you, in Turso)

```sh
turso db create quire-demo
turso db show quire-demo --url          # the DATABASE_URL, libsql://...
turso db tokens create quire-demo       # the DATABASE_AUTH_TOKEN
```

Keep the token out of your shell history and out of any file. Paste it straight
into Netlify in step 3. Don't reuse the production database or its token.

## 2. Create the second Netlify site (you, in Netlify)

1. Netlify, then **Add new site**, then **Import an existing project**. Pick the same
   GitHub repository and the `main` branch. `netlify.toml` supplies the build
   command and publish directory; leave those fields as detected.
2. Name the site, for example `quire-demo`.
3. **Domain management**, then **Add a domain**: `demo.<domain>`. At your DNS
   provider, add the record Netlify shows for it, usually a `CNAME` from `demo`
   to `<site-name>.netlify.app`. Wait for Netlify to issue the HTTPS certificate.

## 3. Set the environment variables (you, in Netlify)

Site configuration, then **Environment variables**, on the Demo site. Scope each
one to all contexts. Every name is in `.env.example`.

| Variable | Value |
|---|---|
| `DEMO_MODE` | `true` |
| `DATABASE_URL` | the `libsql://` URL from step 1 |
| `DATABASE_AUTH_TOKEN` | the token from step 1 (mark it secret) |
| `BETTER_AUTH_SECRET` | new: `openssl rand -hex 32`. Not the production value. |
| `COOKIE_SECRET` | new: `openssl rand -hex 32` again. Not the production value, and not `BETTER_AUTH_SECRET`. |
| `BETTER_AUTH_URL` | `https://demo.<domain>` |
| `PUBLIC_PRODUCTION_URL` | `https://<domain>`, optional: the banner links to its sign-up page. Unset means no link. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | optional, see [Uploads](#uploads) |

Do **not** set `RESEND_API_KEY`, any `STRIPE_*`, `PREVIEW_DATABASE_URL` or
`QUIRE_E2E_LOCAL_PREVIEW`. If `QUIRE_E2E_LOCAL_PREVIEW` is set, `pnpm check:env`
fails the build.

## 4. First deploy

Trigger a deploy (Deploys, then **Trigger deploy**). The production context runs
`pnpm check:env && pnpm db:migrate && pnpm build`:

- `check:env` prints `mode: demo` and fails the build if a core value is missing
  or invalid. Fix the variable it names and deploy again.
- `db:migrate` creates the schema in the empty database
  (`applied 5 of 5 migrations` or similar). A fresh database needs no baseline.
- The first request seeds the sample data. Open `https://demo.<domain>/`: the
  banner is there, and `/demo` signs you in as the sample Artist.

Check `https://demo.<domain>/healthz`. It should return `"ok": true` and `"mode": "demo"`.

If the Demo database was created before migrations (by the old runtime DDL),
`db:migrate` stops with a baseline hint. Because the Demo holds only sample
data, the simplest fix is a fresh database (`turso db destroy quire-demo`, then
step 1 again). [database-migrations.md](database-migrations.md) has the
baseline alternative.

## Nightly reset

`netlify/functions/demo-reset.mts` is a Netlify scheduled function that runs
every day at 09:00 UTC. In demo mode it:

1. applies any pending migrations;
2. deletes every row from every app table in one transaction, children before
   parents (the migration history in `__drizzle_migrations` is kept);
3. runs the seed, so the sample Artist, Fan and Issues are back as new.

The function is part of the repo, so **it is deployed on the production site
too**. There it checks the mode first, logs one line and returns without loading
the database:

```
[demo-reset] skipped: mode is production, not demo. The reset only runs on the Demo site; nothing was touched.
```

Unit tests prove this (`tests/unit/server/demo-reset.test.ts`). Scheduled
functions have no public URL; they run only on their schedule or from the
Netlify UI.

### Checking that it ran (you, in Netlify)

On the Demo site: **Logs**, then **Functions**, then `demo-reset`. The function
shows its schedule and next run. After a run its log has one line:

```
[demo-reset] done: cleared 21 tables (143 rows), applied 0 of 5 migrations, reseeded in 812 ms.
```

The numbers vary. A failure logs `[demo-reset] failed: <reason>` and the run
returns 500. If the rows were deleted but the seed failed, the Demo seeds itself
again on its next page request.

To run it now, use **Run now** on the same page. On the production site the
same page should only ever show the `skipped` line.

## Uploads

Netlify functions can't keep files: the disk is read-only and is thrown away
after each request. So the local `static/uploads` stand-in that development and
the local e2e Demo use can't work on the Demo site.

- **No R2 keys (the default):** uploads are off in the Demo. Upload fields are
  disabled and say "Uploads are turned off in this Demo. You can still paste an
  image URL or embed." Nothing fails with a 500.
- **With R2 keys:** uploads go to R2. Use a **separate bucket** for the Demo
  (for example `quire-demo-media`), never the production bucket. Set
  `R2_BUCKET_NAME` and `R2_PUBLIC_URL` to that bucket. The nightly reset deletes
  the database rows but not the files, so add an R2 lifecycle rule that deletes
  objects after a day or two.

The rule lives in `config.ts`: uploads count as "on Netlify" when `NETLIFY`,
`CONTEXT` or `DEPLOY_URL` is set (`runningOnNetlify`).

## Deploy order

Deploy the Demo first, then production (PRODUCTION_PLAN 4.2). Both sites build
from `main`; a merge deploys both.
