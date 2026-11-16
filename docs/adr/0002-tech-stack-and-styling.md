# 2. Tech Stack and Styling Architecture

We use SvelteKit with Svelte 5 (Runes) and TypeScript, powered by Turso (libSQL) via Drizzle ORM and Better Auth. For styling, we strictly use hand-written vanilla CSS structured according to CUBE CSS (Composition, Utility, Block, Exception) and CSS layout primitives with native `@layer` (`vendor`, `base`, `layouts`, `components`, `sticker`, `bookbinder`, `utilities`), explicitly rejecting Tailwind and CSS-in-JS.

## Context & Trade-offs
- Svelte 5 Runes (`$state`, `$derived`, `$props`) provide predictable fine-grained reactivity, ideal for the swipeable Issue reader and live Bookbinder preview.
- Turso / libSQL and Drizzle offer edge-ready SQLite persistence with type-safe schema definitions.
- Better Auth supports both Artist credential login and Fan Google OAuth within a single unified `user` table.
- CUBE CSS enforces the dark glass aesthetic with custom design tokens (`--accent`, `--highlight`, `--support`, `--bg-void`, `--bg-surface`, `--ink`) while avoiding framework bloat and rigid utility class churn.
