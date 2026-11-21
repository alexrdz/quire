<script lang="ts">
	import { enhance } from '$app/forms';
	import { Stack, Cluster } from '$lib/components/layout';
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
	The Endpaper is the zine's back cover (ADR 0009): a sheet of dark paper taped
	on flat, with the Issue's details typed on it. Save and Stamp are plain,
	clear buttons. A claimed Stamp is an ink stamp pressed onto the cover (a
	short press, or no motion at all with reduced motion).
-->
<ZinePageShell {shell} variant="endpaper">
	<div class="back-cover">
		<Tape placement="top-left" position={5} />
		<Tape placement="top-right" position={6} />

		<Stack as="article" gap="md" class="back-cover-paper" aria-label="Back cover">
			<Cluster justify="between" align="center" gap="xs">
				<TypeLabel position={0} tone="highlight">{issue.date}</TypeLabel>
				<span class="type-face back-cover-serial">#{issue.slug.slice(0, 14).toUpperCase()}</span>
			</Cluster>

			<Stack gap="2xs">
				<span class="type-face back-cover-artist">{artistName}</span>
				<h2 class="back-cover-city">{issue.city}</h2>
				<p class="type-face back-cover-venue">{issue.venue}</p>
			</Stack>

			<hr class="back-cover-rule" />

			{#if stamped}
				<Stack gap="sm" align="start">
					<Stack gap="3xs" align="center" class="ink-stamp type-face">
						<span class="ink-stamp-title">OFFICIAL ATTENDANCE STAMPED</span>
						<span class="ink-stamp-meta">{issue.city} · {issue.date}</span>
					</Stack>
					<a href="/me/stubs" class="btn-back-cover">View My Stubs →</a>
				</Stack>
			{:else if isScanVerified}
				<Stack gap="sm">
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
				</Stack>
			{:else}
				<Stack gap="sm">
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
				</Stack>
			{/if}

			<p class="type-face back-cover-colophon">Made by {artistName} after the show. Printed on Quire.</p>
		</Stack>
	</div>

	<Cluster justify="center" gap="sm">
		<a href="/a/{artistSlug}" class="btn-endpaper-link">
			{artistName} Back Page ↗
		</a>
		<a href="/me/stubs" class="btn-endpaper-link">
			My Stubs Collection →
		</a>
	</Cluster>
</ZinePageShell>

<style>
	/* The back cover: dark paper, taped on flat so its buttons stay square. */
	/* The margin keeps the corner tape clear of the page's typed labels. */
	.back-cover {
		position: relative;
		margin-block-start: var(--space-l);
	}

	:global(.back-cover-paper) {
		padding-block: var(--space-m);
		padding-inline: var(--space-m);
		background-color: var(--zine-scrap-dark);
		background-image: var(--zine-grain);
		background-size: 160px 160px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 2px 3px 2px 4px;
		box-shadow:
			0 1px 1px rgba(0, 0, 0, 0.4),
			0 14px 30px -10px rgba(0, 0, 0, 0.75);
	}

	.back-cover-serial {
		font-size: var(--text-meta);
		color: #c9c3d4;
		overflow-wrap: anywhere;
	}

	.back-cover-artist {
		font-size: var(--text-small);
		text-transform: uppercase;
		letter-spacing: var(--tracking-label);
		color: var(--accent);
	}

	.back-cover-city {
		font-size: var(--text-title);
		font-weight: var(--weight-black);
		text-transform: uppercase;
		letter-spacing: var(--tracking-tight);
		line-height: 1;
		color: var(--paper);
		overflow-wrap: anywhere;
	}

	.back-cover-venue {
		font-size: var(--text-body);
		color: #d4cfdc;
	}

	/* A cut line across the cover. */
	.back-cover-rule {
		border: 0;
		border-block-start: 2px dashed rgba(244, 244, 240, 0.28);
		margin: 0;
	}

	.back-cover-note {
		font-size: var(--text-small);
		line-height: var(--leading-body);
		color: #d4cfdc;
	}

	.back-cover-verified {
		color: var(--highlight);
	}

	.back-cover-colophon {
		font-size: var(--text-meta);
		color: #b9b3c4;
	}

	/* The ink Stamp: a double rule and type in mint ink, broken up by grain. */
	:global(.ink-stamp) {
		padding-block: var(--space-xs);
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
	}

	.ink-stamp-meta {
		font-size: var(--text-meta);
		text-transform: uppercase;
		letter-spacing: var(--tracking-label);
	}

	/* The press: the stamp comes down onto the cover. None with reduced motion. */
	@media (prefers-reduced-motion: no-preference) {
		:global(.ink-stamp) {
			animation: ink-press 0.38s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
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

	.btn-claim-stamp,
	.btn-save-issue {
		inline-size: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-block-size: 44px;
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

	.btn-back-cover,
	.btn-endpaper-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-block-size: 44px;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
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
