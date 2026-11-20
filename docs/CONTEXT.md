# Quire — Domain Context

Shared vocabulary and key decisions. Use these terms in code, UI copy and docs. See `SPEC.md` for full detail.

## Glossary

| Term | Meaning |
|---|---|
| **Artist** | A band or busker. One login per Artist, shared among bandmates. |
| **Fan** | Someone reading Issues. Anonymous until they sign in with Google to sign a Wall or collect. |
| **Issue** | One gig's zine: city, venue, date, Cover, pages, Wall, Endpaper. Has its own QR. |
| **Master Template** | An Artist's reusable look and recurring pages, automatically included in every Issue. |
| **Bespoke page** | A page made for a single Issue (local shoutouts, setlist, a story from the road). |
| **Cover** | The first screen of an Issue: art, Cover note, one-tap Venmo tip, "Open tonight's zine." |
| **Back Page** | The Artist's home screen, opened by the Artist QR: tip, links, every Issue, General Wall. |
| **Issue QR / Artist QR** | The Issue QR opens that Issue's Cover. The Artist QR (permanent) opens the Back Page. |
| **Wall** | The open, public guestbook. One per Issue, plus the **General Wall** on the Back Page. |
| **Note** | A Fan's post on a Wall. Can get one Artist **Reply**. |
| **Endpaper** | The final page of an Issue, after the Wall, offering Save or Stamp. |
| **Saved** | A bookmarked Issue. Any Fan, from anywhere. |
| **Stamped** | Proof the Fan was at the gig: reached the Issue by scanning its QR within the **Stamp Window**. |
| **Stamp Window** | The period, in the venue's time zone, during which a QR scan makes a Fan eligible to Stamp. |
| **Scan Token** | A signed, time-stamped proof of attendance issued upon scanning an Issue QR during its Stamp Window, stored on device to claim a Stamp. |
| **Archived** | An Issue hidden from the Back Page but kept for Stubs, Tip Taps and its Wall. Issues are never deleted. |
| **Stub** | The ticket-stub display of a Stamped Issue. |
| **My Stubs** | A Fan's collection page: Stubs plus Saved. |
| **"Was there" mark** | A badge on a Note from a Fan who Stamped that Issue. |
| **General** | Tip Taps and Notes from the Back Page, not tied to any Issue. |
| **Venmo username** | The only tip setup an Artist does. Tip buttons open Venmo to pay this username. Changing it needs the password plus email confirmation. |
| **Tip Tap** | A record that a Fan tapped a tip button and Venmo was opened. Not a payment: Quire never sees whether money moved. Always called a tap, counted, never summed into dollars. |
| **Bookbinder** | The desktop split-screen editor for the Master Template and polished Issues (`text`, `setlist`, `photo`, `audio`, `video`). |
| **Quick Issue** | The `<60 sec` phone flow for publishing an Issue: city, venue, date, timezone, optional note/photo/setlist, publish. |
| **Studio Launchpad** | The 3-Step onboarding experience shown on `/dashboard` when an Artist has `0` issues (Master Template, First Issue / Busker QR fast-track, Add your Venmo). |
| **Full-Screen Case Display** | Chrome-free, high-contrast phone view of an Issue QR or Permanent Artist QR, built to sit beside a busker's guitar case or merch table. |
| **Gig Recap** | The dashboard card for the latest Issue: tip taps, stamps, notes, saves, and "Check Venmo for what came in." |
| **Demo** | A clearly labeled sandbox of Quire with sample Artists, Fans and Issues, for trying the product. Nothing in it is real: tip buttons never open Venmo, no email is sent, and nothing carries over to a real account. Never the default; it must be entered on purpose. |

## Key decisions (and why)

