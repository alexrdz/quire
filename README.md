# B1-T16 e2e traces (never merged)

These are traces and logs from two failures that each happened once in 20 fresh-DB full e2e runs on `test/wall-endpaper-isolation` (PR #40). Neither came back in the 10 runs after. They're kept here in case either spec fails again.

- `fluid-landing-70/`: `tests/e2e/fluid-landing.spec.ts:70`, "enlarged landing text reflows without clipping core content". The assertion at line 80 received `{ top: true, bottom: false }`.
- `demo-banner-63/`: `tests/e2e/demo/demo-banner.spec.ts:63`, "the Full-Screen Case Display carries the compact banner". At line 68, `locator.click` timed out after 30000ms.

Open a `trace.zip` at https://trace.playwright.dev. Each `full-run.log` is the whole run's output, including the server's.
