# CUBE CSS Architecture & Styling Rules

This rule enforces the styling methodology and constraints for Quire.

## 1. Core Principles
- **No Tailwind CSS and No CSS-in-JS.** Hand-written, semantic CSS only.
- **CUBE CSS Methodology**:
  - **Composition**: Flexible layout containers that handle flow and spacing without prescribing child styles.
  - **Utility**: Single-purpose helper classes that apply specific properties (e.g., text truncation, visually hidden).
  - **Block**: Specific components and visual wrappers (e.g., ticket stub, drawer, cover note).
  - **Exception**: State-driven overrides applied via `data-*` attributes (e.g., `data-state="active"`, `data-variant="invert"`).

## 2. Native `@layer` Hierarchy
All CSS is structured across modular files imported into native CSS layers:
```css
@layer vendor, base, layouts, components, sticker, bookbinder, utilities;
```
1. **`vendor`**: Third-party resets, embedded players, and web component styles (e.g., `youtube-lite` / `lite-youtube`), ensuring external CSS has lower cascade priority than application components and utilities.
2. **`base`**: Resets, accessibility skip links, typography scales, root CSS custom properties.
3. **`layouts`**: Macro layout containers (grid systems, split-screens, swipeable zine containers).
4. **`components`**: Visual UI elements (buttons, modals, drawers, ticket stubs, card frames).
5. **`sticker`**: Print-ready and screen vector sticker QR layouts and physical presentation styles.
6. **`bookbinder`**: Split-screen desktop workbench and mobile device mockup frame styling.
7. **`utilities`**: Pure utility classes with highest specificity override within the cascade.

## 3. Design Tokens & Color System (Dark Glass Aesthetic)
- Platform-wide locked tokens:
  - `--highlight`: Mint green (`#01FFC3`) (dates, active selection, stamp verification).
  - `--support`: Pink / Magenta (`#FF2A6D`) (tipping buttons, financial highlights).
  - `--bg-void`: Deep dark background (`#090710`).
  - `--bg-surface`: Elevated card/panel background (`#151124`, with glass panel variants e.g. `rgba(21, 17, 36, 0.6)` with backdrop blur).
  - `--ink`: Crisp light/white typography for dark canvas (e.g. `#FFFFFF` / high-contrast zinc `#F4F4F5`).
- Dynamic artist token:
  - `--accent`: Electric cyan / neon blue (`#05D9E8` default), the only color customizable by the Artist (contrast-checked against dark canvas).

## 4. Logical Properties
Always use CSS logical properties instead of directional properties:
- `inline-size` / `block-size` instead of `width` / `height`
- `margin-inline` / `margin-block` instead of `margin-left`/`right`, `margin-top`/`bottom`
- `padding-inline` / `padding-block` instead of `padding-left`/`right`, `padding-top`/`bottom`
- `inset-inline-*` / `inset-block-*` instead of `top`, `bottom`, `left`, `right`

## 5. Strict Prohibition on Inline Styles
- **No inline styles whatsoever** (`style="..."` or `style:...` directives) are permitted anywhere across templates, components, routes, or `app.html`.
- **Sole Exception**: Runtime dynamic UI necessities and animations:
  1. **Dynamic CSS Custom Property Bindings**: Passing runtime database values into CSS variables (e.g., `style="--accent: {data.artist.accentColor};"`, `style="--cover-art: url('{data.artist.coverArtUrl}');"`).
  2. **Dynamic Animation & Playback States**: Real-time progress values (e.g., audio playback progress bar `style="width: {progress}%;"`, equalizer height variables `style="--h: 40%"`).
  3. **Runtime User Swatches**: Dynamic user-generated gradients or avatars (e.g., `style="background: {user.color};"`).
- **Static Styling Forbidden in Markup**:
  - ❌ `style="font-size: 0.85rem;"` -> Use semantic typography classes.
  - ❌ `style="font-weight: 700; text-transform: uppercase;"` -> Use utility/component classes.
  - ❌ `style="color: #FFFFFF;"` or `style="background: ..."` -> Use design token classes or stylesheet rules.
  - ❌ `style="display: contents;"` or `style="display: flex;"` -> Use `.app-shell` or layout primitives.
  - ❌ Static background image URLs -> Place in component `<style>` block.
- All static layout, typography, borders, and colors must strictly live in CUBE CSS stylesheet layers (`@layer layouts`, `@layer components`, `@layer utilities`) or Elemental layout primitives (`<Stack>`, `<Cluster>`, `<Box>`, `<Grid>`, etc.).
