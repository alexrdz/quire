<script lang="ts">
	import { Center, Box, Stack, Cluster } from '$lib/components/layout';
</script>

<svelte:head>
	<title>Architectural Case Study — Quire</title>
</svelte:head>

<div class="case-study-root">
	<Center max="md" padding="md" class="case-study-canvas">
		<Stack gap="xl">
			<header class="cover-header">
				<a href="/" class="glass-pill text-highlight link-clean">← Quire Home</a>
				<span class="glass-pill">Engineering Case Study</span>
			</header>

			<Stack gap="xs">
				<span class="tag-highlight glass-pill tag-inline">Architectural Deep Dive</span>
				<h1 class="case-study-title">
					How Quire Was Built
				</h1>
				<p class="text-muted case-study-intro">
					Replacing fragmented link trees and Venmo signs with an all-in-one music zine and attendance hub. Below are the 5 non-obvious engineering decisions that shaped the system.
				</p>
			</Stack>

			<!-- Section 1 -->
			<Box variant="raised" padding="xl" radius="lg" as="section">
				<Stack gap="md">
					<Cluster justify="between" align="center">
						<span class="glass-pill tag-highlight">Decision 01</span>
						<span class="text-muted adr-label">ADR 0001</span>
					</Cluster>
					<h2 class="decision-heading">
						1. The Sticker is the Geofence (No GPS)
					</h2>
					<p class="decision-text">
						Proving attendance at music venues traditionally involves battery-draining GPS location prompts that fail in basement venues or trigger user privacy concerns. Instead, Quire treats the physical QR sticker as the geofence.
					</p>
					<p class="text-muted decision-detail">
						The physical sticker embeds a dedicated route <code class="highlight-code">/scan/[slug]?k=[secret]</code>. Visiting this endpoint during the venue's 48-hour local Stamp Window issues an HMAC SHA-256 attendance token. Direct web links to <code class="highlight-code">/i/[slug]</code> allow reading and tipping from anywhere in the world, but only physical QR scans confer authenticated digital ticket stubs.
					</p>
				</Stack>
			</Box>

			<!-- Section 2 -->
			<Box variant="raised" padding="xl" radius="lg" as="section">
				<Stack gap="md">
					<Cluster justify="between" align="center">
						<span class="glass-pill tag-support">Decision 02</span>
						<span class="text-muted adr-label">ADR 0003</span>
					</Cluster>
					<h2 class="decision-heading">
						2. Tipping: 1-Tap, Anonymous, Never Retried Later
					</h2>
					<p class="decision-text">
						Tipping takes one tap with Apple Pay or Google Pay via Stripe Connect Express. Tipping is completely anonymous (no account required).
					</p>
					<p class="text-muted decision-detail">
						Crucially, Decision 18 mandates that tips are charged only when the fan actively taps. If cell signal drops at a crowded festival, the checkout flow resets immediately with an honest message. We never queue transactions in the background or attempt surprise delayed charges, preserving trust. In development or review mode, an offline payment simulator records real financial data to the database without requiring live Stripe keys.
					</p>
				</Stack>
			</Box>

			<!-- Section 3 -->
			<Box variant="raised" padding="xl" radius="lg" as="section">
				<Stack gap="md">
					<Cluster justify="between" align="center">
						<span class="glass-pill tag-accent">Decision 03</span>
						<span class="text-muted adr-label">SPEC §5</span>
					</Cluster>
					<h2 class="decision-heading">
						3. The Wall: Open Guestbook & Pending Action Preservation
					</h2>
					<p class="decision-text">
						To capture in-the-moment live concert excitement, anonymous fans can type their note directly without signing in upfront.
					</p>
					<p class="text-muted decision-detail">
						Tapping "Post note" saves the typed text in <code class="highlight-code">sessionStorage</code>, initiates Google OAuth, and automatically submits the note upon return. Community integrity is guarded by automated screening (regex blocking URLs, phone numbers, and email addresses) and a 3-flag auto-hide threshold. When an artist restores a flagged note, it becomes permanently <code class="highlight-code">flagImmune</code> to neutralize bad-faith brigading.
					</p>
				</Stack>
			</Box>

			<!-- Section 4 -->
			<Box variant="raised" padding="xl" radius="lg" as="section">
				<Stack gap="md">
					<Cluster justify="between" align="center">
						<span class="glass-pill">Decision 04</span>
						<span class="text-muted adr-label">ADR 0002</span>
					</Cluster>
					<h2 class="decision-heading">
						4. Constrained Theming: CUBE CSS & Native @layer (No Tailwind)
					</h2>
					<p class="decision-text">
						Quire strictly enforces a single dark-glass house aesthetic inspired by vintage print zines and modern OLED screens.
					</p>
					<p class="text-muted decision-detail">
						Rather than bloated utility class libraries, styling is written in pure vanilla CUBE CSS using native cascading layers:
						<code class="highlight-code">@layer base, layouts, components, sticker, bookbinder, utilities</code>.
						Platform tokens (<code class="highlight-code">--highlight</code> mint and <code class="support-code">--support</code> pink) remain fixed across the entire network, while artists customize only their cover art, typography pairing, and dynamic <code class="accent-code">--accent</code> token.
					</p>
				</Stack>
			</Box>

			<!-- Section 5 -->
			<Box variant="raised" padding="xl" radius="lg" as="section">
				<Stack gap="md">
					<Cluster justify="between" align="center">
						<span class="glass-pill tag-highlight">Decision 05</span>
						<span class="text-muted adr-label">ADR 0004</span>
					</Cluster>
					<h2 class="decision-heading">
						5. Media Storage: Cloudflare R2 ($0 Egress Bandwidth)
					</h2>
					<p class="decision-text">
						When 5,000 festival attendees scan an Issue QR simultaneously, image downloads would rapidly trigger punitive bandwidth egress charges on standard cloud storage or Netlify Blobs ($55 per 100GB).
					</p>
					<p class="text-muted decision-detail">
						Quire integrates Cloudflare R2 via the standard AWS S3 client SDK (<code class="highlight-code">@aws-sdk/client-s3</code>), taking advantage of 10GB free storage and permanently zero egress fees, with an automatic local filesystem fallback for zero-dependency offline local development.
					</p>
				</Stack>
			</Box>

			<footer class="page-footer footer-padded">
				<a href="/dashboard" class="glass-pill text-highlight link-clean">Explore Artist Dashboard →</a>
				<a href="/i/neon-velvet-brooklyn-2026-10-12" class="glass-pill link-clean">View Seeded Zine ↗</a>
			</footer>
		</Stack>
	</Center>
</div>

<style>
	.case-study-root {
		background-color: var(--ink);
		min-block-size: 100vh;
	}

	:global(.case-study-canvas) {
		padding-block: var(--space-xl);
	}

	.link-clean {
		text-decoration: none;
	}

	.tag-inline {
		inline-size: fit-content;
	}

	.case-study-title {
		font-size: clamp(2rem, 5vw, 3.5rem);
		font-weight: 800;
		color: #ffffff;
		margin-block-start: var(--space-2xs);
	}

	.case-study-intro {
		max-inline-size: 65ch;
		font-size: 1.15rem;
		line-height: 1.6;
	}

	.adr-label {
		font-size: 0.8rem;
	}

	.decision-heading {
		font-size: 1.6rem;
		font-weight: 800;
		color: #ffffff;
	}

	.decision-text {
		color: var(--paper);
		line-height: 1.7;
	}

	.decision-detail {
		line-height: 1.6;
	}

	.highlight-code {
		color: var(--highlight);
	}

	.support-code {
		color: var(--support);
	}

	.accent-code {
		color: var(--accent);
	}

	.footer-padded {
		padding-block-start: var(--space-l);
	}
</style>
