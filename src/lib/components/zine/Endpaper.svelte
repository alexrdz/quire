<script lang="ts">
	import { enhance } from '$app/forms';
	import { Stack, Box, Cluster } from '$lib/components/layout';
	import MetaChip from './MetaChip.svelte';
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

<ZinePageShell {shell} variant="endpaper">
	<!-- Dark Glass Perforated Ticket Stub -->
	<Stack as="article" gap="sm" class="ticket-stub endpaper-stub">
		<Cluster justify="between" align="center">
			<MetaChip tone="highlight">{issue.date}</MetaChip>
			<span class="font-mono text-muted stub-serial">
				#{issue.slug.slice(0, 14).toUpperCase()}
			</span>
		</Cluster>

		<Stack gap="2xs">
			<span class="text-accent font-mono eyebrow-small">{artistName}</span>
			<h2 class="stub-city-heading">{issue.city}</h2>
			<p class="text-muted stub-venue-line">{issue.venue}</p>
		</Stack>

		<div class="ticket-stub-perforation"></div>

		<Stack gap="md">
			{#if stamped}
				<Box variant="subtle" padding="md" radius="md" class="stamped-verified-box">
					<Cluster justify="between" align="center">
						<span class="text-highlight font-mono stamped-confirm-text">
							✓ OFFICIAL ATTENDANCE STAMPED
						</span>
						<a href="/me/stubs" class="btn-action-highlight">
							View My Stubs →
						</a>
					</Cluster>
				</Box>
			{:else if isScanVerified}
				<Stack gap="xs">
					<p class="text-highlight stub-status-note">
						● Venue QR Scan Verified! Claim your permanent attendance stub:
					</p>
					{#if signedIn}
						<form method="POST" action="?/claimStamp" use:enhance>
							<input type="hidden" name="issueId" value={issue.id} />
							<button type="submit" class="btn-claim-stamp">
								Claim Attendance Stamp
							</button>
						</form>
					{:else}
						<button type="button" class="btn-claim-stamp" onclick={() => onSignIn('stamp')}>
							Sign in with Google to Claim Stamp
						</button>
					{/if}
				</Stack>
			{:else}
				<Stack gap="sm">
					<p class="text-muted stub-status-note">
						Browsing remotely. Physical venue QR scan during the 48-hour Stamp Window is required to stamp attendance, or bookmark this issue to your reading list:
					</p>

					{#if saved}
						<Cluster justify="between" align="center">
							<span class="text-highlight font-mono">✓ Saved to Bookmarks</span>
							<a href="/me/stubs" class="btn-action-highlight">
								Open My Stubs →
							</a>
						</Cluster>
					{:else if signedIn}
						<form method="POST" action="?/saveIssue" use:enhance>
							<input type="hidden" name="issueId" value={issue.id} />
							<button type="submit" class="btn-save-issue">
								+ Save Issue to My Stubs
							</button>
						</form>
					{:else}
						<button type="button" class="btn-save-issue" onclick={() => onSignIn('save')}>
							+ Sign in with Google to Save Issue
						</button>
					{/if}
				</Stack>
			{/if}
		</Stack>
	</Stack>

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
	:global(.endpaper-stub) {
		padding-block: var(--space-m);
		padding-inline: var(--space-m);
	}

	.stub-serial {
		font-size: var(--text-meta);
	}

	.stub-city-heading {
		font-size: var(--text-title);
		font-weight: var(--weight-black);
		text-transform: uppercase;
		letter-spacing: var(--tracking-tight);
		color: #ffffff;
	}

	.stub-venue-line {
		font-size: var(--text-body);
	}

	:global(.stamped-verified-box) {
		border-color: rgba(1, 255, 195, 0.4);
		background: rgba(1, 255, 195, 0.08);
	}

	.stamped-confirm-text {
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
	}

	.stub-status-note {
		font-size: var(--text-small);
		line-height: var(--leading-body);
	}

	.btn-claim-stamp {
		inline-size: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 8px;
		background: var(--highlight);
		color: #090710;
		border: 1px solid rgba(1, 255, 195, 0.6);
		font-size: var(--text-ui);
		font-weight: var(--weight-heavy);
		cursor: pointer;
		box-shadow: 0 4px 20px rgba(1, 255, 195, 0.35);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-claim-stamp:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 24px rgba(1, 255, 195, 0.55);
	}

	.btn-save-issue {
		inline-size: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 8px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-save-issue:hover {
		background: rgba(1, 255, 195, 0.24);
		border-color: rgba(1, 255, 195, 0.7);
	}

	.btn-endpaper-link {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.05);
		color: #e4e4e7;
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		text-decoration: none;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.btn-endpaper-link:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
	}
</style>
