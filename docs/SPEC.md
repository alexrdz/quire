# Quire — Product Spec (v2)

> Supersedes the Leaf PHP prototype spec. Where the UI prototype and this document disagree, **this document wins**. The UI prototype is the source of truth for **look and feel only**.

## 1. Vision

A lightweight platform for touring bands **and buskers** to publish city-specific digital zines ("Issues") that fans open by scanning a QR code at the gig. Fans can tip in one tap, sign an open wall, and collect stubs of the shows they attended. Artists get a morning-after recap made only of money and people — no vanity metrics.

**Name:** *Quire*, a gathered set of folded pages (what a zine is), pronounced like "choir." It is a print word and a music word at once.

**Positioning:** *"Your Venmo QR collects money. This collects money and people."*

**Project status:** Production platform powered by Turso (libSQL) + Drizzle ORM, Better Auth, Stripe Connect Express, Resend transactional email, and Cloudflare R2 media storage.

## 2. Core principles

- **The sticker is the geofence.** Scanning an Issue's QR at the gig is the only proof of attendance. No GPS, no location permissions.
- **Reading is anonymous.** No account, app download, or sign-in needed to read an Issue or tip.
- **Tipping takes one tap; the zine is optional.**
- **Accounts only where identity matters:** signing the wall and collecting.
- **Radical simplicity.** Boring, idiomatic code. No feature without a reason.
- **Accessible by default.** Semantic HTML, visible focus states, contrast-checked colors, pinch-zoom allowed (no `user-scalable=no`).

## 3. Users

| Type | Auth | Does |
|---|---|---|
| **Artist** (band or busker) | Email + password, **one login per Artist** (shared among bandmates); Resend verification & password reset | Publishes Issues, edits the Master Template, moderates walls, replies to notes, views the dashboard |
| **Fan** | Google sign-in (only when needed) | Reads, tips (anonymously), signs walls, saves and stamps Issues |

Both live in one user table with an account-type field (`artist` | `fan`), managed by Better Auth.

- **Artist sign-up & clean permanent slug (`/login?mode=signup`):** Landing Page artist CTAs route directly to `/login?mode=signup`. On sign-up, the Artist enters their Band / Artist Name and sees a live, **editable** URL slug preview (`/a/band-name`) derived from the band name — never silently appending a random 3-digit suffix. Slugs are first-come, first-served with a live collision check and suggested alternatives if taken, because the chosen slug is permanently baked into the Artist QR sticker.
- **Password reset:** Artists can reset a forgotten shared password via a `/login/reset` flow powered by Resend transactional email.

## 4. QR codes & entry points

