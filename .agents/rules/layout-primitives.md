# Layout Primitives (Elemental & Every Layout Rules)

This rule enforces layout-primitive thinking and exact Elemental primitive syntax across all markup, as prescribed by the `/elemental-layout-systems` skill.

## 1. Core Stance: Layout Intent First
Never begin styling with ad-hoc CSS declarations like `display: flex`, `grid-template-columns`, or `margin-top`. Identify what the interface is structurally trying to do and choose the corresponding primitive:

| Primitive | Layout Intent | Canonical Examples |
|---|---|---|
| `data-stack` | Vertical flow with consistent sibling rhythm | Form rows, article sections, card internals |
| `data-cluster` | Inline items that wrap naturally and align | Action rows, tag lists, toolbars, meta tags |
| `data-center` | Horizontal centering by readable text measure | Prose reading container, hero copy |
| `data-split` | Two competing regions with asymmetric ratio and collapse behavior | Sidebar + content, media + text |
| `data-switcher` | Equal panels switching between horizontal row and vertical stack based on container width | Pricing tiers, feature cards, recap stat tiles |
| `data-grid` | Responsive card grid based on minimum item width | Issue catalog, photo gallery, stub collections |
| `data-box` | Inset padding, bordered enclosure, background panel | Card shell, dark glass container, drawer content |
| `data-frame` | Fixed aspect ratio crop | Cover art container, photo embed, video facade |
| `data-reel` | Horizontally scrollable overflow sequence | Mobile zine page reader, sticker carousel |
| `data-imposter` | Centered floating overlay / modal | Drawer overlay, confirmation modal, tip bottom sheet |

## 2. Mandatory Rules

### No Inline Styles Across the Application
Zero inline styles are permitted across the application for layout or visual presentation:
- [FORBIDDEN] `style="display: flex; gap: 1rem;"` -> Use `<Cluster>` or `<Stack>`
- [FORBIDDEN] `style="max-width: 65ch; margin-inline: auto;"` -> Use `<Center max="measure">`
- [FORBIDDEN] `style="grid-template-columns: repeat(3, 1fr);"` -> Use `<Grid>` or `<Switcher>`
- [FORBIDDEN] `style="--stack-gap: 1.5rem;"` -> Use `gap="md"` / `gap="lg"` props
- [FORBIDDEN] `style="font-size: ...; font-weight: ...;"` -> Use CUBE CSS classes

### No Superfluous Wrapper Tags
- Never wrap layout primitives in redundant HTML tags or nest multiple primitives that perform the same job (e.g., `<section><Container><Center><Stack>`).
- Use the polymorphic `as` prop on layout primitives (`<Stack as="section">`, `<Cluster as="nav">`, `<Stack as="header">`, `<Box as="article">`) so the semantic HTML element IS the layout primitive.
- Never use emojis anywhere in markup or documentation; use SVG icons or clean typography.

The only permitted inline styles are strictly runtime dynamic UI necessities (passing dynamic database values to CSS custom properties like `style="--accent: ...;"` or real-time animations like audio progress bar `style="width: ...%;"`).

Express layout through:
1. Exact Elemental layout primitive components (`<Stack>`, `<Cluster>`, `<Box>`, `<Grid>`, `<Center>`, `<Split>`, `<Switcher>`, `<Cover>`, `<Frame>`, `<Reel>`, `<Container>`).
2. Exact Elemental `data-*` attribute syntax when writing raw HTML.
3. Official modifier tokens (`gap:md`, `padding:sm`, `justify:between`, `align:center`, `collapse:md`).

### Exact API Syntax & Modifiers
Use the exact primitive attributes and modifier tokens:
- **Stack**: `<div data-stack="gapm alignstretch">`
- **Cluster**: `<div data-cluster="gapsm justifybetween aligncenter">`
- **Center**: `<div data-center="maxmeasure paddingsm">`
- **Split**: `<div data-split="13 gapmd collapsemd">`
- **Switcher**: `<div data-switcher="gapmd collapsemd limit3">`
- **Grid**: `<ul data-grid="minmd gapmd">`
- **Box**: `<div data-box="paddingm">`
- **Frame**: `<div data-frame="ratio1">` (or `ratio169`)
- **Reel**: `<div data-reel="snapcenter gapmd">`

### Audit First, Patch Second
When inspecting or fixing UI:
1. Infer layout intent before editing.
2. Identify why current markup or CSS fails (e.g. ad-hoc flex, margin hacks).
3. Select the simplest primitive that expresses the intent.
4. Remove redundant CSS that becomes obsolete after primitive adoption.
