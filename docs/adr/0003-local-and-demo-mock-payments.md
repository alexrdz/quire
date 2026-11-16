# 3. Local and Demo Mock Payment Mode

When `STRIPE_SECRET_KEY` is unset or running in offline portfolio demo mode, Quire activates a simulated one-tap checkout flow rather than failing or disabling tipping. It creates valid tip records (calculating Stripe fee and 5% platform cut) and immediately updates dashboard metrics, enabling portfolio reviewers and automated tests to experience the full tipping lifecycle without live Stripe credentials or internet access.