1. **Fans tip Artists directly through Venmo; Quire takes no cut and never touches the money.** The Artist enters a Venmo username and that is all the setup. A tip button opens Venmo with the amount and a note filled in, and the Fan confirms in Venmo (ADR 0008). *Superseded 2026-11-18: Stripe Connect Express with a 5% platform cut. The Stripe code is kept dormant.*
2. **One QR per Issue, one per Artist.** A pinned "current issue" would show the wrong city to anyone scanning an older sticker.
3. **Issue QR opens the Cover; Artist QR opens the Back Page.** A fan at the gig wants tonight's Issue, not the whole catalog.
4. **Tip-first Cover, anonymous one-tap tips.** Passers-by give a busker seconds, not minutes. The zine is optional.
5. **Quire records Tip Taps, never tips.** Quire can't see whether a payment went through, so it records that a Fan tapped and always labels it a tap. The dashboard counts taps, never shows a dollar total, and says "Check Venmo for what came in." *Superseded 2026-11-18: fee-covering opt-in (Stripe only).*
6. **Tips can't include a message from Quire.** Messages go on the Wall. The Venmo note is prefilled as "Tip for <Artist> via Quire" with no venue, city or date, because Venmo payments are public by default. The Fan can edit it in Venmo; Quire never sees it.
7. **Saved vs. Stamped.** Anyone can browse any Issue, so attendance has to be proven by the scan. The sticker is the geofence.
8. **Open Wall, not private messages.** Private messages are where creepy behavior hides. Public notes keep people accountable.
9. **Notes go live immediately, with flags, hide, block and optional approve-first.** Approving everything first kills walls, especially for busy buskers.
10. **Only Artists reply, one level deep.** Keeps the Wall as notes to the Artist, not a comment section.
11. **Only city + venue + date are required to publish.** Tired artists and daily buskers have to be able to publish quickly.
12. **Bookbinder (desktop) and Quick Issue (phone).** Two different jobs: designing the template versus publishing tonight's Issue.
13. **One login per Artist, email + password (with Resend reset); Google for Fans.** Bandmates shouldn't share a personal Google account, and forgot-password recovery uses Resend (`/login/reset`). Fans without Google will get a passwordless email link after launch; Fans never get passwords.
14. **Better Auth, with one user table and an account type.** It supports both sign-in methods and works with SvelteKit and Turso via Drizzle.
15. **Dashboard shows only tip taps and people.** It never presents taps as money received. No page views or bounce rates. No email digest. First-time artists with `0` issues see the **3-Step Studio Launchpad** instead of an empty gigs table.
16. **One house style (the dark glass UI prototype), vanilla CUBE CSS.** Artists change only cover art, WCAG contrast-checked `--accent` (against `--bg-void`), and a type pairing. `--highlight` (mint) and `--support` (pink) stay fixed for the whole platform. *Amended 2026-11-20: the Issue reader uses a cut-and-paste on dark look (grain, tape, tilted scraps, polaroids, typewriter and marker accents) so an Issue feels like a handmade zine; the rest of Quire stays dark glass (ADR 0009).*
17. **Decisions beat the UI prototype.** The prototype defines look and feel only. Its screens are read as the pages of one Issue, not a feed.
18. **Nothing happens unless the Fan taps.** Venmo opens only from a Fan's tap: no automatic redirect, queuing, retrying, reminders or "complete later." Recording a tap is best-effort and never blocks the Fan from paying.
19. **Stamps can be claimed later** if the scan happened inside the Stamp Window. Remote stamping via shared sticker photos is an accepted, documented tradeoff.
20. **Every Issue has a time zone** (the venue's). The Stamp Window and the morning-after recap use it.
21. **Issues are archived, never deleted.** Fans' Stubs and Tip Taps outlive the Issue.
22. **Restored notes can't be auto-hidden again**, which stops flag brigading.
23. **No links, emails or phone numbers in notes.** This blocks "text me" creepiness and spam.
24. **Changing or removing the Venmo username needs the password again plus email confirmation via Resend**, because the login is shared and a bandmate must not be able to quietly redirect tips. The old username stays live until the link is confirmed, and a notice is emailed after the change.
25. **Tip buttons are hidden until the Artist has a Venmo username.** Presets from $2 to $500, USD only (Venmo is US-only). The Demo, development and tests never open Venmo; they say what would have opened.
26. **Editable clean `/a/[slug]` on sign-up (`/login?mode=signup`).** Derived live from band name (no random 3-digit suffix), first-come, first-served with collision suggestions, because it is baked into the Permanent Artist QR sticker.
27. **Direct media uploads (`src/lib/server/storage/`) via Cloudflare R2 (local `/static/uploads` only in development and the Demo).** Master Template cover art, Quick Issue photo, and Bookbinder photo/audio blocks accept direct device uploads alongside URLs and `lite-youtube`/Bandcamp embeds. Photos are stripped of location and camera data on upload, and SVG files are not accepted.
28. **Full-Screen Case Display mode for QR codes.** Both Issue QR and Permanent Artist QR open chrome-free at full screen for busker cases and merch tables.
29. **A public Demo exists, but it is opt-in and always labeled.** Anyone trying Quire must know they are in the Demo, so no one mistakes sample data or a sample login for their real account.
30. **Production never pretends.** If a service Quire depends on is not set up, Quire tells people it is unavailable instead of quietly falling back to the Demo or to simulated sign-ins or emails. A missing core secret or database takes the whole site offline with an "unavailable" page; a missing integration (email, Fan sign-in, uploads) turns off only that feature, with an honest message, so Fans at a gig can still read tonight's Issue.
31. **Artists confirm their email before anything goes public or tips are set up.** They can sign in and build right away, but publishing an Issue, uploading media and adding a Venmo username wait for email confirmation, because the email controls resets and Venmo username changes.

## Stack

SvelteKit (Svelte 5) · Turso (libSQL) + Drizzle ORM · Better Auth · Venmo links (Stripe Connect code dormant, ADR 0008) · Resend · Cloudflare R2 · Netlify · vanilla CSS (CUBE, `@layer`)
