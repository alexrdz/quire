# Quire Development Guide

See [AGENTS.md](file:///Users/alexrodriguez/Sites/quire/AGENTS.md) and [docs/AGENTS.md](file:///Users/alexrodriguez/Sites/quire/docs/AGENTS.md) for full architectural guidelines.

## Quick Reference Commands
- Build: `pnpm build`
- Type Check: `pnpm check`
- Unit Tests: `pnpm test`
- E2E Tests: `pnpm test:e2e`

## Core Styling & Layout Invariants
1. **Zero Inline Styles**: No inline styles (`style="..."` or `style:...`) anywhere in the application. The only exceptions are strictly runtime dynamic UI necessities (passing DB-backed custom properties like `--accent`, `--cover-art`, or dynamic progress/animations).
2. **CUBE CSS & Native `@layer`**: No Tailwind, no CSS-in-JS. Hand-written semantic CSS categorized into `@layer vendor, base, layouts, components, sticker, bookbinder, utilities;`.
3. **Layout Primitives**: Use `$lib/components/layout` (`<Stack>`, `<Cluster>`, `<Box>`, `<Grid>`, `<Center>`, `<Split>`, `<Switcher>`, `<Cover>`, `<Frame>`, `<Reel>`, `<Container>`).
4. **CSS Logical Properties**: Exclusively use `inline-size`, `block-size`, `padding-block`, `padding-inline`, `margin-block`, `margin-inline`, `inset-block-*`, `inset-inline-*`.
5. **Zero Emojis**: Never use emojis anywhere in UI templates, components, routes, seed scripts, console logs, tests, or documentation. Use clean inline SVGs or typographic labels.
