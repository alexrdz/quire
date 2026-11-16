# Quire — Project Context & Architectural Decisions

This is a living document maintained alongside the Architecture Decision Records (`docs/adr/`). It provides a consolidated view of the core problems Quire solves, alternatives explored, chosen solutions, and accepted consequences across the system lifecycle.

---

## 1. Physical QR Geofencing & Attendance Verification

### Problem
How can a touring band or busker prove that a fan was physically at the gig before awarding an authenticated digital ticket stub ("Stamp"), without imposing intrusive GPS location tracking, requiring battery-draining permissions, or alienating privacy-conscious fans?

### Alternatives Considered
1. **Device GPS / Geolocation API**: Prompt the fan's mobile browser for GPS coordinates upon clicking "Stamp" and compare with venue lat/long.
   - *Rejected*: Frequent browser permission blocks, venue GPS dead-zones (basements, thick brick walls), and high user privacy friction.
2. **Direct Cover URL in QR (`/i/[slug]`)**: Embed the direct public issue URL in the QR code and permit stamping during the gig date.
   - *Rejected*: The moment any fan or artist shares the link on Twitter, Instagram, or Discord during the show, remote fans could collect legitimate attendance stubs without attending.
3. **Dedicated Scan Route with Issue Secret (`/scan/[slug]?k=[secret]`)** *(Chosen)*:
   - The physical sticker QR encodes a dedicated scan endpoint carrying a cryptographically secure issue secret.
   - Visiting `/scan` within the 48-hour local Stamp Window validates the secret and sets an HMAC-signed device attendance token (`Scan Token`), then redirects to the Issue Cover (`/i/[slug]`).
   - Direct web links to `/i/[slug]` permit anonymous reading and tipping, but do not issue scan tokens.

