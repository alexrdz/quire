<script lang="ts">
	import { enhance } from '$app/forms';
	import { Cluster } from '$lib/components/layout';
	import Stamp from './Stamp.svelte';
	import Tape from './Tape.svelte';
	import TypeLabel from './TypeLabel.svelte';
	import ZinePageShell from './ZinePageShell.svelte';
	import type { PageShell } from './reader';

	interface Props {
		shell: PageShell;
		issue: { id: string; slug: string; date: string; city: string; venue: string };
		artistName: string;
		artistSlug: string;
		signedIn: boolean;
		isScanVerified: boolean;
		/** Stamped or saved, from the load or the action that just ran. */
		stamped: boolean;
		saved: boolean;
		onSignIn: (action: 'stamp' | 'save') => void;
	}

	let { shell, issue, artistName, artistSlug, signedIn, isScanVerified, stamped, saved, onSignIn }: Props =
		$props();
</script>

<!--
	The Endpaper: Authentic Minted Concert Ticket Stub
	Featuring perforated border detailing, authentic minted barcode, serial verification,
	and an ink-pressed official attendance stamp. Compact layout fits within 844px at 320px width.
-->
<ZinePageShell {shell} variant="endpaper">
	<div class="ticket-stub-wrapper">
		<Tape placement="top-left" position={5} />
		<Tape placement="top-right" position={6} />

		<article class="ticket-stub" aria-label="Concert ticket stub">
			<!-- Ticket Header Bar -->
			<div class="ticket-top-bar">
				<TypeLabel position={0} tone="highlight">{issue.date}</TypeLabel>
				<span class="ticket-tier-badge type-face">Admit One · Live Attendance</span>
			</div>

			<!-- Main Ticket Info -->
			<div class="ticket-main">
				<span class="type-face ticket-artist-label">{artistName}</span>
				<h2 class="ticket-city-heading">{issue.city}</h2>
				<p class="type-face ticket-venue-desc">{issue.venue}</p>
			</div>

			<!-- Perforated Tear Line -->
			<div class="ticket-perforation" aria-hidden="true">
				<hr class="back-cover-rule" />
			</div>

			<!-- Barcode and Serial Section -->
			<div class="ticket-barcode-section">
				<div class="ticket-barcode-svg-wrap" aria-hidden="true">
					<svg class="ticket-barcode-svg" viewBox="0 0 160 22" fill="currentColor">
						<rect x="0" y="0" width="3" height="22" />
						<rect x="5" y="0" width="1" height="22" />
						<rect x="8" y="0" width="4" height="22" />
						<rect x="14" y="0" width="2" height="22" />
						<rect x="18" y="0" width="5" height="22" />
						<rect x="25" y="0" width="1" height="22" />
						<rect x="28" y="0" width="3" height="22" />
						<rect x="33" y="0" width="6" height="22" />
						<rect x="41" y="0" width="2" height="22" />
						<rect x="45" y="0" width="4" height="22" />
						<rect x="51" y="0" width="1" height="22" />
						<rect x="54" y="0" width="5" height="22" />
						<rect x="61" y="0" width="3" height="22" />
						<rect x="66" y="0" width="1" height="22" />
						<rect x="69" y="0" width="4" height="22" />
						<rect x="75" y="0" width="2" height="22" />
						<rect x="79" y="0" width="6" height="22" />
						<rect x="87" y="0" width="3" height="22" />
						<rect x="92" y="0" width="1" height="22" />
						<rect x="95" y="0" width="5" height="22" />
						<rect x="102" y="0" width="2" height="22" />
						<rect x="106" y="0" width="4" height="22" />
						<rect x="112" y="0" width="1" height="22" />
						<rect x="115" y="0" width="3" height="22" />
						<rect x="120" y="0" width="6" height="22" />
						<rect x="128" y="0" width="2" height="22" />
						<rect x="132" y="0" width="4" height="22" />
						<rect x="138" y="0" width="1" height="22" />
						<rect x="141" y="0" width="5" height="22" />
						<rect x="148" y="0" width="2" height="22" />
						<rect x="152" y="0" width="3" height="22" />
						<rect x="157" y="0" width="3" height="22" />
					</svg>
				</div>
				<span class="type-face back-cover-serial">#{issue.slug.slice(0, 14).toUpperCase()}</span>
			</div>

			<!-- Stamp or Claim Action -->
			{#if stamped}
				<div class="stamp-action-block">
					<div class="ink-stamp type-face">
						<span class="ink-stamp-title">OFFICIAL ATTENDANCE STAMPED</span>
						<span class="ink-stamp-meta">{issue.city} · {issue.date}</span>
					</div>
					<a href="/me/stubs" class="btn-back-cover">View My Stubs →</a>
				</div>
			{:else if isScanVerified}
				<div class="ticket-action-box">
					<p class="back-cover-note">
						<span class="type-face back-cover-verified">Venue QR scan verified.</span>
						Claim your permanent attendance stub:
					</p>
					{#if signedIn}
						<form method="POST" action="?/claimStamp" use:enhance>
							<input type="hidden" name="issueId" value={issue.id} />
							<button type="submit" class="btn-claim-stamp">Claim Attendance Stamp</button>
						</form>
					{:else}
						<button type="button" class="btn-claim-stamp" onclick={() => onSignIn('stamp')}>
							Sign in with Google to Claim Stamp
						</button>
					{/if}
				</div>
			{:else}
				<div class="ticket-action-box">
					<p class="back-cover-note">
						Browsing remotely. Physical venue QR scan during the 48-hour Stamp Window is required to stamp attendance, or bookmark this issue to your reading list:
					</p>

					{#if saved}
						<Cluster justify="between" align="center" gap="sm">
							<Stamp label="Saved to Bookmarks" tone="highlight" position={4} />
							<a href="/me/stubs" class="btn-back-cover">Open My Stubs →</a>
						</Cluster>
					{:else if signedIn}
						<form method="POST" action="?/saveIssue" use:enhance>
							<input type="hidden" name="issueId" value={issue.id} />
							<button type="submit" class="btn-save-issue">+ Save Issue to My Stubs</button>
						</form>
					{:else}
						<button type="button" class="btn-save-issue" onclick={() => onSignIn('save')}>
							+ Sign in with Google to Save Issue
						</button>
					{/if}
				</div>
			{/if}

			<p class="type-face back-cover-colophon">Made by {artistName} after the show. Printed on Quire.</p>
		</article>
	</div>

	<Cluster justify="center" gap="xs" class="endpaper-links-row">
		<a href="/a/{artistSlug}" class="btn-endpaper-link">
			{artistName} Hub ↗
		</a>
		<a href="/me/stubs" class="btn-endpaper-link">
			My Stubs Collection →
		</a>
	</Cluster>
</ZinePageShell>

<style>
	/* The back cover: authentic minted concert ticket stub */
	.ticket-stub-wrapper {
		position: relative;
		margin-block-start: 0;
	}

	.ticket-stub {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		background-color: var(--zine-scrap-dark);
		background-image:
			var(--zine-grain),
			radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.06), transparent 75%),
			linear-gradient(to bottom, rgba(255, 255, 255, 0.03), transparent 50%);
		background-size: 160px 160px, auto, auto;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 4px;
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.4),
			0 14px 32px -8px rgba(0, 0, 0, 0.8),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.ticket-top-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.ticket-tier-badge {
		font-size: var(--text-meta);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--highlight);
	}

	.ticket-main {
		display: flex;
		flex-direction: column;
		gap: var(--space-4xs);
	}

	.ticket-artist-label {
		font-size: var(--text-small);
		text-transform: uppercase;
		letter-spacing: var(--tracking-label);
		color: var(--accent);
		font-weight: var(--weight-bold);
	}

	.ticket-city-heading {
		font-size: var(--text-heading);
		font-weight: var(--weight-black);
		text-transform: uppercase;
		letter-spacing: var(--tracking-tight);
		line-height: 1.1;
		color: var(--paper);
		overflow-wrap: anywhere;
	}

	.ticket-venue-desc {
		font-size: var(--text-small);
		color: #d4cfdc;
	}

	/* Perforated tear line with notch styling */
	.ticket-perforation {
		position: relative;
		margin-block: var(--space-4xs);
	}

	.back-cover-rule {
		border: 0;
		border-block-start: 2px dashed rgba(244, 244, 240, 0.28);
		margin: 0;
	}

	/* Barcode and serial number */
	.ticket-barcode-section {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		padding-block: var(--space-4xs);
	}

	.ticket-barcode-svg-wrap {
		inline-size: 6rem;
		block-size: 1.1rem;
		color: #c9c3d4;
	}

	.ticket-barcode-svg {
		inline-size: 100%;
		block-size: 100%;
		display: block;
	}

	.back-cover-serial {
		font-size: var(--text-meta);
		color: #c9c3d4;
		letter-spacing: var(--tracking-label);
		overflow-wrap: anywhere;
	}

	.ticket-action-box {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.back-cover-note {
		font-size: var(--text-small);
		line-height: var(--leading-body);
		color: #d4cfdc;
	}

	.back-cover-verified {
		color: var(--highlight);
		font-weight: var(--weight-semibold);
	}

	.back-cover-colophon {
		font-size: var(--text-meta);
		color: #b9b3c4;
	}

	.stamp-action-block {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-xs);
	}

	/* The ink Stamp: authentic mint ink impression with grain texture */
	:global(.ink-stamp) {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		border: 3px solid currentColor;
		border-radius: 4px;
		outline: 1px solid currentColor;
		outline-offset: 3px;
		color: var(--highlight);
		text-align: center;
		transform: rotate(-4deg);
		mask-image: var(--zine-ink-grain);
		mask-size: 120px 120px;
	}

	.ink-stamp-title {
		font-size: var(--text-ui);
		letter-spacing: var(--tracking-label);
		line-height: 1.2;
		font-weight: var(--weight-bold);
	}

	.ink-stamp-meta {
		font-size: var(--text-meta);
		text-transform: uppercase;
		letter-spacing: var(--tracking-label);
	}

	/* The stamp press animation runs when motion is allowed, disabled for reduced motion */
	@media (prefers-reduced-motion: no-preference) {
		:global(.ink-stamp) {
			animation: ink-press 0.38s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.ink-stamp) {
			animation: none;
		}
	}

	@keyframes ink-press {
		from {
			opacity: 0;
			transform: rotate(-4deg) scale(1.6);
		}
		60% {
			opacity: 1;
			transform: rotate(-4deg) scale(0.96);
		}
		to {
			opacity: 1;
			transform: rotate(-4deg) scale(1);
		}
	}

	/* Interactive action buttons (>= 44px touch target) */
	.btn-claim-stamp,
	.btn-save-issue {
		inline-size: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-block-size: 44px;
		min-inline-size: 44px;
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 2px;
		font-size: var(--text-ui);
		font-weight: var(--weight-heavy);
		cursor: pointer;
		transition: filter 0.15s ease, background-color 0.15s ease;
	}

	.btn-claim-stamp {
		background: var(--highlight);
		color: var(--ink);
		border: 1px solid var(--highlight);
	}

	.btn-save-issue {
		background: transparent;
		color: var(--highlight);
		border: 2px solid var(--highlight);
	}

	.btn-claim-stamp:hover {
		filter: brightness(1.08);
	}

	.btn-save-issue:hover {
		background: rgba(1, 255, 195, 0.12);
	}

	:global(.endpaper-links-row) {
		margin-block-start: calc(-1 * var(--space-s));
	}

	.btn-back-cover,
	.btn-endpaper-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-block-size: 44px;
		min-inline-size: 44px;
		padding-block: var(--space-3xs);
		padding-inline: var(--space-xs);
		border-radius: 2px;
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		text-decoration: none;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.btn-back-cover {
		background: transparent;
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.6);
	}

	.btn-endpaper-link {
		background: var(--zine-scrap-dark);
		color: #e4e4e7;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.btn-back-cover:hover {
		background: rgba(1, 255, 195, 0.12);
	}

	.btn-endpaper-link:hover {
		color: #ffffff;
		background: #2a2434;
	}

	.btn-claim-stamp:focus-visible,
	.btn-save-issue:focus-visible,
	.btn-back-cover:focus-visible,
	.btn-endpaper-link:focus-visible {
		outline: 2px solid var(--highlight);
		outline-offset: 2px;
	}
</style>
