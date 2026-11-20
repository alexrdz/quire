# Database migrations

Drizzle migrations are the only way Quire's schema is created or changed
(PRODUCTION_PLAN 3.5). The SQL lives in `drizzle/`, generated from
`src/lib/server/db/schema.ts`. Nothing at runtime writes DDL: `seedDatabase()`
only inserts data, and it stops with a `pnpm db:migrate` hint when the schema is
missing.

## Commands

| Command | What it does |
|---|---|
| `pnpm db:generate` | After editing `schema.ts`: writes the next SQL migration and snapshot into `drizzle/`. Commit both. |
| `pnpm db:migrate:local` | Applies pending migrations to the local `file:local.db` (development mode). |
| `pnpm db:migrate` | Applies pending migrations to the database for the current mode: `DATABASE_URL` / `DATABASE_AUTH_TOKEN` in the Demo and production. The production Netlify build runs it. |
| `pnpm db:migrate:preview` | The deploy-preview and branch-deploy build step. It skips unless a separate preview database is opted in (see below). |
| `pnpm db:baseline [--dry-run]` | Run once on a database created before migrations: see [Baselining](#baselining-a-database-created-before-migrations). |

`drizzle-kit push` is no longer a script: it changes the schema without recording
a migration, which is exactly what this rule removes.

## Local development

```sh
pnpm db:migrate:local   # creates or updates local.db
pnpm dev                # the sample data loads on the first request
```

If you have a `local.db` from before migrations, `pnpm db:migrate:local` stops
with a baseline hint. For a local database, the simplest fix is
`rm local.db && pnpm db:migrate:local`. To keep its data, run
`NODE_ENV=development pnpm db:baseline` instead.

Tests build their database the same way. Vitest's global setup
(`tests/setup/migrate-test-db.ts`) and the Playwright web server
(`pnpm db:migrate && pnpm preview`) both run the migrations on `local.db`.

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
by the old runtime DDL (`ensureSchemaTables` in `seed.ts`). They have every table
but no `__drizzle_migrations` rows. `db:migrate` on such a database stops with
this message instead of trying to create the tables again:

```
This database has tables but no migration history: it was created by the old runtime DDL. Run `pnpm db:baseline` once ...
```

`pnpm db:baseline` compares the live tables and columns (name, type, NOT NULL,
primary key) with the latest migration snapshot. If they match, it records every
migration as applied, writing the same rows drizzle's migrator writes, without
running any migration SQL or touching data. If they don't match, it refuses,
prints the differences and records nothing.

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
   Expected output:
   `schema matches 0004_venmo_tips; would record 5 migrations. Run again without --dry-run to record them.`
   The first line shows which database it's connected to (host only). Confirm it
   is the one you mean.
4. Record the migrations:
   ```sh
   pnpm db:baseline
   ```
   Expected: `recorded 5 migrations as applied. Next: pnpm db:migrate ...`
5. Confirm that migrations now have nothing to do:
   ```sh
   pnpm db:migrate
   ```
   Expected: `up to date (5 migrations)`
6. Clear the values: `unset DATABASE_URL DATABASE_AUTH_TOKEN`. Then repeat from
   step 1 for the other database (the Demo after production, or the other way
   round).

Running `pnpm db:baseline` again on a baselined database does nothing:
`this database already has a migration history`.

### If baseline refuses

Lines starting with `-` are tables or columns the migrations expect but the
database lacks. Lines with `+` are in the database but not in the migrations.
Lines with `~` are columns whose type, NOT NULL or primary key differ. Don't
work around it by inserting `__drizzle_migrations` rows by hand. Instead:

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