### Accepted Consequences
- Every printed sticker for an issue shares the same QR code. A fan who photographs the sticker and sends the photo to friends during the 48-hour window enables remote stamping. This is an explicitly documented and accepted MVP trade-off; the physical sticker remains the geofence without intrusive GPS tracking. (See [ADR 0001](file:///Users/alexrodriguez/Sites/quire/docs/adr/0001-issue-qr-scan-verification.md)).

---

## 2. Technology Stack & Design System

### Problem
The Leaf PHP prototype (`green-room`) validated the core concept, but required an idiomatic, full-stack, edge-compatible modern production architecture. We needed reactive split-screen editing for Bookbinder, type-safe database access, seamless dual-auth (Artist password vs. Fan Google OAuth), and strict performance constraints without CSS bloat.

### Alternatives Considered
1. **Next.js / React with Tailwind CSS**:
   - *Rejected*: Heavy client hydration, CSS runtime / utility class churn that breaks the bespoke, retro-crafted aesthetic defined in the prototype, and complex multi-context auth configurations.
2. **SvelteKit with Svelte 5 (Runes), Turso (libSQL) + Drizzle, Better Auth, and CUBE CSS** *(Chosen)*:
   - **Svelte 5 Runes**: Predictable fine-grained reactivity (`$state`, `$derived`, `$props`) allowing the Bookbinder split-screen editor to update an interactive mobile preview iframe without external state libraries.
   - **Turso (libSQL) + Drizzle ORM**: Edge-ready SQLite persistence with type-safe schema definitions and zero-friction local SQLite file development.
   - **Better Auth**: First-class support for single-table unified users with multi-provider auth (Artist email/password and Fan Google OAuth).
   - **CUBE CSS (`@layer`)**: Native CSS layer hierarchy (`vendor`, `base`, `layouts`, `components`, `sticker`, `bookbinder`, `utilities`) preserving the dark glass aesthetic and CSS scroll-snap horizontal reader without external utility frameworks.

### Accepted Consequences
- Requires strict adherence to vanilla CUBE CSS conventions without falling back to utility classes. Developers must write semantic, token-driven CSS using CSS custom properties (`--accent`, `--highlight`, `--support`, `--bg-void`, `--bg-surface`, `--ink`). (See [ADR 0002](file:///Users/alexrodriguez/Sites/quire/docs/adr/0002-tech-stack-and-styling.md)).

---

## 3. Media Asset Storage

### Problem
Artists upload high-resolution cover art, gig photography, and bespoke zine graphics. As the platform grows from 15 artists to hundreds with thousands or tens of thousands of images, how do we store and serve these assets reliably, cost-effectively, and without vendor lock-in?

### Alternatives Considered
1. **Netlify Blobs**:
   - *Rejected*: Adequate for key-value store and small site state, but free tier caps storage at 100MB and operations at 10k reads/month. Scaling to 2,000+ images incurs storage fees and high bandwidth egress charges ($55/100GB).
2. **AWS S3**:
   - *Rejected*: Standard S3 charges egress fees per GB. When 5,000 fans at a festival scan a zine and load cover images simultaneously, egress bandwidth costs spike.
3. **Cloudflare R2 Object Storage with S3 API** *(Chosen)*:
   - **Zero Egress Fees**: Completely free bandwidth egress forever.
   - **Generous Free Tier**: 10 GB storage, 1M write operations, and 10M read operations/month free.
   - **Portability**: Standard `@aws-sdk/client-s3` implementation allows easy migration to any S3-compatible service.
   - **Local Dev Fallback**: When R2 credentials are unset in local development, uploads fall back to the local `/static/uploads` folder automatically.

### Accepted Consequences
- Requires maintaining an S3 client abstraction that smoothly toggles between remote R2 buckets in production and local filesystem writes in development. (See [ADR 0004](file:///Users/alexrodriguez/Sites/quire/docs/adr/0004-cloudflare-r2-media-storage.md)).

---

## 4. Payments, Tipping & Local Portfolio Simulator

### Problem
Quire is designed as a portfolio piece first, with production capabilities ready for launch. Tips must be anonymous, 1-tap (Apple Pay / Google Pay via Stripe Connect Express with a 5% platform cut), charged immediately, and never retried in the background. However, portfolio reviewers and automated test runners often run the code offline or without live Stripe Connect test credentials.

### Alternatives Considered
1. **Strict Live Stripe Requirement**:
   - *Rejected*: Without active `STRIPE_SECRET_KEY` configured, tipping breaks or displays an error, preventing evaluators from testing the tipping flow, the Gig Recap cards, and dashboard fee calculations.
2. **Read-Only / Fake Toast**:
   - *Rejected*: Clicking tip displays a simulated toast, but writes no database records, leaving the artist dashboard empty.
3. **Dual Stripe Connect + Local Mock Payment Simulator** *(Chosen)*:
   - When valid Stripe credentials are provided, Quire uses real Stripe Elements and Stripe Connect application fees.
   - When Stripe credentials are unset, a 1-tap test checkout simulator activates. It calculates the gross tip, 5% platform fee, and Stripe processing fee, writes the real `tip` record to the database, and immediately updates dashboard metrics.

### Accepted Consequences
- The payment service must maintain strict parity between Stripe webhook payloads and simulated local tip records so business logic remains identical. (See [ADR 0003](file:///Users/alexrodriguez/Sites/quire/docs/adr/0003-local-and-demo-mock-payments.md)).

---

## 5. The Wall, Guestbook Moderation & Pending Actions

### Problem
Public guestbooks can attract spam, inappropriate messages, or link abuse. How do we keep the Wall lively and open while blocking creeps and minimizing friction for fans?

### Alternatives Considered
1. **Pre-Moderation (Approve-First by Default)**:
   - *Rejected*: Stifles in-the-moment live gig enthusiasm; buskers and busy artists cannot approve notes in real time during a performance.
2. **Anonymous Posting**:
   - *Rejected*: Anonymity on a public board breeds abuse and impersonation.
3. **Live Posting with Google Auth, Single-Tier Replies, Anti-Spam & Pending Action** *(Chosen)*:
   - **Auth Requirement**: Only signed-in Google users can submit notes (displaying first name and Google avatar).
   - **Pending Action Preservation**: Anonymous fans can type their note directly; tapping 'Post note' saves the draft in `sessionStorage` and triggers Google OAuth, automatically submitting the note upon redirect back to the page.
   - **Spam Rejection**: Notes containing URLs, phone numbers, or email addresses are rejected client- and server-side.
   - **Moderation Rules**: 3 user flags auto-hide a note until reviewed. If an artist restores a note, it becomes `flagImmune` to stop flag brigading. Only the Artist can reply, exactly one level deep.

### Accepted Consequences
- Fans must authenticate with Google to sign the guestbook, but they can draft their message before signing in. (Documented in `SPEC.md` section 5.5).


---

## 6. Architectural Boundaries, Type-Driven Modeling & Finite State Machines

### Problem
As web applications grow, business rules often bleed into route handlers, database queries, and UI components. Boolean flag proliferation (`isLoading`, `hasError`, `isDraft`, `isArchived`, `canTip`) leads to impossible states, silent bugs, and brittle regressions.

### Alternatives Considered
1. **Standard MVC / Ad-hoc Route Logic**:
   - Write business logic directly inside SvelteKit `+page.server.ts` actions and check states with scattered boolean flags.
   - *Rejected*: Makes core domain rules impossible to test in isolation, creates tight coupling to SvelteKit request lifecycles, and permits invalid state combinations (e.g., an issue marked as both draft and archived).
2. **Inward Dependencies + Zod Boundaries + Discriminated Unions + Explicit FSMs** *(Chosen)*:
   - **Inward Dependencies**: Pure domain core (`src/lib/domain/`) with zero framework or database dependencies.
   - **Boundary Zod Validation**: All external inputs (URL search params, form submissions, webhooks, localStorage) validated through Zod before reaching domain services.
   - **Type-Driven Design**: Discriminated unions make invalid combinations unrepresentable at compile time.
   - **Explicit FSMs**: Deterministic state transitions for tip checkout, issue lifecycles, wall note submissions, and stamp eligibility.

### Accepted Consequences
- Requires writing explicit Zod schemas and FSM transition functions upfront rather than quick ad-hoc mutation scripts. (See [ADR 0005](file:///Users/alexrodriguez/Sites/quire/docs/adr/0005-inward-dependencies-and-type-driven-design.md) and [AGENTS.md](file:///Users/alexrodriguez/Sites/quire/AGENTS.md)).
