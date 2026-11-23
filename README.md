# B1-T24 traces (never merged, no code)

`tests/e2e/fluid-landing.spec.ts:70` ("enlarged landing text reflows without clipping core content") failed in 2 of 3 fresh-DB full e2e runs on fix/portrait-video-tape (B1-T20, based on main 5b4f989). Both runs failed the same way, at line 80: `expect(bounds).toEqual({ top: true, bottom: true })` received `{ top: true, bottom: false }`.

Each `runN/` holds:
- `trace.zip`: open with `pnpm exec playwright show-trace runN/trace.zip`
- `error-context.md`: Playwright's error and page snapshot
- `full-run.log`: the whole `CI=1 playwright test --trace=retain-on-failure` run

In the same runs, `production/feature-messages.spec.ts:122` also failed; #45 fixes it, and it is not included here.
