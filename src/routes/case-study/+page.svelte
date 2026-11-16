<script lang="ts">
	// Portfolio Architectural Case Study
</script>

<svelte:head>
	<title>Architectural Case Study — Quire</title>
</svelte:head>

<div style="background-color: var(--ink); min-block-size: 100vh;">
	<div data-center style="padding-block: 2.5rem;" data-stack="xl">
		<header class="cover-header">
			<a href="/" class="glass-pill text-highlight" style="text-decoration: none;">← Quire Home</a>
			<span class="glass-pill">Engineering Case Study</span>
		</header>

		<div data-stack="xs">
			<span class="tag-highlight glass-pill" style="inline-size: fit-content;">Architectural Deep Dive</span>
			<h1 style="font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; color: #FFFFFF; margin-block-start: 0.5rem;">
				How Quire Was Built
			</h1>
			<p class="text-muted" style="max-inline-size: 65ch; font-size: 1.15rem; line-height: 1.6;">
				Replacing fragmented link trees and Venmo signs with an all-in-one music zine and attendance hub. Below are the 5 non-obvious engineering decisions that shaped the system.
			</p>
		</div>

		<!-- Section 1 -->
		<section class="glass-panel" style="padding: 2rem;" data-stack="md">
			<div data-cluster="between">
				<span class="glass-pill tag-highlight">Decision 01</span>
				<span class="text-muted" style="font-size: 0.8rem;">ADR 0001</span>
			</div>
			<h2 style="font-size: 1.6rem; font-weight: 800; color: #FFFFFF;">
				1. The Sticker is the Geofence (No GPS)
			</h2>
			<p style="color: var(--paper); line-height: 1.7;">
				Proving attendance at music venues traditionally involves battery-draining GPS location prompts that fail in basement venues or trigger user privacy concerns. Instead, Quire treats the physical QR sticker as the geofence.
			</p>
			<p class="text-muted" style="line-height: 1.6;">
				The physical sticker embeds a dedicated route <code style="color: var(--highlight);">/scan/[slug]?k=[secret]</code>. Visiting this endpoint during the venue's 48-hour local Stamp Window issues an HMAC SHA-256 attendance token. Direct web links to <code style="color: var(--highlight);">/i/[slug]</code> allow reading and tipping from anywhere in the world, but only physical QR scans confer authenticated digital ticket stubs.
			</p>
		</section>

		<!-- Section 2 -->
		<section class="glass-panel" style="padding: 2rem;" data-stack="md">
			<div data-cluster="between">
				<span class="glass-pill tag-support">Decision 02</span>
				<span class="text-muted" style="font-size: 0.8rem;">ADR 0003</span>
			</div>
			<h2 style="font-size: 1.6rem; font-weight: 800; color: #FFFFFF;">
				2. Tipping: 1-Tap, Anonymous, Never Retried Later
			</h2>
			<p style="color: var(--paper); line-height: 1.7;">
				Tipping takes one tap with Apple Pay or Google Pay via Stripe Connect Express. Tipping is completely anonymous (no account required).
			</p>
			<p class="text-muted" style="line-height: 1.6;">
				Crucially, Decision 18 mandates that tips are charged only when the fan actively taps. If cell signal drops at a crowded festival, the checkout flow resets immediately with an honest message. We never queue transactions in the background or attempt surprise delayed charges, preserving trust. In development or review mode, an offline payment simulator records real financial data to the database without requiring live Stripe keys.
			</p>
		</section>

		<!-- Section 3 -->
		<section class="glass-panel" style="padding: 2rem;" data-stack="md">
			<div data-cluster="between">
				<span class="glass-pill tag-accent">Decision 03</span>
				<span class="text-muted" style="font-size: 0.8rem;">SPEC §5</span>
			</div>
			<h2 style="font-size: 1.6rem; font-weight: 800; color: #FFFFFF;">
				3. The Wall: Open Guestbook & Pending Action Preservation
			</h2>
			<p style="color: var(--paper); line-height: 1.7;">
				To capture in-the-moment live concert excitement, anonymous fans can type their note directly without signing in upfront.
			</p>
			<p class="text-muted" style="line-height: 1.6;">
				Tapping "Post note" saves the typed text in <code style="color: var(--highlight);">sessionStorage</code>, initiates Google OAuth, and automatically submits the note upon return. Community integrity is guarded by automated screening (regex blocking URLs, phone numbers, and email addresses) and a 3-flag auto-hide threshold. When an artist restores a flagged note, it becomes permanently <code style="color: var(--highlight);">flagImmune</code> to neutralize bad-faith brigading.
			</p>
		</section>

		<!-- Section 4 -->
		<section class="glass-panel" style="padding: 2rem;" data-stack="md">
			<div data-cluster="between">
				<span class="glass-pill">Decision 04</span>
				<span class="text-muted" style="font-size: 0.8rem;">ADR 0002</span>
			</div>
			<h2 style="font-size: 1.6rem; font-weight: 800; color: #FFFFFF;">
				4. Constrained Theming: CUBE CSS & Native @layer (No Tailwind)
			</h2>
			<p style="color: var(--paper); line-height: 1.7;">
				Quire strictly enforces a single dark-glass house aesthetic inspired by vintage print zines and modern OLED screens.
			</p>
			<p class="text-muted" style="line-height: 1.6;">
				Rather than bloated utility class libraries, styling is written in pure vanilla CUBE CSS using native cascading layers:
				<code style="color: var(--highlight);">@layer base, layouts, components, sticker, bookbinder, utilities</code>.
				Platform tokens (<code style="color: var(--highlight);">--highlight</code> mint and <code style="color: var(--support);">--support</code> pink) remain fixed across the entire network, while artists customize only their cover art, typography pairing, and dynamic <code style="color: var(--accent);">--accent</code> token.
			</p>
		</section>

		<!-- Section 5 -->
		<section class="glass-panel" style="padding: 2rem;" data-stack="md">
			<div data-cluster="between">
				<span class="glass-pill tag-highlight">Decision 05</span>
				<span class="text-muted" style="font-size: 0.8rem;">ADR 0004</span>
			</div>
			<h2 style="font-size: 1.6rem; font-weight: 800; color: #FFFFFF;">
				5. Media Storage: Cloudflare R2 ($0 Egress Bandwidth)
			</h2>
			<p style="color: var(--paper); line-height: 1.7;">
				When 5,000 festival attendees scan an Issue QR simultaneously, image downloads would rapidly trigger punitive bandwidth egress charges on standard cloud storage or Netlify Blobs ($55 per 100GB).
			</p>
			<p class="text-muted" style="line-height: 1.6;">
				Quire integrates Cloudflare R2 via the standard AWS S3 client SDK (<code style="color: var(--highlight);">@aws-sdk/client-s3</code>), taking advantage of 10GB free storage and permanently zero egress fees, with an automatic local filesystem fallback for zero-dependency offline local development.
			</p>
		</section>

		<footer class="page-footer" style="padding-block-start: 2rem;">
			<a href="/dashboard" class="glass-pill text-highlight" style="text-decoration: none;">Explore Artist Dashboard →</a>
			<a href="/i/neon-velvet-brooklyn-2026-10-12" class="glass-pill" style="text-decoration: none;">View Seeded Zine ↗</a>
		</footer>
	</div>
</div>
