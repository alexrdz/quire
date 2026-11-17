# Quire Engineering & Agent Instructions

This repository follows strict architectural rules and zero-compromise design standards.
All agents and contributors must adhere to:

1. [Architectural Laws & Core Invariants](file:///Users/alexrodriguez/Sites/quire/docs/AGENTS.md)
2. [CUBE CSS Architecture & Styling Rules](file:///Users/alexrodriguez/Sites/quire/.agents/rules/cube-css.md)
3. [Layout Primitives & Elemental Rules](file:///Users/alexrodriguez/Sites/quire/.agents/rules/layout-primitives.md)
4. [Clean Architecture Invariants](file:///Users/alexrodriguez/Sites/quire/.agents/rules/clean-architecture.md)

---

## Non-Negotiable Styling & Layout Directives

### 1. Zero Inline Styles Policy
- **No inline styles whatsoever** (`style="..."` or `style:...`) are permitted anywhere across templates, components, routes, or `app.html`.
- **Sole Exception**: Strictly runtime dynamic UI necessities and animations:
  1. Passing dynamic database-backed values into CSS custom properties (e.g., `style="--accent: {data.artist.accentColor};"`, `style="--cover-art: url('{data.artist.coverArtUrl}');"`).
  2. Real-time animations and playback progress (e.g., audio playback progress `style="width: {progress}%;"`, equalizer height custom properties `style="--h: 40%"`).
  3. Dynamic user swatches or avatars.
- **Static Styling Forbidden in Markup**:
  - [FORBIDDEN] `style="font-size: 0.85rem;"` -> Use semantic typography classes.
  - [FORBIDDEN] `style="font-weight: 700; text-transform: uppercase;"` -> Use utility/component classes.
  - [FORBIDDEN] `style="color: #FFFFFF;"` or `style="background: ..."` -> Use design token classes or stylesheet rules.
  - [FORBIDDEN] `style="display: contents;"` or `style="display: flex;"` -> Use `.app-shell` or layout primitives.
  - [FORBIDDEN] Static background image URLs -> Place in component `<style>` block.

### 2. Layout Intent First & Minimal DOM Nesting
- Never write ad-hoc `display: flex`, `display: grid`, or `margin-top` declarations.
- **No Superfluous Wrapper Soup**: Use the polymorphic `as` prop on layout primitives (`<Stack as="section">`, `<Box as="article">`, `<Cluster as="nav">`, `<Stack as="header">`) instead of nesting unstyled `<div>` or `<section>` tags around or inside layout primitives.
- Use the Elemental layout primitives in `$lib/components/layout`:
  - `<Stack>`: Vertical flow and sibling rhythm.
  - `<Cluster>`: Inline wrapping and alignment.
  - `<Center>`: Max-width measure centering.
  - `<Box>`: Padded container, borders, variants.
  - `<Grid>`: RAM auto-fit responsive grid.
  - `<Split>`: Asymmetric column ratio with collapse.
  - `<Switcher>`: Responsive row-to-stack switcher.
  - `<Cover>`: Viewport height pinning with header/footer.
  - `<Frame>`: Aspect ratio enforcement.
  - `<Reel>`: Horizontal scroll-snapped sequence.
  - `<Container>`: Page boundary wrapper.

### 3. CSS Logical Properties Only
- Use `inline-size` / `block-size` instead of `width` / `height`.
- Use `margin-inline` / `margin-block` instead of `margin-left` / `margin-right` / `margin-top` / `margin-bottom`.
- Use `padding-inline` / `padding-block` instead of `padding-left` / `padding-right` / `padding-top` / `padding-bottom`.
- Use `inset-inline-*` / `inset-block-*` instead of `left`, `right`, `top`, `bottom`.

### 4. Zero Emojis Policy
- **Never use emojis anywhere** across UI templates, components, routes, seed scripts, console logs, tests, or documentation.
- Emojis are amateurish and unprofessional. When visual iconography is required, use clean inline SVGs or typographic labels.
