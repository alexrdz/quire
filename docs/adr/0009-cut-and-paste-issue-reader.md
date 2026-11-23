---
status: superseded by ADR 0011 (2026-11-23)
date: 2026-11-20
---

# 9. Cut-and-Paste Issue Reader

An Issue should feel like a zine someone made by hand after the gig, not like a page of an app. Until now the Issue reader used the same dark glass style as the rest of Quire (decision 16), and Issues read as flat and lifeless.

The Issue reader (`/i/[slug]`: Cover, content pages, Wall and Endpaper, plus the Bookbinder preview, which renders the same pages) gets a **cut-and-paste on dark** look. Everything else in Quire keeps the dark glass house style: the landing page, sign-in, the dashboard, the Bookbinder editor, Quick Issue and the Back Page.

This amends decision 16 for the Issue reader only. Artists still change only cover art, a contrast-checked `--accent` and a type pairing. `--highlight` and `--support` stay fixed.

## The look

- **Dark paper, not glass.** Pages keep the dark palette (`--bg-void`, `--ink`), with a fine photocopy grain and slight paper texture. No frosted glass panels inside an Issue.
- **Things are stuck on.** Photos are polaroids (`PhotoPile`, every photo page). Cards, setlists and notes are paper scraps that sit at a small resting tilt and are held down with tape strips or stickers.
- **Tilts are deterministic.** Like `pileTilt`, every tilt comes from the item's position, so every reader sees the same page. Nothing about the layout is stored.
- **Two accent faces.** A typewriter face for labels, setlists, dates and captions, and a marker face for short handwritten touches (a circled song, "was there", stamps). The Artist's type pairing still sets the headings and body text. Both accent faces are open-licensed and self-hosted as `woff2` under `static/fonts`, which the existing CSP (`default-src 'self'`) allows.
- **Pages turn.** Moving between pages has a short page-turn or slide motion.
- **Kinds look like what they are.** A setlist is a typed sheet with a torn edge, audio is a cassette label, video is a screen taped to the page, Wall notes are notes pinned or taped up, and the Endpaper is the back cover with the Stamp as an ink stamp.

## Rules

- **Readability wins.** Body text, setlists, notes and every control are never tilted beyond what keeps them easy to read (at most about 2 degrees for text), and all text meets WCAG AA contrast on its scrap. Decoration never covers text or a control.
- **The tip stays obvious.** Texture and tape never make the Cover's Venmo tip buttons harder to see or tap. Tap targets stay at least 44 by 44 px.
- **Reduced motion.** With `prefers-reduced-motion: reduce`, page turns, flips and tosses become instant or fades.
- **Phones first.** It must hold at 320 px wide with no horizontal scroll, and textures must not slow a phone on venue Wi-Fi: grain and paper are CSS or small inline SVG, with no large images. The accent fonts are subset, and the page still renders with fallbacks while they load (`font-display: swap`).
- **House rules still apply** (`CLAUDE.md`): CUBE CSS in the existing `@layer` order, layout primitives, logical properties, no inline styles except runtime custom properties (tilt, depth, `--accent`), and no emojis. Stickers and stamps are inline SVG or type, never emoji.

## Considered options

- **Full photocopy zine** (light paper, black ink, halftone photos). Rejected for now: it breaks with the rest of Quire, and bright pages are harsh in a dark venue.
- **Keep dark glass and add motion only.** Rejected: motion alone doesn't make it feel handmade.

## Consequences

- The Issue reader is split into one component per page kind, so the style work can be done one part at a time.
- Screens in the UI prototype that show glass panels inside an Issue no longer describe the reader. Decision 17 still applies: decisions beat the prototype.
