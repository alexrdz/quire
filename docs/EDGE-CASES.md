# Quire — Edge Cases

Smaller cases to handle at build time. Major ones have already been decided in `SPEC.md` (see the decision list in `CONTEXT.md`). Each case below has a recommended handling, to be confirmed or changed during the build.

## Tipping

| Case | Recommended handling |
|---|---|
| A fan taps tip and loses signal during checkout | The flow resets. Show "That didn't go through. Nothing was charged." Nothing is queued or retried (decision 18). |
| A fan double-taps the tip button | Disable the button while a checkout is in progress, and use one Stripe idempotency key per attempt. |
| A fan backs out of Apple Pay or Google Pay | Treat it as cancelled and return to the presets. No message, no follow-up. |
| A custom amount is below $2 or above $500 | Validate inline before checkout. |
| The fan's card is declined | Show Stripe's message and let them retry or leave. Nothing is stored. |
| Stripe keys unset in local dev / CI | Use deterministic local development payment fallback to record test tip and update dashboard metrics (ADR 0003). |
| A chargeback arrives weeks later | Subtract it from the Artist's net and show it as its own line in the dashboard. |
| An Artist disconnects Stripe while Issues are live | Hide the tip buttons everywhere right away. |

## Stamping & collecting

| Case | Recommended handling |
|---|---|
| A fan scans twice, or on two devices | One Stamp per fan per Issue. Extra scans are ignored. |
| A fan scans, clears browser data, then signs in | The scan token is lost and no Stamp is possible. Accepted. |
| A fan Saves an Issue and later Stamps it | The Stamp replaces the Save. One collection entry per Issue, and Stamped wins. |
| A fan tries to Stamp an archived or cancelled Issue within the window | Allowed. The show (or the gathering) still happened. |

## Issues & Back Page

| Case | Recommended handling |
|---|---|
| A busker publishes daily, leaving hundreds of Issues on the Back Page | Group the list by month, with only the latest month expanded. |
| A new Artist has no Issues | On `/dashboard`, render the **3-Step Studio Launchpad** above the fold (Master Template, Quick Issue or `"New Draft in Bookbinder"` + Busker Fast-Track to Permanent Artist QR & Full-Screen Case Display, Stripe Express) instead of an empty gigs table. Publicly on `/a/[slug]`, links and the General Wall still work (with tip buttons hidden until payouts are enabled) and a clean "No issues yet" state. |
| An Artist edits city or date after publishing | Allowed. The QR doesn't change, the Stamp Window moves, and Stamps already claimed are kept. |
| An Artist edits pages after fans have read them | Allowed. Issues are living documents; no version history for the MVP. |
| Two Artists want the same slug | First come, first served on `/login?mode=signup`. Show a live, editable `/a/band-name` preview derived from the band name (never append a random 3-digit suffix), check availability, and suggest clean alternatives if taken. |
| An Issue QR for a draft or unpublished Issue is scanned | Show "This issue isn't out yet" with a link to the Back Page. |
| An Issue QR for an archived Issue is scanned | Show the Issue read-only. Tipping still counts toward it if payouts are enabled. |

## The Wall

| Case | Recommended handling |
|---|---|
| A submitted note fails because of connectivity | Keep the typed text in the box and show "Couldn't post. Try again." This isn't a background sync: nothing posts until the fan taps again. |
| A blocked fan creates a new Google account | Accepted for the MVP. |
| A fan wants to edit or delete their own note | They can delete it; editing isn't allowed. A deleted note also deletes the Artist's reply to it. |
| The Artist wants to remove a reply they wrote | They can delete their own reply. |
| A note is hidden while a fan is reading the Wall | It disappears the next time the Wall loads. No real-time updates for the MVP. |
| Emoji-only or one-word notes | Allowed. |
| The General Wall needs approve-first too | A separate toggle in Artist settings (`general_wall_approve_first`). |

## Accounts & data

| Case | Recommended handling |
|---|---|
| A fan deletes their account | Their notes are removed, along with any replies to them. Their Stubs and Saves are deleted. Tips stay, since they were anonymous anyway. |
| An Artist closes their account | Issues become archived and read-only, the Back Page shows "This artist has left Quire," and fans keep their Stubs. |
| A band breaks up and a member keeps the password | It's the band's shared email that controls password resets via Resend (`/login/reset`). Out of scope for the platform. |
| One bandmate tries to swap the Stripe payout account | Require password re-entry plus a signed Resend email confirmation token (`/dashboard/settings/confirm-payout`) before switching the connected Stripe Express account (`SPEC.md` §6.4). |
| Someone reports an impersonating Artist | Handled manually by the platform. The verified mark is the main signal to fans. |
| A fan under 13 signs in with Google | Google's own age rules apply. Quire collects no age data. |

## Media & content

| Case | Recommended handling |
|---|---|
| An embedded YouTube or Bandcamp item is removed later | The facade shows "This media is no longer available." |
| An Artist uploads a cover image, gig photo, or audio file | Upload via `src/lib/server/storage/` directly to Cloudflare R2 (ADR 0004) from phone or laptop across Master Template, Quick Issue, and Bookbinder, with type/size caps and image optimization. |
| R2 credentials unset in dev | Fall back to local `/static/uploads` storage automatically. |
| An Artist picks a low-contrast `--accent` color | Validate WCAG contrast against `--bg-void` (`#090710`) in domain logic and warn/clamp in the Master Template UI so text and badges stay legible. |
| An Artist uploads media they don't own | Covered by the terms of service, with a takedown on report. No automatic detection. |
