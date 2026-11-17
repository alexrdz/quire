# 6. Route Groups Scope the Site Footer to Non-Zine Pages
The shared site footer (links, Terms, Privacy, FAQ, Support) renders on every page except the Issue zine. Scope is set by SvelteKit route groups: `src/routes/(site)/` has a layout that wraps its pages in a `Cover` shell and renders `SiteFooter`. `src/routes/(zine)/` holds `i/[slug]` and has no footer. Route groups do not change URLs, so printed QR codes keep working.
## Context & Trade-offs
- **Why not a path check in the root layout:** `{#if !page.url.pathname.startsWith('/i/')}` is easy to forget when a new zine route is added and couples the layout to URL strings. A route group makes the rule structural.
- **Cost:** Route files moved one directory deeper, and unit tests that import route modules by path were updated.
- **Full-height pages:** Pages no longer set their own `min-block-size: 100vh`. The `site-shell` Cover variant (`layouts.css`) makes the page grow to fill the viewport and pins the footer beneath it, so short pages do not leave the footer a screen below the content.
- **New zine-like routes** (full-screen, swipe-based, or chrome-free) belong in `(zine)`. Everything else belongs in `(site)`.
- **Legal copy** lives in `src/routes/(site)/legal/` and the entity name, support address and revision date are constants in `src/lib/components/site/footer-links.ts`.
