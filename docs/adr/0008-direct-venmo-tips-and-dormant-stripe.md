---
status: accepted
date: 2026-11-18
---

# 8. Direct Venmo Tips, Tip Taps, and Dormant Stripe

Fans tip Artists directly through Venmo. The Artist enters a Venmo username, and that is all the setup there is. A tip button opens Venmo with the amount and a note filled in, and the Fan confirms the payment in Venmo. Quire never touches the money and takes no cut.

Quire cannot see whether a payment went through, so it records **Tip Taps**, not tips: a Tap means a Fan tapped a tip button, nothing more. Taps are always labeled as taps, counted but never summed into a dollar figure, and never presented as money received. The dashboard tells the Artist to check Venmo for what came in.

This supersedes the Stripe Connect Express decisions in ADR 0002 and ADR 0003 (connected accounts, the 5% application fee, fee-covering, webhooks, refunds and chargebacks). The Stripe code stays in the repository but is **dormant**: no route, page or setting reaches it, no Stripe key is required in any mode, and the Stripe webhook endpoint returns 404. Reviving Stripe is a future project, not a switch.

## Rules

- **Setup:** the Artist enters a Venmo username (5 to 30 characters: letters, numbers, `-` and `_`; a leading `@` is stripped). Setting it the first time requires a confirmed email (CONTEXT decision 31) and nothing else. Setup offers a "Test your link" action so the Artist can check the username opens their own Venmo profile.
- **Changing or removing the username** requires the password again plus a confirmation link sent to the account email, because the login is shared and a bandmate must not be able to quietly redirect tips. The old username stays in use until the link is confirmed. The confirmation page only shows the pending change; a POST confirms it. After the change, a notice is emailed to the account address. If email is unavailable, changes are blocked with "We can't send email right now."
- **Tip buttons appear only when the Artist has a Venmo username.** Presets stay $2 to $500, USD only.
- **Nothing happens unless the Fan taps.** Venmo opens only from a Fan's tap. No automatic opening or redirect, no reminders, no follow-up.
- **The prefilled note is generic:** `Tip for <Artist name> via Quire`. It never names the venue, city or date, because Venmo payments are public by default and a note would show where the Fan was. The Fan can edit the note in Venmo; Quire never sees it.
- **A Tap is recorded when the Fan taps:** Artist, Issue (or General for the Back Page), the preset amount selected, and the time. No Fan identity. Recording is best-effort: if it fails or the Fan is over a rate limit, Venmo still opens and the Tap is not counted. A Fan is never blocked from paying an Artist.
- **The dashboard shows Tap counts only**, labeled as taps ("14 tip taps"), with "Check Venmo for what came in." No gross, fees, net, payouts or dollar totals.
- **The Demo, development and tests never open Venmo.** The Tap is recorded and the Fan sees "In the Demo, this would open Venmo to pay $5 to @username." Sample usernames may belong to real people, so no real Venmo link is ever opened from sample data. Only production opens Venmo.

## Considered options

- **Stripe Connect Express with a 5% cut** (ADR 0003). Rejected for now: onboarding, webhooks, refunds, disputes, Radar and fee handling were a large operational and compliance load for a small product.
- **Remove the Stripe code entirely.** Rejected by the product owner: it is kept dormant so it can be revived later.
- **Show tapped dollar amounts on the dashboard.** Rejected: a dollar total of taps is easily misread as income Quire cannot confirm.
- **Put the gig in the Venmo note.** Rejected: Venmo feeds are public by default, so it would publish Fans' whereabouts.

## Consequences

- No payment secrets in production; the `payments` feature flag no longer gates tips. Tips are available whenever the Artist has a Venmo username.
- Venmo is US-only, so Fans outside the US cannot tip.
- Venmo's own terms govern the payment. Venmo expects people receiving payments for goods and services to use a business profile; Quire tells Artists this in setup and does not enforce it.
- Plan items that only existed for Stripe are parked: Stripe Radar (2.5) and webhook hardening (3.1). Payout confirmation (3.3) becomes the Venmo change confirmation.
