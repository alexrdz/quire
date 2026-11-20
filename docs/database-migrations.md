# Database migrations

Drizzle migrations are the only way Quire's schema is created or changed
(PRODUCTION_PLAN 3.5). The SQL lives in `drizzle/`, generated from
`src/lib/server/db/schema.ts`. Nothing at runtime writes DDL: `seedDatabase()`
only inserts data, and it stops with a migrate hint when the schema is missing
(`pnpm db:migrate:local` in development, `pnpm db:migrate` elsewhere).

## Commands

| Command | What it does |
|---|---|
| `pnpm db:generate` | After editing `schema.ts`: writes the next SQL migration and snapshot into `drizzle/`. Commit both. |
| `pnpm db:migrate:local` | Applies pending migrations in development mode: to `DATABASE_URL`, which defaults to `file:local.db`. |
| `pnpm db:migrate` | Applies pending migrations to the database for the current mode: `DATABASE_URL` / `DATABASE_AUTH_TOKEN` in the Demo and production. The production Netlify build runs it. |
| `pnpm db:migrate:preview` | The deploy-preview and branch-deploy build step. It skips unless a separate preview database is opted in (see below). |
| `pnpm db:baseline [--dry-run] [--to <migration>] [--allow-extra <table>,...]` | Run once on a database created before migrations: see [Baselining](#baselining-a-database-created-before-migrations). |

`drizzle-kit push` is no longer a script: it changes the schema without recording
a migration, which is exactly what this rule removes.

## Local development

```sh
pnpm db:migrate:local   # creates or updates local.db
pnpm dev                # the sample data loads on the first request
```

In development use `pnpm db:migrate:local`, not `pnpm db:migrate`. Without
`NODE_ENV`, `pnpm db:migrate` runs in production mode, against whatever
`DATABASE_URL` is set. When the dev server finds no schema, its error says the
same.

Keep `DATABASE_URL=file:local.db` (or leave it empty) for development.
`pnpm dev` and `pnpm db:migrate:local` both use `DATABASE_URL` from `.env` when
it is set. If `.env` points it at a remote Turso database (a `libsql://` URL),
possibly production, the dev server reads and writes that database, and
`db:migrate:local` migrates it. To make that hard to do by accident:

- `pnpm dev` logs one warning at startup naming the remote host (never the token).
- Development never seeds sample data into a remote database. The first request
  logs `[seed] Not seeding sample data: DATABASE_URL looks like a remote database ...`
  instead, and `pnpm db:seed` refuses with the same message.
- `QUIRE_DEV_REMOTE_DB=true` says you mean to develop against a remote
  database (a personal Turso dev database, say). It only changes the messages:
  the warning still shows, and sample data is still never seeded into it.

The Demo is different on purpose: it runs in Demo mode and seeds its own remote
database.

If you have a `local.db` from before migrations, `pnpm db:migrate:local` stops
with a baseline hint. For a local database, the simplest fix is
`rm local.db && pnpm db:migrate:local`. To keep its data, run
`NODE_ENV=development pnpm db:baseline` instead (the same flags as below), then
`pnpm db:migrate:local`.

Tests build their database the same way. Vitest's global setup
(`tests/setup/migrate-test-db.ts`) and the test-mode Playwright web server
(`pnpm db:migrate && pnpm preview`) both run the migrations on `local.db`. The
Demo- and production-mode Playwright servers migrate their own fresh file
databases in the OS temp directory (see [e2e-local-preview.md](e2e-local-preview.md)).

## Netlify builds

`netlify.toml` uses a different build command per context.

| Context | Command | Migrates? |
|---|---|---|
| `production` (the live site, and the Demo site's live deploy) | `check:env`, `db:migrate`, `build` | Yes. If the migration fails, the build and the deploy fail, and the previous deploy stays live. |
| `deploy-preview`, `branch-deploy`, and any other context | `check:env`, `db:migrate:preview`, `build` | Only with a separate preview database |

Deploy previews run unmerged code. By default they get the same `DATABASE_URL`
as production, so a preview must never migrate it. With no opt-in, the preview
build logs this and continues:

```
[db:migrate] skipped: context deploy-preview: no PREVIEW_DATABASE_URL, so this build never migrates the production database. ...
```

A preview that runs with the production database still reads it with the
preview's code. A preview whose branch adds a migration will break until the
migration lands. Use a preview database for those branches.

### Opting in to a preview database

1. Create a separate Turso database for previews (for example `quire-preview`)
   and a token for it.
2. In Netlify (Site configuration, then Environment variables), give
   `DATABASE_URL` and `DATABASE_AUTH_TOKEN` different values for the
   "Deploy Previews" and "Branch deploys" contexts. Those values point at the
   preview database. Keep the production values as they are.
3. Add `PREVIEW_DATABASE_URL`, scoped to the same two contexts, with the same URL
   as the preview `DATABASE_URL`.

The preview build then migrates the preview database. If `PREVIEW_DATABASE_URL`
and `DATABASE_URL` differ in a preview context, the build fails, so a preview
never migrates one database while running against another. Never set
`PREVIEW_DATABASE_URL` for the production context.

## Baselining a database created before migrations

The Demo database, the production database and older dev databases were created
by the old runtime DDL (`ensureSchemaTables` in `seed.ts`). They have the tables
of whichever version of that DDL built them, but no `__drizzle_migrations` rows. `db:migrate` on such a database stops with
this message instead of trying to create the tables again:

```
This database has tables but no migration history: it was created by the old runtime DDL. Run `pnpm db:baseline` once ...
```

`pnpm db:baseline` compares the live tables and columns (name, type, NOT NULL,
primary key) with the snapshot drizzle-kit saved for each migration
(`drizzle/meta/NNNN_snapshot.json`). It finds the newest migration the database
matches exactly. It then records that migration and every earlier one as
applied, writing the same rows drizzle's migrator writes, without running any
migration SQL or touching data. `pnpm db:migrate` then applies the later
migrations. If no migration matches, it refuses, prints the differences against
the closest one and records nothing. Indexes are not compared.

A database the old DDL built before `0003_rate_limits` matches
`0002_schema_catch_up`. Baseline records `0000`–`0002`, and `db:migrate` adds
`0003` (rate limits) and `0004` (Venmo tips). A database built after the Venmo
change matches `0004_venmo_tips`, and `db:migrate` then has nothing to apply.

| Flag | Effect |
|---|---|
| `--dry-run` | Prints the plan and writes nothing. |
| `--to <migration>` | Requires a match with that migration (tag such as `0002_schema_catch_up`, or just `0002`) instead of the newest match. It still has to match exactly. |
| `--allow-extra <table>[,<table>]` | Ignores the named tables, which must be in no Quire migration. Without it, any such table makes baseline refuse. |

**Tables that aren't Quire's.** A database can hold tables Quire never created,
such as a `posts` table from another app. Baseline never drops, changes or reads
them. By default it refuses and lists them as `+ table posts`, so nothing
unexpected is ignored silently. If the table belongs to something else, pass
`--allow-extra posts`. Baseline then ignores it, and so does `db:migrate`, since
no migration touches it. `--allow-extra` refuses a table that is Quire's (one a
migration creates), because ignoring it would hide a half-built schema.

**When:** once per pre-existing database. Do it for the production database and
for the Demo database before the first deploy that runs `db:migrate`, which is the
first production deploy after this change merges. If a deploy runs first, it
fails at `db:migrate` with the hint above. Nothing changes in the database, the
previous deploy stays live, and you can baseline and then redeploy.

### Steps (production and Demo, one database at a time)

You need a checkout of this repository at the commit being deployed, with
`pnpm install` done, plus the database's URL and a token. Get them from Netlify
(Site configuration, then Environment variables: `DATABASE_URL` and
`DATABASE_AUTH_TOKEN`) or from Turso (`turso db show <name> --url` and
`turso db tokens create <name>`).

1. Back up the database:
   ```sh
   turso db shell <name> .dump > quire-<name>-backup.sql
   ```
2. Put the values in your shell, typed at hidden prompts so they stay out of
   your shell history and out of any file:
   ```sh
   read -r  -p 'DATABASE_URL: ' DATABASE_URL && export DATABASE_URL
   read -rs -p 'DATABASE_AUTH_TOKEN: ' DATABASE_AUTH_TOKEN && echo && export DATABASE_AUTH_TOKEN
   ```
3. Check first, without writing anything:
   ```sh
   pnpm db:baseline --dry-run
   ```
   The first line shows which database it's connected to (host only). Confirm it
   is the one you mean. The output names the migration the database matches and
   what `db:migrate` will apply afterwards. For a database from before the rate
   limits, with another app's `posts` table, it looks like this:
   ```
   [db:baseline] refused: the schema does not match any migration; closest is 0002_schema_catch_up. Nothing was recorded.
   + table posts (in the database, not in the migrations)
   [db:baseline] posts is in no Quire migration. If it belongs to something else, add --allow-extra posts to leave it untouched.
   ```
   If the only `+` lines are tables you know aren't Quire's, add them:
   ```sh
   pnpm db:baseline --dry-run --allow-extra posts
   ```
   ```
   [db:baseline] schema matches 0002_schema_catch_up; will record 0000–0002; db:migrate then applies 0003, 0004
   [db:baseline] still to apply with pnpm db:migrate: 0003_rate_limits, 0004_venmo_tips
   [db:baseline] ignored, left untouched (not Quire's): posts
   [db:baseline] dry run: nothing was written. Run again without --dry-run to record 3 migrations.
   ```
   A database that already has the Venmo tables shows
   `schema matches 0004_venmo_tips; will record 0000–0004; db:migrate then has nothing to apply`.
   Any other `-`, `+` or `~` line: see [If baseline refuses](#if-baseline-refuses).
4. Record the migrations, with the same flags but without `--dry-run`:
   ```sh
   pnpm db:baseline --allow-extra posts
   ```
   Expected: `schema matches 0002_schema_catch_up; recorded 0000–0002; ...` and
   `recorded 3 migrations as applied. Next: pnpm db:migrate.`
5. Apply the rest:
   ```sh
   pnpm db:migrate
   ```
   Expected: `applied 2 of 5 migrations` (or `up to date (5 migrations)` for a
   database that matched `0004`). Running it again prints `up to date`. The next
   production deploy's `db:migrate` would also apply them. Running it here first
   means the deploy finds nothing to do.
6. Clear the values: `unset DATABASE_URL DATABASE_AUTH_TOKEN`. Then repeat from
   step 1 for the other database (the Demo after production, or the other way
   round).

Running `pnpm db:baseline` again on a baselined database does nothing:
`this database already has a migration history`.

### If baseline refuses

The diff is against the closest migration (or the one `--to` named). Lines
starting with `-` are tables or columns that migration expects but the database
lacks. Lines with `+` are in the database but not in that migration. Lines with
`~` are columns whose type, NOT NULL or primary key differ. A `+ table` that
isn't Quire's can be passed to `--allow-extra` (above). For anything else, don't
work around it by inserting `__drizzle_migrations` rows by hand, and don't use
`--to` to pick a migration that doesn't match. Instead:

- **The Demo database:** its data is sample data. Create a fresh empty database
  (or empty this one), point the Demo site at it, and let the deploy run
  `db:migrate`. The Demo seeds itself on the first request.
- **The production database:** stop and send the diff to the developers. The
  database needs a reviewed SQL fix before it can be baselined.

## Changing the schema

1. Edit `src/lib/server/db/schema.ts`.
2. Run `pnpm db:generate` and review the new SQL in `drizzle/`.
3. Run `pnpm db:migrate:local` and `pnpm test`. A unit test fails if `schema.ts`
   and `drizzle/` ever disagree, because `drizzle-kit generate` would find
   changes.
4. Commit `schema.ts` with the new `drizzle/` files. The production deploy applies them.
