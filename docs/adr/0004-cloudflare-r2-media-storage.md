# 4. Media Storage via Cloudflare R2

We adopt Cloudflare R2 (S3-compatible API) as the media storage solution for Artist uploads (cover art, issue photos, bespoke assets), with a local filesystem fallback for zero-dependency offline local development.

## Context & Trade-offs
- **Scale:** Netlify Blobs is adequate for key-value application data and small-scale caching, but charges for bandwidth and operations beyond modest free tiers. In contrast, 15 to 1,000+ artists uploading thousands or tens of thousands of photos would quickly incur bandwidth/storage costs on Netlify.
- **Zero Egress Fees:** When hundreds or thousands of fans scan QR codes at a live concert and stream zine images simultaneously, Cloudflare R2 incurs $0.00 in egress bandwidth fees.
- **S3 Standard:** Using `@aws-sdk/client-s3` prevents vendor lock-in to Netlify infrastructure and allows direct presigned uploads with client-side image resizing/compression (WebP/AVIF).
- **Development Fallback:** When R2 credentials are unset in local development, Quire saves files locally to `/static/uploads`.
