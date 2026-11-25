---
status: accepted
date: 2026-11-23
---

# 11. Stories Issue Reader

**Supersedes ADR 0009.** The cut-and-paste reader (tape, grain, tilted scraps, polaroids, typewriter and marker fonts) read as amateurish and campy, and so did the editorial overhaul proposed in PR #43. The Issue reader must look as modern and professional as Instagram and TikTok.

An Issue is read as **Stories**: one full-screen page at a time, the Artist's photo or video filling the phone, and a tap to move on. The look is quiet and confident: real content edge to edge, clean type, and very little chrome. Nothing pretends to be paper, tape, a cassette, a ticket or a rubber stamp.

This applies to `/i/[slug]` and to the Bookbinder preview, which renders the same components. The rest of Quire keeps its current style for now.

## Navigation

- **One page at a time, full screen.** The reader fills the viewport (`100dvh`, safe-area insets respected). On a wide screen it is a centred phone-width column (at most 480 px) on `--bg-void`, with Prev and Next buttons beside it.
- **Progress bar.** A row of thin segments at the top, one per page (each photo of a photo page is its own segment). Done segments are full, the current one is highlighted, and the rest are dim.
- **Tap to move.** A tap on the right two-thirds of the page goes forward, and a tap on the left third goes back. A horizontal swipe does the same, and so do the arrow keys. A tap that starts on a control (a button, link, input, video or audio control, the Tip bar or a sheet) never moves the page, and neither does a drag or a scroll.
- **No auto-advance.** Pages wait for the Fan. Nothing moves on a timer.
- **Accessible paging.** Real Prev and Next buttons exist for keyboard and screen-reader users: the Next button sits in the bottom bar, and Prev appears on focus. A page change announces "Page 3 of 7" politely and moves focus to the page heading.
- **The place is kept.** The current page is in the URL hash (with `replaceState`, so Back still leaves the Issue), and a refresh opens the same page.
- **Motion.** A short horizontal slide or crossfade, at most 250 ms. With `prefers-reduced-motion: reduce`, pages change instantly.

## Chrome

- **Header**, over the top of every page: the progress bar; then the Artist's avatar (cover art or initials), the Artist name, "City · Date" in small type, and a Close button that goes to the Artist's page.
- **Bottom bar**, on every page except the Cover: a **Tip** pill in `--support` (opens the tip sheet), a **Wall** button with the note count (opens the Wall sheet), and **Next**. When the Artist has no Venmo username, only the Tip pill is hidden.
- **Scrims.** Any text over a photo or video sits on a dark gradient that guarantees WCAG AA contrast whatever the image is.
- **Sheets.** The tip sheet and the Wall open as bottom sheets, like Instagram comments: a grab handle, rounded top corners, swipe down or tap outside to close, focus trapped while open, and Escape closes.

## Pages

- **Cover.** Full-bleed cover art with a scrim. The Artist name is large, then venue, city and date, and the Cover note. The tip presets show as pills right on the Cover (decision 4: tip-first), then one primary button, "Open tonight's zine".
- **Photo.** *Amended 2026-11-25 by the product owner:* photo pages keep the polaroid stack. The photos sit as a stack of polaroids, centred on the dark page, with the page title and text under it. Swipe the top one away to see the next, tap a captioned one to flip it and read the caption, and restack at the end. A single photo is one polaroid that flips if it has a caption. The stack owns its own swipes and taps, so they never change the page; taps outside it, Next and the arrow keys still do. A photo page is one segment of the progress bar. The polaroids' slight resting tilt is the one exception to "no tilts" below.
- **Video.** An uploaded clip fills the page, plays muted and inline when the page opens, and pauses when the Fan leaves it, with a clear unmute button. YouTube, Vimeo and Bandcamp embeds sit centred at their own ratio on black and never autoplay.
- **Audio.** The cover art large and centred, the track title, and a clean player: a 56 px play button, a scrubber and the time.
- **Setlist.** A clean typographic list on a dark page: numbered songs, with an "Encore" divider. It scrolls inside the page when it is long.
- **Text.** A readable article page: heading, body at a comfortable size, at most 65 characters per line, and inner scroll when long.
- **Wall.** The Wall sheet (from the bottom bar) and a Wall page near the end. Notes look like modern comments: initials avatar, name, a small "Was there" badge, the text, time ago, and the Artist's reply indented under it with an "Artist" label. A composer is pinned at the bottom, and Flag lives in a "more" menu.
- **Endpaper.** The last page: "That's the zine." Save and Stamp as two clear buttons. A Stamped Issue shows a clean confirmation card (a check icon, "Stamped", venue and date), not an ink stamp. Then links to the Artist's page and My Stubs.

## Type and colour

- **One UI typeface:** the system font stack (San Francisco on iPhone, Roboto on Android). It is what Instagram and TikTok feel like, and it downloads nothing. The Artist's type pairing (sans-serif, serif or mono) still sets page headings and the Cover title only.
- **Colour:** `--bg-void` pages, white text, `--accent` (the Artist's, contrast-checked) for the progress bar and primary buttons, `--support` for the Tip pill and `--highlight` for "Was there" and Stamped. No other colours, textures or glows.
- **Shape:** radius 12 px on cards and buttons, 999 px on pills, 20 px on sheet tops. No tilts, rotations, torn edges, tape, grain, paper texture, drop-shadowed "stuck on" items or frosted glass.

## Rules

- Tap targets are at least 44 by 44 px, and all text meets WCAG AA.
- It holds at 320 px wide with no horizontal scroll, and on desktop in the centred column.
- No new font files. The Special Elite and Permanent Marker fonts are removed.
- House rules still apply (`CLAUDE.md`): CUBE CSS in the existing `@layer` order, layout primitives, logical properties, no inline styles except runtime custom properties, and no emojis.

## Considered options

- **Vertical feed, swipe up (TikTok and Reels).** Rejected: it's harder to show where you are in an Issue, and an Issue is a short, finite set of pages, not an endless feed.
- **One long scrolling page.** Rejected: simpler, but it reads as a web page, not an app.
- **The editorial overhaul in PR #43.** Rejected by the product owner.
- **Keep ADR 0009's cut-and-paste look.** Rejected by the product owner.

## Consequences

- `Scrap`, `Tape`, `Stamp`, `TypeLabel`, `zineTilt` and the accent fonts are removed. `PhotoPile` and its toss and flip stay (amended 2026-11-25). Specs that check the ADR 0009 look are replaced by specs for this one.
- Decision 16's 2026-11-20 amendment now points to this ADR.
