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
| **Cover** | The first screen of an Issue: art, Cover note, one-tap tip, "Open tonight's zine." |
| **Back Page** | The Artist's home screen, opened by the Artist QR: tip, links, every Issue, General Wall. |
| **Issue QR / Artist QR** | The Issue QR opens that Issue's Cover. The Artist QR (permanent) opens the Back Page. |
| **Wall** | The open, public guestbook. One per Issue, plus the **General Wall** on the Back Page. |
| **Note** | A Fan's post on a Wall. Can get one Artist **Reply**. |
| **Endpaper** | The final page of an Issue, after the Wall, offering Save or Stamp. |
| **Saved** | A bookmarked Issue. Any Fan, from anywhere. |
| **Stamped** | Proof the Fan was at the gig: reached the Issue by scanning its QR within the **Stamp Window**. |
| **Stamp Window** | The period, in the venue's time zone, during which a QR scan makes a Fan eligible to Stamp. |
| **Scan Token** | A signed, time-stamped proof of attendance issued upon scanning an Issue QR during its Stamp Window, stored on device to claim a Stamp. |
| **Archived** | An Issue hidden from the Back Page but kept for Stubs, tip records and its Wall. Issues are never deleted. |
| **Stub** | The ticket-stub display of a Stamped Issue. |
| **My Stubs** | A Fan's collection page: Stubs plus Saved. |
| **"Was there" mark** | A badge on a Note from a Fan who Stamped that Issue. |
| **General** | Tips and Notes from the Back Page, not tied to any Issue. |
| **Bookbinder** | The desktop split-screen editor for the Master Template and polished Issues. |
| **Quick Issue** | The phone flow for publishing an Issue: city, venue, date, publish. |
| **Gig Recap** | The dashboard card for the latest Issue: tips, stamps, notes, saves. |

## Key decisions (and why)

1. **Portfolio first, Bandcamp-style 5% cut of tips.** Stripe Connect in test mode. It demonstrates real marketplace payment patterns without the burden of handling real money.
2. **One QR per Issue, one per Artist.** A pinned "current issue" would show the wrong city to anyone scanning an older sticker.
3. **Issue QR opens the Cover; Artist QR opens the Back Page.** A fan at the gig wants tonight's Issue, not the whole catalog.
4. **Tip-first Cover, anonymous one-tap tips.** Passers-by give a busker seconds, not minutes. The zine is optional.
5. **Artist absorbs fees by default; unchecked opt-in for fans to cover them.** A pre-checked box would be a dark pattern.
6. **Tips can't include a message.** Messages go on the Wall, so there's no hidden channel for creeps.
7. **Saved vs. Stamped.** Anyone can browse any Issue, so attendance has to be proven by the scan. The sticker is the geofence.
8. **Open Wall, not private messages.** Private messages are where creepy behavior hides. Public notes keep people accountable.
9. **Notes go live immediately, with flags, hide, block and optional approve-first.** Approving everything first kills walls, especially for busy buskers.
10. **Only Artists reply, one level deep.** Keeps the Wall as notes to the Artist, not a comment section.
11. **Only city + venue + date are required to publish.** Tired artists and daily buskers have to be able to publish quickly.
12. **Bookbinder (desktop) and Quick Issue (phone).** Two different jobs: designing the template versus publishing tonight's Issue.
13. **One login per Artist, email + password; Google for Fans.** Bandmates shouldn't share a personal Google account.
14. **Better Auth, with one user table and an account type.** It supports both sign-in methods and works with SvelteKit and Turso via Drizzle.
15. **Dashboard shows only money and people.** No page views or bounce rates. No email digest.
16. **One house style (the dark glass UI prototype), vanilla CUBE CSS.** Artists change only cover art, `--accent` and a type pairing. `--highlight` (mint) and `--support` (pink) stay fixed for the whole platform.
17. **Decisions beat the UI prototype.** The prototype defines look and feel only. Its screens are read as the pages of one Issue, not a feed.
18. **Tips are charged only when the fan taps, never later.** A failed tip resets, with no queuing, retrying or "complete later." A charge the fan didn't actively make right then would erode trust.
19. **Stamps can be claimed later** if the scan happened inside the Stamp Window. Remote stamping via shared sticker photos is an accepted, documented tradeoff.
20. **Every Issue has a time zone** (the venue's). The Stamp Window and the morning-after recap use it.
21. **Issues are archived, never deleted.** Fans' Stubs and tip records outlive the Issue.
22. **Restored notes can't be auto-hidden again**, which stops flag brigading.
23. **No links, emails or phone numbers in notes.** This blocks "text me" creepiness and spam.
24. **Changing the payout account needs the password again plus email confirmation**, because the login is shared.
25. **Tip buttons are hidden until payouts are enabled.** A $2 minimum, a $500 maximum, USD only.

## Stack

SvelteKit · Turso (libSQL) + Drizzle · Better Auth · Stripe Connect (Express) · Netlify · vanilla CSS (CUBE, `@layer`)
