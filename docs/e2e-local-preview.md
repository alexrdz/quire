# Local Demo- and production-mode e2e servers

The Demo and production modes need a remote Turso database and real secrets
(ADR 0007), so neither mode could run in the local e2e gate. One narrow
exception in `src/lib/server/config.ts` lets them run locally, and
`playwright.config.ts` starts a server for each (P4L-T03).

## What `pnpm test:e2e` runs

`pnpm build` first. Then `pnpm test:e2e` starts three servers on the same build
and runs three Playwright projects. No Docker and no network.

| Project | Port | Mode | Database | Specs |
|---|---|---|---|---|
| `chromium` | 4173 | test | `local.db`, migrated | `tests/e2e/` except the two folders below |
| `demo-mode` | 4174 | demo (`DEMO_MODE=true`) | `<tmp>/quire-e2e/demo.db`: deleted, migrated, then seeded by the Demo on its first request | `tests/e2e/demo/` |
| `production-mode` | 4175 | production (`NODE_ENV=production`) | `<tmp>/quire-e2e/production.db`: deleted and migrated, never seeded | `tests/e2e/production/` |

`<tmp>` is the OS temp directory, so nothing is written into the repository. The
Demo and production servers set `QUIRE_E2E_LOCAL_PREVIEW=true`, a `file:`
`DATABASE_URL` and `BETTER_AUTH_URL=http://localhost:<port>`.

To run against an existing server instead: `PLAYWRIGHT_BASE_URL` for the test-mode
project, and `DEMO_BASE_URL` for the Demo project (for example the Demo site).
The matching local server is then not started. To run one project only:
`pnpm test:e2e --project demo-mode`.

## The guarded exception

With `QUIRE_E2E_LOCAL_PREVIEW=true`, the Demo and production modes accept a
`file:` `DATABASE_URL` with no auth token. They also use fixed test values for
`BETTER_AUTH_SECRET` and `COOKIE_SECRET` when those are unset. Every other rule
stays: a secret that is set is still checked, the app URL is still required,
features without keys are still off in production, and `/demo` is still 404 in
production.

The flag is honored only when all of these hold:

- `DATABASE_URL` starts with `file:`;
- `NETLIFY` is unset;
- `CONTEXT` and `DEPLOY_URL` are unset.

Netlify sets `NETLIFY`, `CONTEXT` and `DEPLOY_URL` on every build and function.
A variable that is present but empty still counts as set. If any condition
fails, the flag is ignored, the server logs why (variable names only, never
values), and the normal fail-closed rules apply. A Demo or production server
with a file database then serves the 503 page.

`pnpm check:env` fails the build whenever the flag is set and a guard fails,
for example with a remote `DATABASE_URL` or on Netlify. Never set the flag on a
deployed site. `.env.example` lists it under "Test only, never set on a deployed
site".

While the flag is set, the app does not load `.env`, so a developer's remote
database or R2 keys never reach an e2e server.

The guard and the `check:env` refusal are covered by
`tests/unit/server/local-preview.test.ts`.
