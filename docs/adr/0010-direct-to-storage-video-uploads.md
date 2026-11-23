---
status: accepted
date: 2026-11-23
---

# 10. Direct-to-Storage Video Uploads and Video Location Privacy

Artists can record a short video in the browser, or pick a clip from their phone, and put it on an Issue page from Quick Issue or the Bookbinder (PR #41). Production runs on Netlify Functions, which accept a request body of about 6 MB. A 60-second recording is 15 to 23 MB (measured in B1-T18), so video can't travel through a form action the way photos and audio do. Clips picked from a phone's camera roll also often carry the GPS location where they were filmed, and Quire stored them byte for byte at a public URL.

Video bytes go **straight from the Artist's browser to Cloudflare R2**, and **no video in Quire carries a location**.

## How an upload works

1. **Presign.** The browser asks Quire for an upload slot, giving the type (MP4, WebM or MOV) and the size. Quire checks the same gates as every upload: uploads are available, the Artist's email is confirmed (decision 31), the size is at most 50 MB, and the Artist is under the upload rate limit. It returns a short-lived presigned PUT URL for a key under `pending/<artistId>/`.
2. **Upload.** The browser sends the bytes to R2 directly, showing progress. The function never sees them.
3. **Finalize.** The browser tells Quire the upload is done. Quire checks that the key belongs to this Artist, checks the stored size, detects the type from the file's first bytes, and checks for location data. If everything passes, it moves the file to its public key. If anything fails, it deletes the pending file and says why.
4. **Use.** The Quick Issue or Bookbinder form submits only the finalized upload, and the server checks that it was finalized by this Artist.

Pending files are deleted by an R2 lifecycle rule after one day, so abandoned or refused uploads never pile up. Development and the Demo have no R2; a local stand-in endpoint behind the same flow writes to `static/uploads` and is never routed in production.

## Location

- **Stripped on the phone.** Before uploading an MP4 or MOV, the browser overwrites every location value (`©xyz`, `com.apple.quicktime.location.ISO6709`, `loci` and similar keys) in place, keeping every size and offset, so the clip still plays.
- **Checked on the server.** Finalize reads the file's metadata box and refuses any video that still has a location, so an old or modified client can't publish one. The Artist sees: "This video still has location data, so we didn't post it. Record it here instead, or turn off location for this clip and try again."
- Clips recorded in Quire's own recorder carry no location.

## Playback

The recorder prefers MP4 with H.264 where the browser can record it, and falls back to WebM, so clips recorded on Android or desktop Chrome also play on iPhones. Quire doesn't transcode.

## Considered options

- **Keep uploads in the form action.** Rejected: anything over about 6 MB fails in production, which is most clips over 15 to 25 seconds.
- **Upload in chunks through the function.** Rejected: more moving parts than a presigned PUT, and every chunk still pays the function's time limit.
- **Strip location only on the server.** Rejected: the server would have to download and re-upload every clip inside the function's time limit. The server checks, and refuses if needed.
- **Refuse all camera-roll clips.** Rejected: Artists film on their phones, and stripping in the browser keeps those clips usable.

## Consequences

- The R2 bucket needs a CORS rule that allows `PUT` from Quire's own origins, and a lifecycle rule for `pending/`. Both are dashboard settings.
- The CSP `connect-src` allows the R2 upload origin.
- Amends decision 27: video uploads go direct to R2, and videos, like photos, are published without location data.
