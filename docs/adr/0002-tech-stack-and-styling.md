# 2. Tech Stack and Styling Architecture

We use SvelteKit with Svelte 5 (Runes) and TypeScript, powered by Turso (libSQL) via Drizzle ORM, Better Auth, direct Venmo tip links (Stripe Connect Express dormant, ADR 0008), Resend transactional email, and Cloudflare R2 media storage. For styling, we strictly use hand-written vanilla CSS structured according to CUBE CSS (Composition, Utility, Block, Exception) and CSS layout primitives with native `@layer` (`vendor`, `base`, `layouts`, `components`, `sticker`, `bookbinder`, `utilities`), explicitly rejecting Tailwind and CSS-in-JS.

## Context & Trade-offs
- Svelte 5 Runes (`$state`, `$derived`, `$props`) provide predictable fine-grained reactivity, ideal for the swipeable Issue reader and live Bookbinder preview.
- Turso / libSQL and Drizzle ORM offer edge-ready SQLite persistence with type-safe schema definitions and zero-friction local SQLite development.
- Better Auth supports both Artist credential login and Fan Google OAuth within a single unified `user` table.
- Tips go directly to the Artist's Venmo through prefilled Venmo links; Quire takes no cut and records Tip Taps only (ADR 0008). *Superseded: Stripe Connect Express with a 5% platform `application_fee_amount`; that code is dormant.*
- Resend powers transactional emails for Artist email verification, password resets, and shared-account Venmo username change confirmation (`SPEC.md` Section 6.4).
- Cloudflare R2 provides S3-compatible object storage with zero egress fees for gig photography and cover art.
- CUBE CSS enforces the dark glass aesthetic with custom design tokens (`--accent`, `--highlight`, `--support`, `--bg-void`, `--bg-surface`, `--ink`) while avoiding framework bloat and rigid utility class churn.
