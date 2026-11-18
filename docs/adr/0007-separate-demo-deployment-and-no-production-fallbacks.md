---
status: accepted
---

# 7. Separate Demo Deployment and No Silent Fallbacks in Production

The public Demo runs as its own deployment with its own database, enabled by `DEMO_MODE=true`, and is never reachable from the production site. In production, a missing required secret or service key (auth and scan-token secrets, Stripe, Resend, Google, Turso, R2) puts Quire into an explicit "unavailable" state instead of falling back to seeded data, mock sign-ins, simulated tips or console-logged email. This narrows ADR 0003 and ADR 0004: their local fallbacks apply only to development and tests.

## Considered Options

- **Demo accounts inside the production database.** Rejected: sample Artists would appear beside real ones, the seeded artist's known password would exist in the real database, and every demo/real boundary check becomes a place where a bug lets demo activity touch real Artists, tips or Walls.

## Consequences

- Two Netlify sites and two Turso databases to run. The Demo uses Stripe test keys, sends no email, shows a Demo banner on every page and is reset on a schedule.
- Seeding, `/demo` and all mock paths are gated on `DEMO_MODE` or development, never on a missing key.
