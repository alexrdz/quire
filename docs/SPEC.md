# Quire — Product Spec (v2)

> Supersedes the Leaf PHP prototype spec. Where the UI prototype and this document disagree, **this document wins**. The UI prototype is the source of truth for **look and feel only**.

## 1. Vision

A lightweight platform for touring bands **and buskers** to publish city-specific digital zines ("Issues") that fans open by scanning a QR code at the gig. Fans can tip in one tap, sign an open wall, and collect stubs of the shows they attended. Artists get a morning-after recap made only of money and people — no vanity metrics.

**Name:** *Quire*, a gathered set of folded pages (what a zine is), pronounced like "choir." It is a print word and a music word at once.

**Positioning:** *"Your Venmo QR collects money. This collects money and people."*

**Project status:** Portfolio piece first, possible launch later. Stripe runs in **test mode** unless launched.

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
| **Artist** (band or busker) | Email + password, **one login per Artist** (shared among bandmates) | Publishes Issues, edits the Master Template, moderates walls, replies to notes, views the dashboard |
| **Fan** | Google sign-in (only when needed) | Reads, tips (anonymously), signs walls, saves and stamps Issues |

Both live in one user table with an account-type field (`artist` \| `fan`), managed by Better Auth.

## 4. QR codes & entry points

- **Issue QR**: one per Issue. Opens **that Issue's Cover**. Scanning it within the Stamp Window makes the fan eligible to Stamp the Issue.
- **Artist QR**: one per Artist, permanent. Opens the **Back Page**. A busker who never makes Issues can use the Artist QR alone, replacing their Venmo and Instagram QR codes.
- Publishing generates a downloadable **SVG QR code** for stickers. It can also be shown full-screen on a phone (propped up next to a busker's case).

## 5. Fan experience

### 5.1 Cover (first screen of an Issue)
- Artist name and cover art, plus city, venue and date
- A one-line **Cover note** ("Playing till 6 🎸")
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
  - **Known tradeoff:** every fan scans the same QR, so a photo of the sticker shared during the window lets someone stamp remotely. This is accepted for the MVP. The short window limits it, and the case study discusses it openly.
- Both require Google sign-in.
- **My Stubs** has two sections, Stubs (Stamped, sorted by date) and Saved (a grid). Artist names link to their Back Pages.
- No follows and no feed (possible later).

## 6. Artist experience

### 6.1 Master Template
Edited occasionally, in the Bookbinder:
- Cover art, **accent color** (contrast-checked), **type pairing** (2–3 options; Inter is the default)
- Recurring pages included in every Issue (bio, liner notes, and so on)
- Back Page links and tip presets

### 6.2 Creating Issues
- **Quick Issue (phone, under a minute):**
  - Required: **city, venue or spot name, and date.** The date sets the Stamp Window.
  - Optional: Cover note, photo, setlist, and 1–2 bespoke pages
  - Automatic: Master Template pages, Back Page links, Wall, Endpaper
  - **"Duplicate last issue"** copies everything except city and date.
- **Bookbinder (desktop):** a split-screen editor with a live mobile preview, carried over from the PHP prototype. It's for building and polishing Issues block by block. Either tool can open an Issue made in the other.
- Publishing generates the Issue QR.
- **Time zone:** each Issue stores the venue's time zone, set from the city. The Stamp Window and the dashboard's "morning after" both use it.
- **Multiple Issues on one date** are allowed (early and late sets, two spots in one day).

### 6.3 Issue lifecycle
- **Status values:** `draft` → `published` → optionally `cancelled` or `archived`
- **Issues are archived, never deleted.** An archived Issue disappears from the Back Page, but fans' Stubs, tip records and its Wall remain. A fan opening it from My Stubs sees it read-only.
- **Cancelled:** the Issue stays visible with a "Cancelled" label. Postponing means editing the date, which moves the Stamp Window. Stamps already claimed are kept.

### 6.4 Account safety
- **Changing the payout account** requires entering the password again and confirming by email, because the login is shared among bandmates.
- **Verified mark:** granted by hand by the platform after a basic check, to discourage impersonating real bands. Unverified Artists can still publish and receive tips.

### 6.5 Dashboard
- **Gig Recap card** for the most recent Issue:
  - Tips: total and number of tippers
  - Stamped: number of fans
  - Notes: newest first, with flagged notes and notes awaiting approval at the top, and a **Reply** action on unanswered notes
  - Saves: number of bookmarks
- **A list of all gigs**, one row each (city, date, tips, stamps, notes), plus a **General** row for Back Page activity
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

- **App:** SvelteKit
- **Database:** Turso (libSQL), accessed through Drizzle
- **Auth:** Better Auth, with email/password for Artists and Google OAuth for Fans
- **Payments:** Stripe Connect (Express). Each Artist has a connected account, and the platform cut is the application fee. Test mode for the portfolio.
- **Hosting:** Netlify
- **Media:** lightweight embed facades (`lite-youtube`, compact Bandcamp)

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

## 10. Portfolio & demo layer

- **Seeded demo Artist:** 'The Neon Velvet' on a 3-city tour with rich notes, stubs, tips, and Back Page activity so the app never feels empty.
- **One-click demo login:** An 'Explore as Demo Artist' quick switch and pre-filled credentials on the login page for portfolio reviewers to test the dashboard, Bookbinder, and moderation immediately.
- **Case-study page:** Explaining the key decisions: why the sticker is the geofence, why tips are anonymous, why the wall is open, why only artists reply, and why the theming is constrained.

## 11. Decided items (resolved in grilling session)

- **Stripe connection timing:** Deferred / on-demand. Artists can create an account, customize their template, and publish immediately; prompt them to connect Stripe from the dashboard or banner when ready to receive tips (tip buttons remain hidden until payouts are enabled).
- **Stamp Window:** 48-hour calendar window — from 00:00 on the gig date through 23:59:59 the following day in the venue's local time zone.
- **QR scan validation:** Dedicated scan endpoint with issue secret (`/scan/[issue_slug]?k=[issue_secret]`), issuing a signed HMAC scan token to the device and redirecting to the Cover.
- **Wall pending action:** Anonymous fans can type their note upfront; tapping 'Post note' triggers Google OAuth with the draft stored in `sessionStorage` and automatically submits upon return. Endpaper 'Claim Stamp' signs in and immediately stamps.
- **Page sequence:** Cover → Bespoke pages → Master Template recurring pages → Wall → Endpaper.
- **Tech stack & styling:** SvelteKit with Svelte 5 (Runes), TypeScript, Turso (libSQL) via Drizzle ORM, Better Auth, and hand-crafted CUBE CSS with native `@layer` (no Tailwind).
- **Media storage:** Cloudflare R2 (S3-compatible, zero egress fees) for production image uploads with local `/static/uploads` fallback in dev.
- **Demo tour:** 'The Neon Velvet' 3-city tour with one-click demo login.
