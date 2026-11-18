# 3. Stripe Connect Express Payments, Resend Emails, and Local Development Fallback

Quire integrates Stripe Connect Express (`stripe` SDK) for connected artist accounts, Express onboarding, one-tap tip checkouts with a 5% platform `application_fee_amount`, and cryptographically verified webhooks (`payment_intent.succeeded`, `checkout.session.completed`, `account.updated`, `charge.refunded`, `charge.dispute.created`), alongside Resend (`resend` SDK) for transactional emails (email verification, password resets, and SPEC 6.4 payout account change confirmations). When `STRIPE_SECRET_KEY` or `RESEND_API_KEY` are unset in local development or automated CI tests, the infrastructure adapters fall back to deterministic local execution that computes exact domain fee splits (`src/lib/domain/tipping.ts`), records tips in the database, and logs email payloads to the console.


> Narrowed by ADR 0007: these fallbacks apply only in development, tests and the Demo deployment, never in production.
