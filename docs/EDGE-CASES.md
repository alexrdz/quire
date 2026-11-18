# Quire — Edge Cases

Smaller cases to handle at build time. Major ones have already been decided in `SPEC.md` (see the decision list in `CONTEXT.md`). Each case below has a recommended handling, to be confirmed or changed during the build.

## Tipping (Venmo, ADR 0008)

| Case | Recommended handling |
|---|---|
| A fan taps a tip button and the tap can't be recorded (no signal, server error) | Open Venmo anyway. The tap just isn't counted. Never block a fan from paying an Artist (decision 18). |
| A fan double-taps the tip button | Open Venmo once; ignore repeat taps for a couple of seconds and record one tap. |
| A fan doesn't have the Venmo app | The link falls back to venmo.com in the browser. |
| A fan backs out in Venmo, or the payment fails | Nothing to do: Quire never sees it. The tap stays a tap. No message, no follow-up. |
| A fan is outside the US | Venmo is US-only. The tip buttons still show; Venmo explains. No special handling. |
| A fan edits the note in Venmo | Allowed. Quire never sees the note or the payment. |
| A custom amount is below $2 or above $500 | Validate inline before opening Venmo. |
| A fan is over the tip-tap rate limit | Open Venmo anyway; don't record the tap. |
| A tip button is tapped in the Demo, development or tests | Never open Venmo. Record the tap and show "In the Demo, this would open Venmo to pay $5 to @username." |
| The Artist mistypes their Venmo username | Quire can't verify it. Setup has "Test your link"; fixing it later goes through the password + email confirmation change flow. |
| An Artist removes their Venmo username while Issues are live | Only after password + email confirmation. Then hide the tip buttons everywhere right away. |
| An Artist asks how much they made from a gig | The dashboard shows tap counts only and says "Check Venmo for what came in." Never a dollar figure. |

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
| A new Artist has no Issues | On `/dashboard`, render the **3-Step Studio Launchpad** above the fold (Master Template, Quick Issue or `"New Draft in Bookbinder"` + Busker Fast-Track to Permanent Artist QR & Full-Screen Case Display, Add your Venmo) instead of an empty gigs table. Publicly on `/a/[slug]`, links and the General Wall still work (with tip buttons hidden until a Venmo username is set) and a clean "No issues yet" state. |
| An Artist edits city or date after publishing | Allowed. The QR doesn't change, the Stamp Window moves, and Stamps already claimed are kept. |
| An Artist edits pages after fans have read them | Allowed. Issues are living documents; no version history for the MVP. |
| Two Artists want the same slug | First come, first served on `/login?mode=signup`. Show a live, editable `/a/band-name` preview derived from the band name (never append a random 3-digit suffix), check availability, and suggest clean alternatives if taken. |
| An Issue QR for a draft or unpublished Issue is scanned | Show "This issue isn't out yet" with a link to the Back Page. |
| An Issue QR for an archived Issue is scanned | Show the Issue read-only. Tip taps still count toward it if the Artist has a Venmo username. |

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
| A fan deletes their account | Their notes are removed, along with any replies to them. Their Stubs and Saves are deleted. Tip Taps stay, since they were anonymous anyway. |
| An Artist closes their account | Issues become archived and read-only, the Back Page shows "This artist has left Quire," and fans keep their Stubs. |
| A band breaks up and a member keeps the password | It's the band's shared email that controls password resets via Resend (`/login/reset`). Out of scope for the platform. |
| One bandmate tries to swap or remove the Venmo username | Require password re-entry plus a signed, single-use Resend email confirmation link. The old username stays live until the link is confirmed with a POST, and a notice is emailed after the change (`SPEC.md` §6.4). |
| The confirmation email is opened by a link scanner or preview bot | Nothing changes: the link only shows the pending change; the confirm button (POST) applies it. |
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