- **Issue QR**: one per Issue. Opens **that Issue's Cover** via `/scan/[slug]?k=[secret]`. Scanning it within the Stamp Window makes the fan eligible to Stamp the Issue.
- **Artist QR**: one per Artist, permanent (`/a/[slug]`). Opens the **Back Page**. A busker who never makes Issues can use the Artist QR alone, replacing their Venmo and Instagram QR codes.
- **Sticker SVG & Full-Screen Case Display mode:** Publishing generates a downloadable **SVG QR code** for stickers, and the Artist QR SVG is available immediately upon sign-up. Both Issue QR and Artist QR views include a **Full-Screen Case Display** mode that hides all navigation chrome and maximizes the high-contrast QR badge on a phone screen (built to be propped up next to a busker's guitar case or merch table for scanning from a distance).

## 5. Fan experience

### 5.1 Cover (first screen of an Issue)
- Artist name and cover art, plus city, venue and date
- A one-line **Cover note** ("Playing till 6pm")
- **One-tap tip buttons**: three presets plus custom. The default presets are $3 / $5 / $10 and the Artist can change them. Payment goes through Apple Pay or Google Pay via Stripe.
- **"Open tonight's zine →"**
- A link to the Back Page

### 5.2 Issue reader
- Horizontally swiped pages with scroll snap, as in the UI prototype
- **Default page sequence:** Cover → Bespoke pages (setlist, tonight's photos/stories) → Master Template recurring pages (bio, liner notes) → Issue Wall → Endpaper (Save or Stamp). Can be reordered in the Bookbinder.
- **Page types:** text, image, audio, video (lightweight facades such as `lite-youtube` and compact Bandcamp players), setlist, and custom bespoke pages
- A **persistent tip button** is visible on every page and needs no sign-in
- The **last page is the Issue's Wall**
- The **Endpaper** follows the Wall and offers Save or Stamp

### 5.3 Back Page
- One-tap tipping (counted as **General**, not tied to any gig)
- The Artist's links: tickets, Bandcamp, merch, socials
- A list of **every Issue**, each showing city and date
- The **General Wall**

### 5.4 Tipping
- **Anonymous.** No sign-in and no message attached.
- **Fees:** the Artist absorbs Stripe fees and the platform cut by default. The fan sees an **unchecked** "Cover the fees so [Artist] gets the full $X" box.
- **Platform cut:** 5%, taken as a Stripe Connect application fee
- **Attribution:** a tip made from a Cover or Issue page counts toward that Issue. A tip made from the Back Page counts as General.
- **Charged only when the fan taps, never later.** A tip is attempted only at the moment the fan starts it. If the attempt fails for any reason, including lost connectivity, the tip flow resets and nothing is queued, saved or retried. The fan sees a plain "That didn't go through. Nothing was charged." and can tap again if they choose. There is no background retry, no "complete later" reminder, and no stored payment intent. *Why: a charge the fan didn't actively make right then would feel shady and erode trust.*
- **Limits:** a $2 minimum (Stripe takes about $0.33 of a $1 tip) and a $500 maximum. **USD only** for the MVP.
- **Tips only once payouts work.** Tip buttons are hidden on the Cover, the Issue pages and the Back Page until the Artist's Stripe account can receive payouts.
- **Refunds and chargebacks** are absorbed by the Artist, the same as fees, and shown in the dashboard.

### 5.5 Wall (open guestbook)
- Public. Every fan can read every note.
- Signing requires Google sign-in. Anonymous fans can type their note directly; tapping 'Post note' triggers Google OAuth with the draft saved in `sessionStorage` and automatically submits upon return. For Endpaper, tapping 'Claim Stamp' triggers Google sign-in and immediately stamps the Issue upon return.
- Each Issue has its own Wall, and the Back Page has the General Wall.
- A note shows the fan's **first name, Google avatar, and a "was there" mark** if the fan Stamped that Issue.
- **Replies:** only the Artist can reply, one level deep. Replies show a verified mark in the Artist's accent color. Fans can't reply to each other.
- **Moderation:**
  - Notes go **live immediately** by default.
  - Fans can **flag** notes. A note with **3 flags is auto-hidden** until the Artist reviews it. Once the Artist **restores** a note, flags can't auto-hide it again, so a few friends can't keep hiding a legitimate note.
  - **Notes can't contain links, email addresses or phone numbers.** They're rejected with a friendly message. This blocks "text me" creepiness and link spam.
  - The Artist can **hide** any note and **block** a fan from all of the Artist's Walls.
  - An optional **approve-first** toggle on each Issue, off by default
- **Spam protections:** escape all output, a honeypot field, per-account rate limits, a character cap (about 250 characters), and a submit lock against double-posting.

### 5.6 Collecting: My Stubs
- **Saved:** any Issue, from anywhere. It's a bookmark, shown as a cover thumbnail.
- **Stamped:** only available after reaching the Issue **by scanning its QR within the Stamp Window**. Shown as a ticket stub with artist, city, venue, date and "Admit One."
  - **Claim later:** if the scan happened inside the Stamp Window, the fan can sign in and claim the Stamp at any time afterward. Eligibility is recorded at scan time as a signed scan token stored on the device.
  - **The window uses the Issue's time zone**, the venue's local time, not the Artist's or the fan's.
  - **Known tradeoff:** every fan scans the same QR, so a photo of the sticker shared during the window lets someone stamp remotely. This is an explicitly accepted architectural tradeoff (`docs/adr/0001-issue-qr-scan-verification.md`), bounded by the 48-hour Stamp Window.
- Both require Google sign-in.
- **My Stubs** has two sections, Stubs (Stamped, sorted by date) and Saved (a grid). Artist names link to their Back Pages.
- No follows and no feed (possible later).

## 6. Artist experience

### 6.1 Master Template
Edited occasionally, at `/dashboard/template` (or via Bookbinder):
- **Cover art:** direct image file upload (`src/lib/server/storage/`, stored in Cloudflare R2 in production with automatic local `/static/uploads` fallback in dev) in addition to URL entry, with live thumbnail preview.
- **Accent color (`--accent`):** WCAG contrast-checked against `--bg-void` (`#090710`) so badges, buttons, and links remain legible; low-contrast colors are flagged and clamped/validated by pure domain helpers.
- **Type pairing:** 2–3 curated options (`Inter` default, editorial serif, DIY monospace).
- **Recurring pages:** editable and reorderable pages automatically included in every Issue (bio, liner notes, audio tracks with direct audio upload or Bandcamp/embed URL, `lite-youtube` / Bandcamp video facades, setlists).
- **Back Page links & tip presets:** link label/URL pairs plus 3 tip preset dollar amounts ($2–$500 USD; default $3 / $5 / $10).

### 6.2 Creating Issues
Two purpose-built creation flows exist for phone vs. desktop, and **either tool can open an Issue made in the other**:
- **Quick Issue (phone, `/dashboard/issues/quick`, under 60 seconds):**
  - Required: **city, venue or spot name, and date.** The date sets the Stamp Window.
  - Optional: Cover note, **direct photo upload** (phone camera/library via `src/lib/server/storage/` R2/local fallback or URL), setlist, and 1–2 bespoke pages.
  - Automatic: Master Template pages, Back Page links, Wall, Endpaper.
  - **"Duplicate last issue"** copies everything except city and date.
- **Bookbinder (desktop, `/dashboard/bookbinder/[id]`):** a split-screen block editor with a live 375x780 mobile preview, carried over from the PHP prototype. It is for building and polishing Issues block by block (`text`, `setlist`, `photo` via direct R2/local upload or URL, `audio` via direct audio upload or Bandcamp/embed URL, and `video` via `lite-youtube` / compact Bandcamp facades).
- Publishing generates the Issue QR and unlocks **Full-Screen Case Display** mode and downloadable SVG stickers.
- **Time zone:** each Issue stores the venue's time zone, auto-detected from the browser/city with manual override. The Stamp Window and the dashboard's "morning after" recap both use it.
- **Multiple Issues on one date** are allowed (early and late sets, two spots in one day).

### 6.3 Issue lifecycle
- **Status values:** `draft` → `published` → optionally `cancelled` or `archived`
- **Issues are archived, never deleted.** An archived Issue disappears from the Back Page, but fans' Stubs, tip records and its Wall remain. A fan opening it from My Stubs sees it read-only.
- **Cancelled:** the Issue stays visible with a "Cancelled" label. Postponing means editing the date, which moves the Stamp Window. Stamps already claimed are kept.

### 6.4 Account safety & Stripe Connect Express
- **Deferred / on-demand Stripe Connect Express onboarding:** Artists can sign up, customize their Master Template, and publish Issues immediately without connecting payouts. When ready to receive tips, clicking **"Connect with Stripe Express"** triggers real Stripe Connect Express onboarding (`accounts.create({ type: 'express' })` + `accountLinks.create`), redirecting to Stripe to verify bank/identity details. Once `payoutsEnabled === true` (synchronized via verified Stripe webhooks), 1-tap Apple Pay / Google Pay tip buttons automatically appear across the Cover, Issue pages, and Back Page.
- **Changing an existing payout account:** requires entering the band's password again and confirming via a signed token link sent by Resend transactional email (`/dashboard/settings/confirm-payout`), because the login is shared among bandmates.
- **Verified mark:** granted by hand by the platform after a basic check, to discourage impersonating real bands. Unverified Artists can still publish and receive tips.

### 6.5 Dashboard
- **First-Time Artist Studio Launchpad (`issues.length === 0`):** When a newly signed-up Artist visits `/dashboard` with `0` issues, `/dashboard` renders a **3-Step Studio Launchpad** above the fold instead of an empty gigs table:
  1. **Step 1: Customize Master Template (`~2 min`)** — cover art upload (`src/lib/server/storage/`), contrast-checked `--accent` against `--bg-void`, type pairing, tip presets, Back Page links, and editable/reorderable recurring pages.
  2. **Step 2: Publish First Issue** — choose between the `<60 sec` **Quick Issue** phone flow (`/dashboard/issues/quick`) or **`"New Draft in Bookbinder"`** desktop split-screen flow, **plus a Busker Fast-Track** to open/download their Permanent Artist QR (`/a/[slug]`) immediately and display it in **Full-Screen Case Display** mode.
  3. **Step 3: Connect Stripe Express (`Deferred / On-Demand`)** — real Stripe Connect Express onboarding redirect (`accountLinks.create`) to unhide 1-tap Apple Pay / Google Pay tip buttons.
- **Gig Recap card** for the most recent Issue (once at least one Issue exists):
  - Tips: total and number of tippers
  - Stamped: number of fans
  - Notes: newest first, with flagged notes and notes awaiting approval at the top, and a **Reply** action on unanswered notes
  - Saves: number of bookmarks
- **A list of all gigs**, one row each (city, date, tips, stamps, notes), plus a **General** row for Back Page activity, and direct **"New Draft in Bookbinder"** and **"+ Publish Quick Issue"** actions
- Each tip shows **gross amount, fees and net amount**
- No charts, page views or bounce rates. **No email digest.**

## 7. Look & feel

- The **dark glass aesthetic from the UI prototype**: dark backgrounds, frosted panels, gradients and bottom-sheet drawers
- **Hand-written vanilla CSS** following CUBE (cube.fyi) and layout primitives (every-layout.dev), with native `@layer` (`vendor`, `base`, `layouts`, `components`, `sticker`, `bookbinder`, `utilities`). Logical properties throughout and no inline styles. **No Tailwind.**
- **Color tokens:**
  - `--accent`: Electric cyan / neon blue (`#05D9E8` default), **and the only color the Artist can change**
  - `--highlight`: Mint green (`#01FFC3`), platform-wide (dates, selected states, stamps)
  - `--support`: Pink / Magenta (`#FF2A6D`), platform-wide (tipping, financial highlights)
  - `--bg-void`: Deep dark background (`#090710`)
  - `--bg-surface`: Elevated card/panel background (`#151124`, with glass panel variants)
  - `--ink`: Crisp light/white typography for dark canvas (e.g. `#FFFFFF` / high-contrast zinc)
- Every Issue should read as a Quire issue: the overall house style is fixed. Artists vary cover art, accent color and type pairing only.

## 8. Tech stack

- **App:** SvelteKit (Svelte 5 Runes + TypeScript)
- **Database:** Turso (libSQL), accessed through Drizzle ORM
- **Auth:** Better Auth, with email/password for Artists (with email verification and password reset) and Google OAuth for Fans
- **Payments:** Stripe Connect (Express). Each Artist onboards a connected Express account, tips are processed with a 5% platform `application_fee_amount`, and account/payment state is synchronized via cryptographically verified Stripe webhooks.
- **Transactional Email:** Resend for Artist email verification, password resets, and payout account change confirmations (Section 6.4).
- **Storage & Media:** Cloudflare R2 (S3-compatible object storage with zero egress fees) for uploaded cover art and gig photos, plus lightweight embed facades (`lite-youtube`, compact Bandcamp).
- **Hosting:** Netlify

## 9. Data model (sketch)

```
user           id, type (artist|fan), email, name, avatar_url, ...   (Better Auth tables)
artist         id, user_id, slug, display_name, cover_art, accent_color,
               type_pairing, tip_presets_json, links_json, stripe_account_id,
               payouts_enabled, verified, general_wall_approve_first
template_page  id, artist_id, position, kind, content_json
issue          id, artist_id, slug, city, venue, date, timezone, cover_note,
               status (draft|published|cancelled|archived),
               stamp_window_start, stamp_window_end, approve_first, published_at
issue_page     id, issue_id, position, kind, content_json      (bespoke pages)
tip            id, artist_id, issue_id NULL (NULL = General), amount_gross,
               fee_stripe, fee_platform, amount_net, fan_covered_fees, stripe_payment_id, created_at
note           id, artist_id, issue_id NULL (NULL = General Wall), fan_user_id,
               body, status (live|pending|hidden), flag_count, flag_immune, created_at
note_reply     id, note_id (unique), body, created_at           (Artist only, one per note)
note_flag      note_id, fan_user_id                              (one flag per fan)
block          artist_id, fan_user_id
collection     fan_user_id, issue_id, kind (saved|stamped), created_at
scan           id, issue_id, token, created_at                   (proves a QR scan for Stamping)
```

## 10. Seeded showcase & interactive sandbox

- **Seeded showcase Artist:** 'The Neon Velvet' on a 3-city tour with rich notes, stubs, tips, and Back Page activity so the platform showcases a live touring workflow out of the box.
- **One-click demo login:** An 'Explore as Demo Artist' quick switch (`/demo`) and pre-filled sandbox credentials on the login page to test the dashboard, Bookbinder, and moderation immediately.
- **Architecture Decision Records (`docs/adr/`):** Living engineering documentation explaining key decisions: why the sticker is the geofence, why tips are anonymous, why the wall is open, why only artists reply, and why the theming is constrained.

## 11. Decided items (confirmed & locked in)

- **Clean editable Artist slug on sign-up:** Landing Page CTAs route directly to `/login?mode=signup`. Sign-up shows a live, editable URL slug preview (`/a/band-name`) derived from the band name (never appending a random 3-digit suffix), validated first-come, first-served with suggested alternatives on collision because it is baked into the Permanent Artist QR sticker.
- **First-Time Artist 3-Step Studio Launchpad:** When an Artist visits `/dashboard` with `0` issues, render the 3-Step Studio Launchpad above the fold (1: Customize Master Template, 2: Publish First Issue via Quick Issue or `"New Draft in Bookbinder"` + Busker Fast-Track to Permanent Artist QR in **Full-Screen Case Display** mode, 3: Connect Stripe Express) instead of an empty gigs table.
- **Full-Screen Case Display mode:** Both Issue QR and Permanent Artist QR views support a chrome-free, high-contrast full-screen phone display mode for propping beside a busker's case or merch table.
- **Direct media uploads (`src/lib/server/storage/`):** Master Template cover art, Quick Issue photo, and Bookbinder photo & audio fields support direct file uploads from phone or laptop (backed by Cloudflare R2 in production with automatic `/static/uploads` local dev fallback), alongside URLs and lightweight embeds (`lite-youtube`, compact Bandcamp).
- **WCAG contrast-checked `--accent`:** Artist `--accent` color selection is validated for contrast against `--bg-void` (`#090710`).
- **Stripe connection timing & account safety:** Deferred / on-demand via real Stripe Connect Express onboarding (`accountLinks.create`). Artists can create an account, customize their template, and publish immediately; tip buttons remain hidden until `payoutsEnabled === true`. Changing an existing payout account requires password re-entry plus Resend email confirmation token verification (Section 6.4).
- **Transactional email:** Resend handles Artist email verification, password reset flows (`/login/reset`), and payout account change confirmation emails (Section 6.4).
- **Stamp Window:** 48-hour calendar window — from 00:00 on the gig date through 23:59:59 the following day in the venue's local time zone.
- **QR scan validation:** Dedicated scan endpoint with issue secret (`/scan/[issue_slug]?k=[issue_secret]`), issuing a signed HMAC scan token to the device and redirecting to the Cover.
- **Wall pending action:** Anonymous fans can type their note upfront; tapping 'Post note' triggers Google OAuth with the draft stored in `sessionStorage` and automatically submits upon return. Endpaper 'Claim Stamp' signs in and immediately stamps.
- **Page sequence:** Cover -> Bespoke pages -> Master Template recurring pages -> Wall -> Endpaper.
- **Tech stack & styling:** SvelteKit with Svelte 5 (Runes), TypeScript, Turso (libSQL) via Drizzle ORM, Better Auth, Stripe Connect Express, Resend, Cloudflare R2, and hand-crafted CUBE CSS with native `@layer` (no Tailwind).
- **Seeded tour:** 'The Neon Velvet' 3-city tour with one-click sandbox login.
