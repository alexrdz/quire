# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fluid-landing.spec.ts >> enlarged landing text reflows without clipping core content
- Location: tests/e2e/fluid-landing.spec.ts:70:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Object {
-   "bottom": true,
+   "bottom": false,
    "top": true,
  }
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - generic [ref=e5]:
      - link "QUIRE DIGITAL ZINES" [ref=e6] [cursor=pointer]:
        - /url: /
        - generic [ref=e7]: QUIRE
        - generic [ref=e9]: DIGITAL ZINES
      - generic [ref=e10]:
        - link "Artist Sign In" [ref=e11] [cursor=pointer]:
          - /url: /login
        - link "Claim Band Zine" [ref=e12] [cursor=pointer]:
          - /url: /login?mode=signup
  - main [ref=e13]:
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: THE DIGITAL ZINE FOR LIVE MUSIC
        - heading "Your Venmo QR collects tips. Quire brings the people too." [level=1] [ref=e21]:
          - text: Your Venmo QR collects tips.
          - generic [ref=e22]: Quire brings the people too.
        - paragraph [ref=e23]: City-specific digital zines published by touring bands, solo acts, and buskers. Tips that open your Venmo prefilled, attendance-verified ticket stubs, unreleased demo drops, and a living backstage wall for every stop on tour.
        - generic [ref=e24]:
          - link "Claim Your Tour Zine" [ref=e25] [cursor=pointer]:
            - /url: /login?mode=signup
          - link "Explore Live Brooklyn Zine" [ref=e29] [cursor=pointer]:
            - /url: /i/neon-velvet-brooklyn-2026-10-12
          - link "View Artist Hub ↗" [ref=e31] [cursor=pointer]:
            - /url: /a/the-neon-velvet
        - generic [ref=e33]:
          - generic [ref=e38]:
            - generic [ref=e39]: 60-Second Setup
            - generic [ref=e40]: Clone per city before soundcheck
          - generic [ref=e45]:
            - generic [ref=e46]: Tips Straight to Your Venmo
            - generic [ref=e47]: Quire takes no cut
          - generic [ref=e52]:
            - generic [ref=e53]: Verified Stubs
            - generic [ref=e54]: No GPS, stamped by physical QR
      - generic [ref=e55]:
        - generic [ref=e56]:
          - generic [ref=e57]: LIVE INTERACTIVE PROTOTYPE
          - paragraph [ref=e58]: "Tap tabs, play audio, or simulate a tip:"
        - generic [ref=e60]:
          - generic [ref=e61]:
            - generic [ref=e62]: 9:41
            - generic [ref=e65]:
              - generic [ref=e66]: ●●●
              - generic [ref=e67]: 98%
          - generic [ref=e68]:
            - generic [ref=e69]:
              - generic [ref=e70]: QUIRE.
              - generic [ref=e71]: LIVE ZINE
            - link "Artist Login" [ref=e73] [cursor=pointer]:
              - /url: /login
          - navigation "Zine Sections" [ref=e74]:
            - button "Track" [ref=e75] [cursor=pointer]
            - button "Photo" [ref=e76] [cursor=pointer]
            - button "Notes" [ref=e77] [cursor=pointer]
            - button "Wall" [ref=e78] [cursor=pointer]
          - main [ref=e79]:
            - generic [ref=e80]:
              - generic [ref=e83]:
                - button "Play audio demo" [ref=e84] [cursor=pointer]
                - generic [ref=e87]: TAP TO LISTEN
              - generic [ref=e88]:
                - generic [ref=e89]:
                  - generic [ref=e90]: OCT 12
                  - generic [ref=e91]: BROOKLYN, NY
                  - generic [ref=e92]: 00:00 / 03:42
                - generic [ref=e93]:
                  - heading "Studio Session 04" [level=2] [ref=e94]
                  - paragraph [ref=e95]: Rough mix of the new bridge from Greenpoint rehearsal. Needs more fuzz.
                - generic [ref=e116]:
                  - button "1-Tap Tip" [ref=e117] [cursor=pointer]
                  - button "3 Notes" [ref=e121] [cursor=pointer]
    - generic [ref=e125]:
      - generic [ref=e127]:
        - generic [ref=e128]: DESIGNED FOR GIGS
        - heading "A Living Artifact For Every Show" [level=2] [ref=e129]
        - paragraph [ref=e130]: Traditional link trees feel like corporate spreadsheets. Quire captures the raw, electric atmosphere of a live venue in an instant-loading web zine.
        - generic [ref=e131]:
          - button "For Touring Bands & Artists" [ref=e132] [cursor=pointer]
          - button "For Fans & Music Lovers" [ref=e133] [cursor=pointer]
      - generic [ref=e135]:
        - generic [ref=e137]:
          - generic [ref=e141]:
            - heading "Tips Straight to Your Venmo" [level=3] [ref=e142]
            - paragraph [ref=e143]: Keep your Venmo. A fan taps an amount and Venmo opens with your handle, the amount and a note already filled in. 100% of the tip goes to your Venmo, and Quire never touches the money.
          - generic [ref=e144]:
            - generic [ref=e145]: ·Opens Venmo Prefilled
            - generic [ref=e146]: ·No Cut
            - generic [ref=e147]: ·No App for Quire
        - generic [ref=e149]:
          - generic [ref=e153]:
            - heading "60-Second City Cloning" [level=3] [ref=e154]
            - paragraph [ref=e155]: Design your master aesthetic once in the Bookbinder. When you roll into Philadelphia or Detroit, clone the issue, type tonight's setlist, and your city issue is live before soundcheck ends.
          - generic [ref=e156]:
            - generic [ref=e157]: ·Bookbinder Engine
            - generic [ref=e158]: ·Mobile Friendly
        - generic [ref=e160]:
          - generic [ref=e164]:
            - heading "The Physical QR Geofence" [level=3] [ref=e165]
            - paragraph [ref=e166]: Zero invasive GPS tracking. Your physical sticker on the amp or merch table is the geofence. Fans who scan during the gig's 48-hour Stamp Window earn authentic attendance proof.
          - generic [ref=e167]:
            - generic [ref=e168]: ·Cryptographic HMAC
            - generic [ref=e169]: ·No Location Prompts
        - generic [ref=e171]:
          - generic [ref=e175]:
            - heading "An Algorithmic-Free Wall" [level=3] [ref=e176]
            - paragraph [ref=e177]: Stop begging fans to comment on social algorithms that hide your posts. Your Quire wall is a permanent, moderation-controlled guestbook where you can reply directly with your verified band badge.
          - generic [ref=e178]:
            - generic [ref=e179]: ·Verified Artist Badge
            - generic [ref=e180]: ·Built-in Moderation
    - generic [ref=e181]:
      - generic [ref=e182]:
        - generic [ref=e183]: CURRENT RUNNING TOUR
        - heading "The Neon Velvet — East Coast Fall Run" [level=2] [ref=e184]
        - paragraph [ref=e185]: Explore real live issues currently published on the platform. Each stop features custom setlists, photo stubs, and city notes.
      - generic [ref=e187]:
        - generic [ref=e188]:
          - generic [ref=e190]:
            - generic [ref=e191]:
              - generic [ref=e192]: GIG 01 · ACTIVE
              - generic [ref=e194]: OCT 12, 2026
            - generic [ref=e195]:
              - heading "Brooklyn, NY" [level=3] [ref=e196]
              - generic [ref=e197]: Baby's All Right
            - paragraph [ref=e198]: "\"Tour kickoff show! Playing the entire new record with extended fuzz jams and analog delays.\""
            - generic [ref=e199]:
              - generic [ref=e200]: "·Demo: Studio Session 04"
              - generic [ref=e201]: ·Verified Attendance Open
              - generic [ref=e202]: ·24 Guestbook Notes
            - generic [ref=e203]:
              - link "View Brooklyn Zine →" [ref=e204] [cursor=pointer]:
                - /url: /i/neon-velvet-brooklyn-2026-10-12
              - link "Simulate QR Scan" [ref=e205] [cursor=pointer]:
                - /url: /scan/neon-velvet-brooklyn-2026-10-12?k=kickoff_babys_secret_2026
          - generic [ref=e207]:
            - generic [ref=e208]:
              - generic [ref=e209]: GIG 02 · READY
              - generic [ref=e210]: OCT 15, 2026
            - generic [ref=e211]:
              - heading "Philadelphia, PA" [level=3] [ref=e212]
              - generic [ref=e213]: Johnny Brenda's
            - paragraph [ref=e214]: "\"Balcony was shaking during the chorus. Fish & chips downstairs after the midnight set.\""
            - generic [ref=e215]:
              - generic [ref=e216]: ·Soundboard Rehearsal
              - generic [ref=e217]: ·35mm Tour Photo Stubs
              - generic [ref=e218]: ·Backstage Wall Ready
            - link "View Philly Zine →" [ref=e220] [cursor=pointer]:
              - /url: /i/neon-velvet-philly-2026-10-15
          - generic [ref=e222]:
            - generic [ref=e223]:
              - generic [ref=e224]: GIG 03 · READY
              - generic [ref=e225]: OCT 18, 2026
            - generic [ref=e226]:
              - heading "Washington, DC" [level=3] [ref=e227]
              - generic [ref=e228]: Black Cat
            - paragraph [ref=e229]: "\"Main stage tonight. Soundcheck sounded massive. Catch us at the merch booth.\""
            - generic [ref=e230]:
              - generic [ref=e231]: ·Acoustic Opening Take
              - generic [ref=e232]: ·Verified Attendance
              - generic [ref=e233]: ·Guestbook Live
            - link "View DC Zine →" [ref=e235] [cursor=pointer]:
              - /url: /i/neon-velvet-dc-2026-10-18
        - generic [ref=e237]:
          - generic [ref=e238]:
            - heading "Looking for band discography or your personal wallet?" [level=4] [ref=e239]
            - paragraph [ref=e240]: Explore the full artist hub or inspect your collected digital ticket stubs.
          - generic [ref=e241]:
            - link "View Artist Profile (/a/the-neon-velvet)" [ref=e242] [cursor=pointer]:
              - /url: /a/the-neon-velvet
            - link "My Fan Stubs (/me/stubs)" [ref=e243] [cursor=pointer]:
              - /url: /me/stubs
    - generic [ref=e244]:
      - generic [ref=e245]:
        - generic [ref=e246]: THE 3-STEP PIPELINE
        - heading "Zero Friction From Stage to Pocket" [level=2] [ref=e247]
        - paragraph [ref=e248]: Built for artists who want to spend their time making noise, not managing social media platforms.
      - generic [ref=e250]:
        - generic [ref=e252]:
          - generic [ref=e253]: "01"
          - heading "Create Master Template" [level=3] [ref=e254]
          - paragraph [ref=e255]: "Build your recurring tour pages once in the Bookbinder: band bio, merch links, and signature accent color."
          - generic [ref=e256]: "Setup time: ~3 minutes"
        - generic [ref=e258]:
          - generic [ref=e259]: "02"
          - heading "Clone Before Soundcheck" [level=3] [ref=e260]
          - paragraph [ref=e261]: Before hitting the stage, enter tonight's city and venue. Attach today's demo or setlist. Print or display the auto-generated QR.
          - generic [ref=e262]: "Publish time: <60 seconds"
        - generic [ref=e264]:
          - generic [ref=e265]: "03"
          - heading "Fans Scan & Connect" [level=3] [ref=e266]
          - paragraph [ref=e267]: Fans scan with their native phone camera. No app download. They tip via Venmo, stamp their ticket stub, and sign your wall.
          - generic [ref=e268]: "Fan engagement: 0.8s load"
    - generic [ref=e269]:
      - generic [ref=e270]:
        - generic [ref=e271]: WHY IT MATTERS
        - heading "More Than a Venmo Sign" [level=2] [ref=e272]
        - paragraph [ref=e273]: Keep your Venmo for the money. Quire adds the zine, the stubs and the wall around it.
      - table [ref=e276]:
        - rowgroup [ref=e277]:
          - row [ref=e278]:
            - columnheader "Experience" [ref=e279]
            - columnheader "Just a Venmo QR / Link in Bio" [ref=e280]
            - columnheader "Quire Digital Zine" [ref=e281]
        - rowgroup [ref=e282]:
          - row [ref=e283]:
            - cell "Audience Retention" [ref=e284]
            - cell "Zero retention. Money leaves, fan vanishes" [ref=e285]
            - cell "Attendance stubs & permanent guestbook ties" [ref=e286]
          - row [ref=e287]:
            - cell "Tip Friction" [ref=e288]
            - cell "Fan searches your handle and types an amount" [ref=e289]
            - cell "Tap $5 and Venmo opens with your handle, amount and note filled in" [ref=e290]
          - row [ref=e291]:
            - cell "Concert Collectibles" [ref=e292]
            - cell "None. Paper stubs are lost forever" [ref=e293]
            - cell "Cryptographic ticket stub with venue & date" [ref=e294]
          - row [ref=e295]:
            - cell "Music & Unreleased Audio" [ref=e296]
            - cell "External redirect to Spotify where royalties pay $0.003" [ref=e297]
            - cell "Embedded backstage audio stream & stems" [ref=e298]
          - row [ref=e299]:
            - cell "App Store Barrier" [ref=e300]
            - cell "60MB app downloads fail on venue cellular data" [ref=e301]
            - cell "Instant web standard, 0.8s time-to-interactive" [ref=e302]
    - generic [ref=e306]:
      - generic [ref=e307]: TOUR READY IN 60 SECONDS
      - heading "Turn Tonight's Crowd Into A Lifelong Community." [level=2] [ref=e308]
      - paragraph [ref=e309]: No platform gatekeepers. No social media algorithms hiding your art. Give your next live show the zine it deserves.
      - generic [ref=e310]:
        - link "Create Your Free Zine" [ref=e311] [cursor=pointer]:
          - /url: /login?mode=signup
        - link "Explore Live Brooklyn Zine" [ref=e315] [cursor=pointer]:
          - /url: /i/neon-velvet-brooklyn-2026-10-12
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { build } from 'vite';
  3  | import { svelte } from '@sveltejs/vite-plugin-svelte';
  4  | import { fileURLToPath } from 'node:url';
  5  | 
  6  | let javascript: string;
  7  | let stylesheet: string;
  8  | 
  9  | test.beforeAll(async () => {
  10 | 	const root = fileURLToPath(new URL('../..', import.meta.url));
  11 | 	const entry = '\0quire-fluid-preview';
  12 | 	// mount the actual frontend component; no server, api fixtures, or runtime stubs.
  13 | 	const output = await build({
  14 | 		root,
  15 | 		configFile: false,
  16 | 		logLevel: 'error',
  17 | 		resolve: { alias: { $lib: `${root}/src/lib` } },
  18 | 		plugins: [{
  19 | 			name: 'fluid-component-preview',
  20 | 			resolveId: (id) => id === 'virtual:fluid-preview' ? entry : undefined,
  21 | 			load: (id) => id === entry ? `
  22 | 				import { mount } from 'svelte';
  23 | 				import Page from '${root}/src/routes/(site)/+page.svelte';
  24 | 				import '${root}/src/app.css';
  25 | 				mount(Page, { target: document.body });
  26 | 			` : undefined
  27 | 		}, svelte()],
  28 | 		build: {
  29 | 			write: false,
  30 | 			minify: false,
  31 | 			cssCodeSplit: false,
  32 | 			rollupOptions: {
  33 | 				input: 'virtual:fluid-preview',
  34 | 				output: { format: 'iife', name: 'FluidPreview', inlineDynamicImports: true }
  35 | 			}
  36 | 		}
  37 | 	});
  38 | 	const result = Array.isArray(output) ? output[0] : output;
  39 | 	if (!('output' in result)) throw new Error('expected an in-memory preview bundle');
  40 | 	javascript = result.output.filter((item) => item.type === 'chunk').map((item) => item.code).join('\n');
  41 | 	stylesheet = result.output.flatMap((item) =>
  42 | 		item.type === 'asset' && item.fileName.endsWith('.css') ? [item.source] : []).join('\n');
  43 | });
  44 | 
  45 | test.beforeEach(async ({ page }) => {
  46 | 	await page.route('https://images.unsplash.com/**', (route) => route.abort());
  47 | 	await page.setContent('<!doctype html><html lang="en"><head></head><body></body></html>');
  48 | 	await page.addStyleTag({ content: stylesheet });
  49 | 	await page.addScriptTag({ content: javascript });
  50 | 	await expect(page.locator('h1')).toBeVisible();
  51 | });
  52 | 
  53 | test('real landing and simulator remain usable at narrow, intermediate, and wide widths', async ({ page }) => {
  54 | 	for (const width of [320, 390, 768, 859, 860, 861, 1023, 1024, 1025, 1240, 1600]) {
  55 | 		await page.setViewportSize({ width, height: 1000 });
  56 | 		expect(await page.locator('.phone-frame').evaluate((el) => el.scrollWidth <= el.clientWidth),
  57 | 			`phone overflow at ${width}`).toBe(true);
  58 | 		for (const tab of ['Photo', 'Notes', 'Wall', 'Track']) {
  59 | 			await page.getByRole('button', { name: tab, exact: true }).click();
  60 | 			await expect(page.locator('.card-page')).toBeVisible();
  61 | 			expect(await page.locator('.card-page').evaluate((el) => el.scrollWidth <= el.clientWidth),
  62 | 				`${tab} overflow at ${width}`).toBe(true);
  63 | 		}
  64 | 		await page.getByRole('button', { name: '1-Tap Tip', exact: true }).click();
  65 | 		await expect(page.getByRole('heading', { name: 'Support The Neon Velvet' })).toBeVisible();
  66 | 		await page.getByRole('button', { name: 'Close', exact: true }).click();
  67 | 	}
  68 | });
  69 | 
  70 | test('enlarged landing text reflows without clipping core content', async ({ page }) => {
  71 | 	await page.setViewportSize({ width: 320, height: 1000 });
  72 | 	await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  73 | 	await expect(page.locator('h1')).toBeVisible();
  74 | 	expect(await page.locator('.hero-headline').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  75 | 	const bounds = await page.locator('.card-headline').evaluate((el) => {
  76 | 		const card = el.closest('.card-page')!.getBoundingClientRect();
  77 | 		const text = el.getBoundingClientRect();
  78 | 		return { top: text.top >= card.top, bottom: text.bottom <= card.bottom };
  79 | 	});
> 80 | 	expect(bounds).toEqual({ top: true, bottom: true });
     |                 ^ Error: expect(received).toEqual(expected) // deep equality
  81 | 	await page.getByRole('button', { name: 'Notes', exact: true }).click();
  82 | 	await expect(page.locator('.notes-scrollable-area')).toBeVisible();
  83 | 	expect(await page.locator('.notes-scrollable-area').evaluate((el) =>
  84 | 		el.clientHeight > 0 && el.scrollWidth <= el.clientWidth)).toBe(true);
  85 | });
  86 | 
```