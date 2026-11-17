# Agent Instructions & Non-Negotiable Boundaries

All AI agents, subagents, and contributors working on **Quire** must strictly adhere to the following architectural laws and engineering boundaries.

---

## 1. Non-Negotiable Architectural Boundaries

### 1.1 Inward-Pointing Dependencies
- **The Dependency Rule:** Dependencies must point exclusively inward toward the domain core.
  - **Domain Core (`src/lib/domain/`)**: Holds business entities, pure calculations, domain types, and Finite State Machines. It must have **zero imports** from SvelteKit, database drivers, Turso/libSQL, Stripe, Resend, S3/R2 SDKs, or network packages.
  - **Application Services (`src/lib/server/services/`)**: Orchestrates domain workflows, implements ports/interfaces, and consumes adapters.
  - **Infrastructure & Adapters (`src/lib/server/db/`, `src/lib/server/storage/`, `src/lib/server/payments/`, `src/lib/server/email/`)**: Implements persistence (Turso/Drizzle), media storage (Cloudflare R2), payments (Stripe Connect Express), and transactional email (Resend).
  - **Presentation Layer (`src/routes/`, `src/lib/components/`)**: SvelteKit routes, components, form actions, and page loaders depend inward on domain types and application services. The domain core never depends on or references UI/route state.

```
+-------------------------------------------------------+
|  Presentation: SvelteKit Routes, Components, Actions  |
|   +-----------------------------------------------+   |
|   | Infrastructure: Turso/Drizzle, Stripe, Resend |   |
|   |   +---------------------------------------+   |   |
|   |   | Services: Use-cases, Orchestration    |   |   |
|   |   |   +-------------------------------+   |   |   |
|   |   |   | Domain Core: Pure Entities,   |   |   |   |
|   |   |   | FSMs, Invariants, Types       |   |   |   |
|   |   |   +-------------------------------+   |   |   |
|   |   +---------------------------------------+   |   |
|   +-----------------------------------------------+   |
+-------------------------------------------------------+
```

### 1.2 Plain, Typed Data Structures at System Boundaries
- Every boundary where untrusted external data enters the system **must** be validated and transformed into a plain, strictly typed data structure using **Zod**.
- **Boundary Locations:**
  - Route parameters (`params`) and search query parameters (`url.searchParams`).
  - Form actions (`request.formData()`) and JSON API request bodies.
  - External webhooks (Stripe webhook payloads).
  - Storage & client state (`localStorage`, `sessionStorage`, cookies).
- **Rule:** Never pass raw `any`, unvalidated `FormData`, or unverified JSON payloads into domain services. Validate at the boundary, fail fast with structured errors, and pass strongly typed domain transfer objects inward.

### 1.3 Type-Driven Design: Make Illegal States Unrepresentable
- **Never represent state as loose strings or boolean soup.** (e.g., avoid `isDraft: boolean`, `isPublished: boolean`, `isArchived: boolean`, `isCancelled: boolean`).
- **Use Discriminated Unions:** Every entity state must be modeled such that impossible states cannot compile.
  - Example: An Issue cannot have a `publishedAt` timestamp or a `stampWindow` if its state is `'draft'`.
  ```typescript
  type Issue = 
    | { status: 'draft'; id: IssueId; artistId: ArtistId; slug: string; city: string; venue: string; date: string }
    | { status: 'published'; id: IssueId; artistId: ArtistId; slug: string; city: string; venue: string; date: string; timezone: string; secretKey: string; stampWindow: StampWindow; publishedAt: Date }
    | { status: 'cancelled'; id: IssueId; artistId: ArtistId; slug: string; city: string; venue: string; date: string; reason?: string }
    | { status: 'archived'; id: IssueId; artistId: ArtistId; slug: string; city: string; venue: string; date: string; archivedAt: Date };
  ```
- **Branded Types:** Use branded types for domain identifiers (e.g., `IssueId`, `ArtistId`, `FanUserId`, `ScanToken`) to prevent accidental argument transposition.

### 1.4 Explicit Finite State Machines (FSMs) for Complex Logic
- Replace ad-hoc boolean flags with deterministic, explicit state machines for all non-trivial workflows:
  1. **Tip Checkout FSM**: `idle` -> `initiating` -> `awaiting_payment` -> `succeeded` | `failed` -> `reset` (enforces decision 18: no background retry, reset on signal loss).
  2. **Wall Note Submission FSM**: `empty` -> `typing` -> `pending_auth` -> `submitting` -> `live` | `pending_review` | `rejected`.
  3. **Issue Lifecycle FSM**: Strict allowed transitions:
     - `draft` -> `published`
     - `published` -> `cancelled`
     - `published` -> `archived`
     - `cancelled` -> `archived`
     - *(Issues are never deleted; once archived or cancelled, cannot transition back to draft).*
  4. **Stamp Attendance Eligibility FSM**: `unverified` -> `scan_verified_in_window` -> `stamped` | `save_only`.
- State transitions must be pure functions: `transition(currentState, event): Result<NextState, DomainError>`.

---

## 2. Codebase & Development Standards

1. **Package Manager:** Exclusively use `pnpm` (no `npm` or `yarn`).
2. **Testing:**
   - Unit tests: `vitest` in `tests/unit/`.
   - End-to-end tests: `@playwright/test` in `tests/e2e/`.
3. **Styling:** Vanilla CUBE CSS with native `@layer` (`vendor`, `base`, `layouts`, `components`, `sticker`, `bookbinder`, `utilities`). **No Tailwind, no CSS-in-JS.**
4. **Zero Inline Styles Policy:**
   - No inline styles (`style="..."` or `style:...`) are permitted anywhere across templates, components, routes, or `app.html`.
   - **Sole Exception:** Strictly runtime dynamic UI necessities and animations:
     - Passing dynamic database-backed values into CSS custom properties (e.g., `style="--accent: {data.artist.accentColor};"`, `style="--cover-art: url('{data.artist.coverArtUrl}');"`).
     - Real-time animations and playback progress (e.g., audio playback progress `style="width: {progress}%;"`, visualizer equalizer height custom properties `style="--h: 40%"`).
     - Dynamic user swatches or avatars.
   - Static styling (font sizes, weights, letter-spacing, text transformations, margins, paddings, flex/grid properties, static colors, static background images) must strictly live in CUBE CSS stylesheet layers or Elemental layout primitives (`<Stack>`, `<Cluster>`, `<Box>`, `<Grid>`, etc.).
5. **Zero Emojis Policy:**
   - **Never use emojis** anywhere in the UI, templates, components, routes, seed scripts, console logs, tests, or documentation.
   - Emojis look amateurish and unprofessional. Exclusively use clean inline SVGs or typographic indicators when visual cues are needed.
6. **Minimal DOM & Polymorphic Layout Primitives:**
   - Avoid superfluous HTML wrappers combined with layout primitives. Use the `as` prop (`<Stack as="section">`, `<Cluster as="nav">`, `<Box as="article">`) so each semantic element is its own layout primitive without extra wrapper `<div>`s.
7. **Context Maintenance:**
   - Consult `CONTEXT.md` for ubiquitous language before introducing any new term.
   - Record significant, non-obvious, or hard-to-reverse trade-offs in `docs/adr/`.
   - Keep `docs/project-context.md` synchronized with problems, alternatives, and consequences.
