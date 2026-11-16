# 1. Issue QR Scan Verification via Dedicated Secret Endpoint

Physical Issue QR codes embed a dedicated scan URL (`/scan/[issue_slug]?k=[issue_secret]`) rather than the public Issue Cover URL (`/i/[issue_slug]`). When scanned within the Issue's Stamp Window, the server verifies the secret and timestamp, sets a signed device scan token, and redirects to the Cover. This preserves the core "sticker is the geofence" principle: direct links shared online allow reading and tipping, but only physical QR scans confer Stamp eligibility.
