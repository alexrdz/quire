<script lang="ts">
	import ZineSimulator from '$lib/components/landing/ZineSimulator.svelte';
	import { Container, Split, Stack, Cluster, Grid, Center, Switcher, Box } from '$lib/components/layout';

	// Svelte 5 state
	let activeAudienceTab = $state<'artists' | 'fans'>('artists');
</script>

<svelte:head>
	<title>Quire — Digital Zines for Live Gigs</title>
	<meta
		name="description"
		content="City-specific digital zines for touring bands and buskers. 1-tap tipping, attendance-verified ticket stubs, unreleased audio drops, and open guestbook walls."
	/>
</svelte:head>

<div class="landing-page-root">
	<!-- Ambient Background Glows -->
	<div class="ambient-glow cyan-glow"></div>
	<div class="ambient-glow pink-glow"></div>
	<div class="ambient-glow mint-glow"></div>

	<!-- Top Navigation -->
	<header class="top-nav">
		<Container width="main" padding="none">
			<div class="nav-container">
				<a href="/" class="brand-link">
					<span class="brand-logo">QUIRE</span>
					<span class="brand-dot"></span>
					<span class="brand-tagline">DIGITAL ZINES</span>
				</a>

				<nav class="nav-menu" aria-label="Main Navigation">
					<a href="#features" class="nav-item">Features</a>
					<a href="#simulator" class="nav-item">Interactive Demo</a>
					<a href="#tour-showcase" class="nav-item">Live Tour</a>
					<a href="#how-it-works" class="nav-item">How It Works</a>
					<a href="/case-study" class="nav-item">Architecture</a>
				</nav>

				<Cluster align="center" gap="xs">
					<a href="/demo" class="nav-btn-secondary">
						<span class="btn-dot">●</span> Demo Tour
					</a>
					<a href="/login" class="nav-btn-primary">
						Artist Sign In →
					</a>
				</Cluster>
			</div>
		</Container>
	</header>

	<main id="main-content">
		<!-- HERO SECTION -->
		<section class="hero-section">
			<Container width="main" padding="none">
				<Split ratio="1-1" gap="lg" collapse="md" align="center">
					<!-- Hero Left Column: Copy & CTAs -->
					<div class="hero-content">
						<Stack gap="lg">
							<div class="hero-eyebrow">
								<span class="live-ping"></span>
								<span>THE DIGITAL ZINE FOR LIVE MUSIC</span>
							</div>

							<h1 class="hero-headline">
								Your Venmo QR collects money.
								<span class="neon-highlight-text">This collects money and people.</span>
							</h1>

							<p class="hero-subtext">
								City-specific digital zines published by touring bands, solo acts, and buskers.
								1-tap crowd tipping, attendance-verified ticket stubs, unreleased demo drops,
								and a living backstage wall for every stop on tour.
							</p>

							<!-- Call to Action Buttons -->
							<Cluster align="center" gap="sm">
								<a href="/login" class="hero-btn-primary">
									<span>Claim Your Tour Zine</span>
									<svg class="cta-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
										<line x1="5" y1="12" x2="19" y2="12" />
										<polyline points="12 5 19 12 12 19" />
									</svg>
								</a>

								<a href="/demo" class="hero-btn-secondary">
									<span>Test Drive Artist Studio</span>
								</a>

								<a href="/i/neon-velvet-brooklyn-2026-10-12" class="hero-btn-tertiary">
									<span>Open Brooklyn Zine ↗</span>
								</a>
							</Cluster>

							<!-- Key Metrics / Proof Points Strip -->
							<Grid min="xs" gap="md" class="hero-metrics-strip">
								<div class="metric-item">
									<div class="metric-icon-wrap mint">⚡</div>
									<div class="metric-text-wrap">
										<span class="metric-value">60-Second Setup</span>
										<span class="metric-label">Clone per city before soundcheck</span>
									</div>
								</div>

								<div class="metric-item">
									<div class="metric-icon-wrap pink">💸</div>
									<div class="metric-text-wrap">
										<span class="metric-value">1-Tap Direct Tips</span>
										<span class="metric-label">Stripe Connect straight to bank</span>
									</div>
								</div>

								<div class="metric-item">
									<div class="metric-icon-wrap cyan">🎟️</div>
									<div class="metric-text-wrap">
										<span class="metric-value">Verified Stubs</span>
										<span class="metric-label">No GPS, stamped by physical QR</span>
									</div>
								</div>
							</Grid>
						</Stack>
					</div>

					<!-- Hero Right Column: Interactive Phone Simulator -->
					<div class="hero-preview-col" id="simulator">
						<Stack gap="sm" align="center">
							<div class="simulator-callout-header">
								<span class="preview-eyebrow">LIVE INTERACTIVE PROTOTYPE</span>
								<p class="preview-hint">Tap tabs, play audio, or simulate a tip:</p>
							</div>
							<ZineSimulator />
						</Stack>
					</div>
				</Split>
			</Container>
		</section>

		<!-- VALUE PROPOSITION / AUDIENCE SPLIT SECTION -->
		<section class="section-container" id="features">
			<Container width="main" padding="none">
				<Center max="md" centerText>
					<Stack gap="sm" align="center" class="section-header-centered">
						<span class="section-eyebrow">DESIGNED FOR GIGS</span>
						<h2 class="section-title">A Living Artifact For Every Show</h2>
						<p class="section-subtitle">
							Traditional link trees feel like corporate spreadsheets. Quire captures the raw,
							electric atmosphere of a live venue in an instant-loading web zine.
						</p>

						<!-- Audience Toggle -->
						<Cluster justify="center" gap="xs">
							<button
								type="button"
								class="toggle-choice-btn"
								class:active={activeAudienceTab === 'artists'}
								onclick={() => (activeAudienceTab = 'artists')}
							>
								🎸 For Touring Bands & Artists
							</button>
							<button
								type="button"
								class="toggle-choice-btn"
								class:active={activeAudienceTab === 'fans'}
								onclick={() => (activeAudienceTab = 'fans')}
							>
								🖤 For Fans & Music Lovers
							</button>
						</Cluster>
					</Stack>
				</Center>

				<!-- Dynamic Audience Feature Grid -->
				{#if activeAudienceTab === 'artists'}
					<Grid min="md" gap="lg">
						<Box variant="raised" padding="xl" radius="lg" class="feature-card">
							<div class="feature-card-glow cyan"></div>
							<div class="card-icon-box cyan">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
								</svg>
							</div>
							<Stack gap="xs">
								<h3 class="feature-card-title">1-Tap Direct Tipping</h3>
								<p class="feature-card-desc">
									Fans don't download an app or fill out sign-up forms in a loud room.
									They tap Apple Pay or card, and 100% of the funds route directly to your Stripe Connect account.
								</p>
							</Stack>
							<Cluster gap="xs" class="card-tag-row">
								<span class="card-feature-item">Apple Pay / Google Pay</span>
								<span class="card-feature-item">Instant Payouts</span>
							</Cluster>
						</Box>

						<Box variant="raised" padding="xl" radius="lg" class="feature-card">
							<div class="feature-card-glow pink"></div>
							<div class="card-icon-box pink">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
									<line x1="8" y1="12" x2="16" y2="12" />
									<line x1="12" y1="8" x2="12" y2="16" />
								</svg>
							</div>
							<Stack gap="xs">
								<h3 class="feature-card-title">60-Second City Cloning</h3>
								<p class="feature-card-desc">
									Design your master aesthetic once in the Bookbinder. When you roll into Philadelphia or Detroit,
									clone the issue, type tonight's setlist, and your city issue is live before soundcheck ends.
								</p>
							</Stack>
							<Cluster gap="xs" class="card-tag-row">
								<span class="card-feature-item">Bookbinder Engine</span>
								<span class="card-feature-item">Mobile Friendly</span>
							</Cluster>
						</Box>

						<Box variant="raised" padding="xl" radius="lg" class="feature-card">
							<div class="feature-card-glow mint"></div>
							<div class="card-icon-box mint">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
								</svg>
							</div>
							<Stack gap="xs">
								<h3 class="feature-card-title">The Physical QR Geofence</h3>
								<p class="feature-card-desc">
									Zero invasive GPS tracking. Your physical sticker on the amp or merch table is the geofence.
									Fans who scan during the gig's 48-hour Stamp Window earn authentic attendance proof.
								</p>
							</Stack>
							<Cluster gap="xs" class="card-tag-row">
								<span class="card-feature-item">Cryptographic HMAC</span>
								<span class="card-feature-item">No Location Prompts</span>
							</Cluster>
						</Box>

						<Box variant="raised" padding="xl" radius="lg" class="feature-card">
							<div class="feature-card-glow purple"></div>
							<div class="card-icon-box purple">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
								</svg>
							</div>
							<Stack gap="xs">
								<h3 class="feature-card-title">An Algorithmic-Free Wall</h3>
								<p class="feature-card-desc">
									Stop begging fans to comment on social algorithms that hide your posts. Your Quire wall is a permanent,
									moderation-controlled guestbook where you can reply directly with your verified band badge.
								</p>
							</Stack>
							<Cluster gap="xs" class="card-tag-row">
								<span class="card-feature-item">Verified Artist Badge</span>
								<span class="card-feature-item">Built-in Moderation</span>
							</Cluster>
						</Box>
					</Grid>
				{:else}
					<Grid min="md" gap="lg">
						<Box variant="raised" padding="xl" radius="lg" class="feature-card">
							<div class="feature-card-glow cyan"></div>
							<div class="card-icon-box cyan">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="2" y="4" width="20" height="16" rx="2" />
									<line x1="2" y1="10" x2="22" y2="10" />
								</svg>
							</div>
							<Stack gap="xs">
								<h3 class="feature-card-title">Digital Ticket Stubs</h3>
								<p class="feature-card-desc">
									Remember when paper ticket stubs filled shoeboxes in your bedroom? Quire returns that magic.
									Every concert you physically attend generates a permanent, date-stamped collectible in your wallet.
								</p>
							</Stack>
							<Cluster gap="xs" class="card-tag-row">
								<span class="card-feature-item">Permanent Wallet</span>
								<span class="card-feature-item">Concert Lore</span>
							</Cluster>
						</Box>

						<Box variant="raised" padding="xl" radius="lg" class="feature-card">
							<div class="feature-card-glow mint"></div>
							<div class="card-icon-box mint">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
									<path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
								</svg>
							</div>
							<Stack gap="xs">
								<h3 class="feature-card-title">Unreleased Vault Drops</h3>
								<p class="feature-card-desc">
									Bands share rough mix tapes, backstage acoustic demos, and unreleased stems exclusively
									inside the city zine. Hear music before it ever reaches major streaming services.
								</p>
							</Stack>
							<Cluster gap="xs" class="card-tag-row">
								<span class="card-feature-item">Exclusive Audio</span>
								<span class="card-feature-item">Behind-The-Scenes</span>
							</Cluster>
						</Box>

						<Box variant="raised" padding="xl" radius="lg" class="feature-card">
							<div class="feature-card-glow pink"></div>
							<div class="card-icon-box pink">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
								</svg>
							</div>
							<Stack gap="xs">
								<h3 class="feature-card-title">Real Fan Support</h3>
								<p class="feature-card-desc">
									Skip corporate merchandise markups. Send $3, $5, or $20 directly to the band members
									while standing in front of the stage. Your name lights up on the show wall.
								</p>
							</Stack>
							<Cluster gap="xs" class="card-tag-row">
								<span class="card-feature-item">Direct Love</span>
								<span class="card-feature-item">Zero App Friction</span>
							</Cluster>
						</Box>

						<Box variant="raised" padding="xl" radius="lg" class="feature-card">
							<div class="feature-card-glow purple"></div>
							<div class="card-icon-box purple">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M12 20h9" />
									<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
								</svg>
							</div>
							<Stack gap="xs">
								<h3 class="feature-card-title">Two-Way Artist Replies</h3>
								<p class="feature-card-desc">
									Leave a note about your favorite track or the venue energy. The band can reply directly
									from their artist dashboard, creating genuine connections that outlive the encore.
								</p>
							</Stack>
							<Cluster gap="xs" class="card-tag-row">
								<span class="card-feature-item">Direct Conversation</span>
								<span class="card-feature-item">Community History</span>
							</Cluster>
						</Box>
					</Grid>
				{/if}
			</Container>
		</section>

		<!-- LIVE TOUR SHOWCASE -->
		<section class="section-container" id="tour-showcase">
			<Container width="main" padding="none">
				<Center max="md" centerText>
					<Stack gap="sm" align="center" class="section-header-centered">
						<span class="section-eyebrow mint">CURRENT RUNNING TOUR</span>
						<h2 class="section-title">The Neon Velvet — East Coast Fall Run</h2>
						<p class="section-subtitle">
							Explore real live issues currently published on the platform.
							Each stop features custom setlists, photo stubs, and city notes.
						</p>
					</Stack>
				</Center>

				<Grid min="md" gap="lg">
					<!-- Gig 1: Brooklyn -->
					<Box variant="raised" padding="xl" radius="lg" class="gig-card highlight-border">
						<Stack gap="md">
							<Cluster justify="between" align="center" class="gig-status-strip">
								<span class="live-status-tag">
									<span class="live-pulse"></span> GIG 01 · ACTIVE
								</span>
								<span class="gig-date">OCT 12, 2026</span>
							</Cluster>

							<Stack gap="3xs">
								<h3 class="gig-city-name">Brooklyn, NY</h3>
								<div class="gig-venue-name">Baby's All Right</div>
							</Stack>

							<p class="gig-note">
								"Tour kickoff show! Playing the entire new record with extended fuzz jams and analog delays."
							</p>

							<Cluster gap="xs" class="gig-features-list">
								<span>🎵 Demo: Studio Session 04</span>
								<span>🎟️ Verified Attendance Open</span>
								<span>💬 24 Guestbook Notes</span>
							</Cluster>

							<Cluster gap="sm" class="gig-card-actions">
								<a href="/i/neon-velvet-brooklyn-2026-10-12" class="btn-gig-primary">
									View Brooklyn Zine →
								</a>
								<a href="/scan/neon-velvet-brooklyn-2026-10-12?k=kickoff_babys_secret_2026" class="btn-gig-secondary">
									Simulate QR Scan 📱
								</a>
							</Cluster>
						</Stack>
					</Box>

					<!-- Gig 2: Philadelphia -->
					<Box variant="raised" padding="xl" radius="lg" class="gig-card">
						<Stack gap="md">
							<Cluster justify="between" align="center" class="gig-status-strip">
								<span class="upcoming-status-tag">GIG 02 · READY</span>
								<span class="gig-date">OCT 15, 2026</span>
							</Cluster>

							<Stack gap="3xs">
								<h3 class="gig-city-name">Philadelphia, PA</h3>
								<div class="gig-venue-name">Johnny Brenda's</div>
							</Stack>

							<p class="gig-note">
								"Balcony was shaking during the chorus. Fish & chips downstairs after the midnight set."
							</p>

							<Cluster gap="xs" class="gig-features-list">
								<span>🎵 Soundboard Rehearsal</span>
								<span>📸 35mm Tour Photo Stubs</span>
								<span>💬 Backstage Wall Ready</span>
							</Cluster>

							<div class="gig-card-actions">
								<a href="/i/neon-velvet-philly-2026-10-15" class="btn-gig-primary">
									View Philly Zine →
								</a>
							</div>
						</Stack>
					</Box>

					<!-- Gig 3: Washington DC -->
					<Box variant="raised" padding="xl" radius="lg" class="gig-card">
						<Stack gap="md">
							<Cluster justify="between" align="center" class="gig-status-strip">
								<span class="upcoming-status-tag">GIG 03 · READY</span>
								<span class="gig-date">OCT 18, 2026</span>
							</Cluster>

							<Stack gap="3xs">
								<h3 class="gig-city-name">Washington, DC</h3>
								<div class="gig-venue-name">Black Cat</div>
							</Stack>

							<p class="gig-note">
								"Main stage tonight. Soundcheck sounded massive. Catch us at the merch booth."
							</p>

							<Cluster gap="xs" class="gig-features-list">
								<span>🎵 Acoustic Opening Take</span>
								<span>🎟️ Verified Attendance</span>
								<span>💬 Guestbook Live</span>
							</Cluster>

							<div class="gig-card-actions">
								<a href="/i/neon-velvet-dc-2026-10-18" class="btn-gig-primary">
									View DC Zine →
								</a>
							</div>
						</Stack>
					</Box>
				</Grid>

				<!-- Tour Hub Navigation Banner -->
				<Box variant="raised" padding="lg" radius="lg" class="tour-links-banner">
					<Switcher collapse="md" gap="md" align="center">
						<div class="banner-text">
							<h4>Looking for band discography or your personal wallet?</h4>
							<p>Explore the full artist hub or inspect your collected digital ticket stubs.</p>
						</div>
						<Cluster justify="end" gap="sm">
							<a href="/a/the-neon-velvet" class="banner-btn secondary">
								View Artist Profile (/a/the-neon-velvet)
							</a>
							<a href="/me/stubs" class="banner-btn primary">
								My Fan Stubs (/me/stubs)
							</a>
						</Cluster>
					</Switcher>
				</Box>
			</Container>
		</section>

		<!-- HOW IT WORKS IN 3 STEPS -->
		<section class="section-container" id="how-it-works">
			<Container width="main" padding="none">
				<Center max="md" centerText>
					<Stack gap="sm" align="center" class="section-header-centered">
						<span class="section-eyebrow cyan">THE 3-STEP PIPELINE</span>
						<h2 class="section-title">Zero Friction From Stage to Pocket</h2>
						<p class="section-subtitle">
							Built for artists who want to spend their time making noise, not managing social media platforms.
						</p>
					</Stack>
				</Center>

				<Switcher collapse="md" gap="lg" limit={3}>
					<!-- Step 1 -->
					<Box variant="raised" padding="xl" radius="lg" class="step-card">
						<Stack gap="sm">
							<div class="step-number">01</div>
							<h3 class="step-heading">Create Master Template</h3>
							<p class="step-body">
								Build your recurring tour pages once in the Bookbinder: band bio, merch links,
								and signature accent color.
							</p>
							<div class="step-meta">Setup time: ~3 minutes</div>
						</Stack>
					</Box>

					<!-- Step 2 -->
					<Box variant="raised" padding="xl" radius="lg" class="step-card">
						<Stack gap="sm">
							<div class="step-number">02</div>
							<h3 class="step-heading">Clone Before Soundcheck</h3>
							<p class="step-body">
								Before hitting the stage, enter tonight's city and venue. Attach today's demo or setlist.
								Print or display the auto-generated QR.
							</p>
							<div class="step-meta">Publish time: &lt;60 seconds</div>
						</Stack>
					</Box>

					<!-- Step 3 -->
					<Box variant="raised" padding="xl" radius="lg" class="step-card">
						<Stack gap="sm">
							<div class="step-number">03</div>
							<h3 class="step-heading">Fans Scan & Connect</h3>
							<p class="step-body">
								Fans scan with their native phone camera. No app download. They tip via Apple Pay,
								stamp their ticket stub, and sign your wall.
							</p>
							<div class="step-meta">Fan engagement: 0.8s load</div>
						</Stack>
					</Box>
				</Switcher>
			</Container>
		</section>

		<!-- COMPARISON TABLE: THE OLD WAY VS QUIRE -->
		<section class="section-container comparison-section">
			<Container width="main" padding="none">
				<Center max="md" centerText>
					<Stack gap="sm" align="center" class="section-header-centered">
						<span class="section-eyebrow pink">WHY IT MATTERS</span>
						<h2 class="section-title">Why Bands Dumped Venmo Signs & Link Trees</h2>
						<p class="section-subtitle">
							Compare how traditional gig tactics stack up against a purpose-built digital zine.
						</p>
					</Stack>
				</Center>

				<Box variant="raised" padding="none" radius="lg" class="comparison-table-wrap">
					<table class="comparison-table">
						<thead>
							<tr>
								<th class="col-feature">Experience</th>
								<th class="col-traditional">Venmo QR / Link in Bio</th>
								<th class="col-quire">Quire Digital Zine</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td class="col-feature">Atmosphere & Aesthetic</td>
								<td class="col-traditional">Clinical bank app or corporate link buttons</td>
								<td class="col-quire highlight-td">Dark, neon glass, concert visual zine</td>
							</tr>
							<tr>
								<td class="col-feature">Audience Retention</td>
								<td class="col-traditional">Zero retention. Money leaves, fan vanishes</td>
								<td class="col-quire highlight-td">Attendance stubs & permanent guestbook ties</td>
							</tr>
							<tr>
								<td class="col-feature">Tip Friction</td>
								<td class="col-traditional">Requires specific app, searching handle, manually entering $</td>
								<td class="col-quire highlight-td">1-tap Apple Pay/Google Pay in web browser</td>
							</tr>
							<tr>
								<td class="col-feature">Concert Collectibles</td>
								<td class="col-traditional">None. Paper stubs are lost forever</td>
								<td class="col-quire highlight-td">Cryptographic ticket stub with venue & date</td>
							</tr>
							<tr>
								<td class="col-feature">Music & Unreleased Audio</td>
								<td class="col-traditional">External redirect to Spotify where royalties pay $0.003</td>
								<td class="col-quire highlight-td">Embedded backstage audio stream & stems</td>
							</tr>
							<tr>
								<td class="col-feature">App Store Barrier</td>
								<td class="col-traditional">60MB app downloads fail on venue cellular data</td>
								<td class="col-quire highlight-td">Instant web standard, 0.8s time-to-interactive</td>
							</tr>
						</tbody>
					</table>
				</Box>
			</Container>
		</section>

		<!-- FINAL CALL TO ACTION BANNER -->
		<section class="section-container cta-section">
			<Container width="main" padding="none">
				<Box variant="raised" padding="xl" radius="lg" class="final-cta-card">
					<Center max="md" centerText>
						<Stack gap="md" align="center" class="cta-inner">
							<span class="cta-eyebrow">TOUR READY IN 60 SECONDS</span>
							<h2 class="cta-headline">Turn Tonight's Crowd Into A Lifelong Community.</h2>
							<p class="cta-description">
								No platform gatekeepers. No social media algorithms hiding your art.
								Give your next live show the zine it deserves.
							</p>

							<Cluster justify="center" gap="sm">
								<a href="/login" class="hero-btn-primary">
									<span>Create Your Free Zine</span>
									<svg class="cta-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
										<line x1="5" y1="12" x2="19" y2="12" />
										<polyline points="12 5 19 12 12 19" />
									</svg>
								</a>

								<a href="/demo" class="hero-btn-secondary">
									<span>Launch Demo Artist Tour</span>
								</a>

								<a href="/case-study" class="hero-btn-tertiary">
									<span>Read Engineering ADRs</span>
								</a>
							</Cluster>
						</Stack>
					</Center>
				</Box>
			</Container>
		</section>
	</main>

	<!-- FOOTER -->
	<footer class="site-footer">
		<Container width="main" padding="none">
			<Grid min="sm" gap="xl" class="footer-grid">
				<Stack gap="sm" class="footer-col-brand">
					<Cluster align="center" gap="xs">
						<span class="brand-text-footer">QUIRE.</span>
						<span class="footer-version-tag">STG-2026</span>
					</Cluster>
					<p class="footer-bio">
						Digital zines for touring artists and buskers. Preserving the physical intimacy of live music in the web era.
					</p>
					<div class="footer-sub-note">
						Built with SvelteKit 5, Drizzle ORM, Better Auth & Stripe Connect.
					</div>
				</Stack>

				<div class="footer-nav-col">
					<Stack gap="xs">
						<span class="footer-nav-title">Platform</span>
						<a href="/demo">Demo Artist Studio</a>
						<a href="/login">Artist Login</a>
						<a href="/me/stubs">Fan Stubs Wallet</a>
						<a href="/case-study">Case Study & ADRs</a>
					</Stack>
				</div>

				<div class="footer-nav-col">
					<Stack gap="xs">
						<span class="footer-nav-title">Featured Tour</span>
						<a href="/a/the-neon-velvet">The Neon Velvet Hub</a>
						<a href="/i/neon-velvet-brooklyn-2026-10-12">Brooklyn Kickoff Zine</a>
						<a href="/i/neon-velvet-philly-2026-10-15">Philadelphia Gig Zine</a>
						<a href="/i/neon-velvet-dc-2026-10-18">DC Main Stage Zine</a>
					</Stack>
				</div>

				<div class="footer-nav-col">
					<Stack gap="xs">
						<span class="footer-nav-title">Music First</span>
						<span class="footer-highlight-text">Zero Ad Trackers</span>
						<span class="footer-highlight-text">Direct Artist Payouts</span>
						<span class="footer-highlight-text">Web Standards Only</span>
					</Stack>
				</div>
			</Grid>

			<Cluster justify="between" align="center" class="footer-bottom-bar">
				<span>© 2026 Quire Platform. Music & People.</span>
				<span>Portfolio Edition · All Gigs Real-Time Ready</span>
			</Cluster>
		</Container>
	</footer>
</div>

<style>
	/* ROOT CONTAINER */
	.landing-page-root {
		position: relative;
		min-height: 100vh;
		background-color: var(--ink, #090710);
		color: var(--paper, #f4f4f0);
		font-family: var(--font-sans);
		overflow-x: hidden;
		overflow-y: auto;
	}

	/* AMBIENT BACKGROUND GLOWS */
	.ambient-glow {
		position: absolute;
		border-radius: 50%;
		filter: blur(120px);
		opacity: 0.18;
		pointer-events: none;
		z-index: 0;
	}

	.cyan-glow {
		top: -100px;
		left: 20%;
		width: 550px;
		height: 550px;
		background: #05d9e8;
	}

	.pink-glow {
		top: 600px;
		right: 5%;
		width: 600px;
		height: 600px;
		background: #ff2a6d;
		opacity: 0.14;
	}

	.mint-glow {
		top: 1500px;
		left: 10%;
		width: 500px;
		height: 500px;
		background: #01ffc3;
		opacity: 0.12;
	}

	/* TOP NAVIGATION */
	.top-nav {
		position: sticky;
		top: 0;
		z-index: 100;
		background: rgba(9, 7, 16, 0.85);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.nav-container {
		max-width: 1240px;
		margin: 0 auto;
		padding: 14px 24px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.brand-link {
		display: flex;
		align-items: center;
		gap: 8px;
		text-decoration: none;
	}

	.brand-logo {
		font-size: 1.25rem;
		font-weight: 900;
		letter-spacing: -0.03em;
		color: #ffffff;
	}

	.brand-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #05d9e8;
		box-shadow: 0 0 10px #05d9e8;
	}

	.brand-tagline {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: #01ffc3;
	}

	.nav-menu {
		display: none;
		align-items: center;
		gap: 24px;
	}

	@media (min-width: 860px) {
		.nav-menu {
			display: flex;
		}
	}

	.nav-item {
		font-size: 0.86rem;
		font-weight: 500;
		color: #a1a1aa;
		text-decoration: none;
		transition: color 0.2s;
	}

	.nav-item:hover {
		color: #ffffff;
	}

	.nav-btn-secondary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		color: #e4e4e7;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.14);
		padding: 7px 14px;
		border-radius: 9999px;
		text-decoration: none;
		transition: all 0.2s;
	}

	.nav-btn-secondary:hover {
		background: rgba(255, 255, 255, 0.14);
		color: #ffffff;
	}

	.btn-dot {
		color: #01ffc3;
		font-size: 0.65rem;
	}

	.nav-btn-primary {
		display: inline-flex;
		align-items: center;
		font-size: 0.82rem;
		font-weight: 700;
		color: #090710;
		background: #01ffc3;
		padding: 7px 16px;
		border-radius: 9999px;
		text-decoration: none;
		box-shadow: 0 0 16px rgba(1, 255, 195, 0.35);
		transition: all 0.2s;
	}

	.nav-btn-primary:hover {
		background: #25ffd0;
		box-shadow: 0 0 22px rgba(1, 255, 195, 0.55);
		transform: translateY(-1px);
	}

	/* HERO SECTION */
	.hero-section {
		position: relative;
		z-index: 10;
		padding: 50px 24px 80px;
		max-width: 1240px;
		margin: 0 auto;
	}

	.hero-content {
		display: flex;
		flex-direction: column;
	}

	.hero-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: #01ffc3;
		text-transform: uppercase;
	}

	.live-ping {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #01ffc3;
		box-shadow: 0 0 8px #01ffc3;
		animation: pulse 1.8s infinite;
	}

	.hero-headline {
		font-size: clamp(2.4rem, 6vw, 4.2rem);
		line-height: 1.05;
		font-weight: 900;
		letter-spacing: -0.035em;
		color: #ffffff;
		margin: 0;
	}

	.neon-highlight-text {
		display: block;
		color: #05d9e8;
		text-shadow: 0 0 35px rgba(5, 217, 232, 0.45);
	}

	.hero-subtext {
		font-size: 1.12rem;
		line-height: 1.65;
		color: #a1a1aa;
		max-width: 58ch;
		margin: 0;
	}

	.hero-btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #ff2a6d;
		color: #ffffff;
		font-weight: 700;
		font-size: 0.95rem;
		padding: 12px 24px;
		border-radius: 9999px;
		text-decoration: none;
		box-shadow: 0 4px 24px rgba(255, 42, 109, 0.45);
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.hero-btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 30px rgba(255, 42, 109, 0.65);
	}

	.cta-arrow-icon {
		width: 18px;
		height: 18px;
		transition: transform 0.2s;
	}

	.hero-btn-primary:hover .cta-arrow-icon {
		transform: translateX(3px);
	}

	.hero-btn-secondary {
		display: inline-flex;
		align-items: center;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.16);
		color: #ffffff;
		font-weight: 600;
		font-size: 0.95rem;
		padding: 12px 22px;
		border-radius: 9999px;
		text-decoration: none;
		backdrop-filter: blur(12px);
		transition: all 0.2s;
	}

	.hero-btn-secondary:hover {
		background: rgba(255, 255, 255, 0.16);
		border-color: rgba(255, 255, 255, 0.3);
		transform: translateY(-1px);
	}

	.hero-btn-tertiary {
		display: inline-flex;
		align-items: center;
		color: #05d9e8;
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
		padding: 10px 14px;
		transition: opacity 0.2s;
	}

	.hero-btn-tertiary:hover {
		opacity: 0.8;
	}


	.metric-item {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.metric-icon-wrap {
		width: 38px;
		height: 38px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.15rem;
		flex-shrink: 0;
	}

	.metric-icon-wrap.mint {
		background: rgba(1, 255, 195, 0.12);
		border: 1px solid rgba(1, 255, 195, 0.25);
	}

	.metric-icon-wrap.pink {
		background: rgba(255, 42, 109, 0.12);
		border: 1px solid rgba(255, 42, 109, 0.25);
	}

	.metric-icon-wrap.cyan {
		background: rgba(5, 217, 232, 0.12);
		border: 1px solid rgba(5, 217, 232, 0.25);
	}

	.metric-text-wrap {
		display: flex;
		flex-direction: column;
	}

	.metric-value {
		font-size: 0.88rem;
		font-weight: 700;
		color: #ffffff;
	}

	.metric-label {
		font-size: 0.74rem;
		color: #a1a1aa;
	}

	/* Simulator Column */
	.hero-preview-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
	}

	.simulator-callout-header {
		text-align: center;
		margin-bottom: 16px;
	}

	.preview-eyebrow {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #05d9e8;
		text-transform: uppercase;
	}

	.preview-hint {
		font-size: 0.76rem;
		color: #71717a;
		margin: 6px 0 0;
	}

	/* GENERAL SECTION STYLING */
	.section-container {
		position: relative;
		z-index: 10;
		max-width: 1240px;
		margin: 0 auto;
		padding: 80px 24px;
	}


	.section-eyebrow {
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		color: #05d9e8;
		text-transform: uppercase;
	}

	.section-eyebrow.mint {
		color: #01ffc3;
	}

	.section-eyebrow.cyan {
		color: #05d9e8;
	}

	.section-eyebrow.pink {
		color: #ff2a6d;
	}

	.section-title {
		font-size: clamp(2rem, 4.5vw, 3rem);
		line-height: 1.1;
		font-weight: 800;
		letter-spacing: -0.03em;
		color: #ffffff;
		margin: 0;
	}

	.section-subtitle {
		font-size: 1.05rem;
		line-height: 1.6;
		color: #a1a1aa;
		margin: 0;
	}


	.toggle-choice-btn {
		background: transparent;
		border: none;
		color: #a1a1aa;
		font-size: 0.85rem;
		font-weight: 700;
		padding: 8px 18px;
		border-radius: 9999px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.toggle-choice-btn.active {
		background: #ffffff;
		color: #090710;
		box-shadow: 0 4px 16px rgba(255, 255, 255, 0.2);
	}

	:global(.feature-card) {
		position: relative;
		overflow: hidden;
		transition: transform 0.2s, border-color 0.2s;
	}

	:global(.feature-card:hover) {
		transform: translateY(-3px);
		border-color: rgba(255, 255, 255, 0.25);
	}

	.feature-card-glow {
		position: absolute;
		top: -40px;
		right: -40px;
		width: 120px;
		height: 120px;
		border-radius: 50%;
		filter: blur(40px);
		opacity: 0.2;
		pointer-events: none;
	}

	.feature-card-glow.cyan { background: #05d9e8; }
	.feature-card-glow.pink { background: #ff2a6d; }
	.feature-card-glow.mint { background: #01ffc3; }
	.feature-card-glow.purple { background: #9d4edd; }

	.card-icon-box {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 4px;
	}

	.card-icon-box svg {
		width: 22px;
		height: 22px;
	}

	.card-icon-box.cyan {
		background: rgba(5, 217, 232, 0.12);
		border: 1px solid rgba(5, 217, 232, 0.3);
		color: #05d9e8;
	}

	.card-icon-box.pink {
		background: rgba(255, 42, 109, 0.12);
		border: 1px solid rgba(255, 42, 109, 0.3);
		color: #ff2a6d;
	}

	.card-icon-box.mint {
		background: rgba(1, 255, 195, 0.12);
		border: 1px solid rgba(1, 255, 195, 0.3);
		color: #01ffc3;
	}

	.card-icon-box.purple {
		background: rgba(157, 78, 221, 0.15);
		border: 1px solid rgba(157, 78, 221, 0.35);
		color: #c77dff;
	}

	.feature-card-title {
		font-size: 1.25rem;
		font-weight: 800;
		color: #ffffff;
		margin: 0;
	}

	.feature-card-desc {
		font-size: 0.9rem;
		line-height: 1.6;
		color: #a1a1aa;
		margin: 0;
	}

	.card-feature-item {
		font-size: 0.76rem;
		font-weight: 600;
		color: #a1a1aa;
	}

	.card-feature-item::before {
		content: '·';
		margin-right: 6px;
		color: #05d9e8;
	}

	/* TOUR SHOWCASE SECTION */
	:global(.gig-card) {
		display: flex;
		flex-direction: column;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	:global(.gig-card.highlight-border) {
		border-color: rgba(1, 255, 195, 0.4);
		box-shadow: 0 0 30px rgba(1, 255, 195, 0.12);
	}

	:global(.gig-card:hover) {
		transform: translateY(-3px);
	}

	.live-status-tag {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		color: #01ffc3;
	}

	.live-pulse {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #01ffc3;
		animation: pulse 1.6s infinite;
	}

	.upcoming-status-tag {
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: #71717a;
	}

	.gig-date {
		font-size: 0.74rem;
		font-weight: 600;
		color: #71717a;
	}

	.gig-city-name {
		font-size: 1.6rem;
		font-weight: 900;
		color: #ffffff;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.gig-venue-name {
		font-size: 0.88rem;
		font-weight: 600;
		color: #05d9e8;
		margin-top: -6px;
	}

	.gig-note {
		font-size: 0.86rem;
		line-height: 1.5;
		color: #d4d4d8;
		font-style: italic;
		background: rgba(255, 255, 255, 0.03);
		border-left: 2px solid rgba(255, 255, 255, 0.2);
		padding: 8px 12px;
		border-radius: 0 8px 8px 0;
		margin: 4px 0;
	}


	.gig-card-actions {
		margin-top: auto;
		padding-top: 14px;
	}

	.btn-gig-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: #01ffc3;
		color: #090710;
		font-size: 0.84rem;
		font-weight: 700;
		padding: 10px;
		border-radius: 10px;
		text-decoration: none;
		transition: all 0.2s;
	}

	.btn-gig-primary:hover {
		background: #25ffd0;
		box-shadow: 0 0 16px rgba(1, 255, 195, 0.4);
	}

	.btn-gig-secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.14);
		color: #e4e4e7;
		font-size: 0.8rem;
		font-weight: 600;
		padding: 8px;
		border-radius: 10px;
		text-decoration: none;
		transition: all 0.2s;
	}

	.btn-gig-secondary:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	/* Tour Links Banner */
	:global(.tour-links-banner) {
		background: rgba(21, 17, 36, 0.8);
	}

	.banner-text h4 {
		font-size: 1.05rem;
		font-weight: 800;
		color: #ffffff;
		margin: 0 0 4px;
	}

	.banner-text p {
		font-size: 0.86rem;
		color: #a1a1aa;
		margin: 0;
	}

	.banner-btn {
		font-size: 0.82rem;
		font-weight: 700;
		padding: 8px 16px;
		border-radius: 9999px;
		text-decoration: none;
		transition: all 0.2s;
	}

	.banner-btn.primary {
		background: #05d9e8;
		color: #090710;
	}

	.banner-btn.primary:hover {
		box-shadow: 0 0 16px rgba(5, 217, 232, 0.4);
	}

	.banner-btn.secondary {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #ffffff;
	}

	.banner-btn.secondary:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	/* HOW IT WORKS PIPELINE */
	:global(.step-card) {
		flex: 1;
	}

	.step-number {
		font-size: 1.8rem;
		font-weight: 900;
		color: #01ffc3;
		text-shadow: 0 0 20px rgba(1, 255, 195, 0.4);
	}

	.step-heading {
		font-size: 1.25rem;
		font-weight: 800;
		color: #ffffff;
		margin: 0;
	}

	.step-body {
		font-size: 0.88rem;
		line-height: 1.6;
		color: #a1a1aa;
		margin: 0;
	}

	.step-meta {
		font-size: 0.74rem;
		font-weight: 600;
		color: #05d9e8;
		margin-top: auto;
		padding-top: 10px;
	}

	/* COMPARISON TABLE */
	:global(.comparison-table-wrap) {
		overflow-x: auto;
		border-radius: 20px;
		background: rgba(21, 17, 36, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.comparison-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
		font-size: 0.88rem;
	}

	.comparison-table th {
		padding: 18px 24px;
		font-weight: 800;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.col-feature {
		width: 32%;
		color: #ffffff;
	}

	.col-traditional {
		width: 34%;
		color: #a1a1aa;
	}

	.col-quire {
		width: 34%;
		color: #01ffc3;
		background: rgba(1, 255, 195, 0.05);
	}

	.comparison-table td {
		padding: 16px 24px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		color: #d4d4d8;
		line-height: 1.5;
	}

	.highlight-td {
		background: rgba(1, 255, 195, 0.04);
		font-weight: 600;
		color: #ffffff;
	}

	/* FINAL CTA BANNER */
	.cta-section {
		padding-bottom: 100px;
	}

	.cta-eyebrow {
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		color: #ff2a6d;
		text-transform: uppercase;
	}

	.cta-headline {
		font-size: clamp(2rem, 4vw, 3rem);
		font-weight: 900;
		letter-spacing: -0.03em;
		color: #ffffff;
		margin: 0;
	}

	.cta-description {
		font-size: 1.05rem;
		line-height: 1.6;
		color: #a1a1aa;
		margin: 0;
	}

	/* SITE FOOTER */
	.site-footer {
		background: #06040c;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding: 60px 24px 30px;
	}

	.brand-text-footer {
		font-size: 1.3rem;
		font-weight: 900;
		color: #ffffff;
	}

	.footer-version-tag {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: #05d9e8;
	}

	.footer-bio {
		font-size: 0.86rem;
		line-height: 1.6;
		color: #a1a1aa;
		max-width: 38ch;
		margin: 0;
	}

	.footer-sub-note {
		font-size: 0.74rem;
		color: #71717a;
	}

	.footer-nav-col {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.footer-nav-title {
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		color: #ffffff;
		text-transform: uppercase;
		margin-bottom: 4px;
	}

	.footer-nav-col a {
		font-size: 0.82rem;
		color: #a1a1aa;
		text-decoration: none;
		transition: color 0.2s;
	}

	.footer-nav-col a:hover {
		color: #05d9e8;
	}

	.footer-highlight-text {
		font-size: 0.8rem;
		color: #01ffc3;
	}

</style>
