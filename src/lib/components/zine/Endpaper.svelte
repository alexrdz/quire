<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatIssueDate } from '$domain/issue-date';
	import type { PageShell } from './reader';

	interface Props {
		shell: PageShell;
		issue: { id: string; slug: string; date: string; timezone?: string | null; city: string; venue: string };
		artistName: string;
		artistSlug: string;
		signedIn: boolean;
		isScanVerified: boolean;
		/** Stamped or saved, from the load or the action that just ran. */
		stamped: boolean;
		saved: boolean;
		onSignIn: (action: 'stamp' | 'save') => void;
	}

	let { shell, issue, artistName, artistSlug, signedIn, isScanVerified, stamped, saved, onSignIn }: Props = $props();

	const date = $derived(formatIssueDate(issue.date, issue.timezone, 'long'));
</script>

<!--
	The Endpaper (ADR 0011): the last page. "That's the zine.", then Save and
	Stamp as two clear buttons. A claimed Stamp is a clean confirmation card,
	not an ink stamp. Then links to the Artist's page and My Stubs. Stamping
	still needs the venue scan (Scan Token) inside the Stamp Window; Save works
	anywhere, and a saved Issue can still be stamped later.
-->
<section id={shell.id} class="story-endpaper" aria-labelledby="endpaper-title">
	<div class="endpaper-body">
		<header class="endpaper-head">
			<h2 id="endpaper-title" class="endpaper-title" tabindex="-1">That's the zine.</h2>
			<p class="endpaper-meta">{artistName} · {issue.venue} · {issue.city} · <time datetime={issue.date}>{date}</time></p>
		</header>

		{#if stamped}
			<div class="stamped-card" role="status">
				<span class="stamped-check" aria-hidden="true">
					<svg viewBox="0 0 24 24" class="endpaper-icon"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
				</span>
				<div class="stamped-text">
					<strong class="stamped-title">Stamped</strong>
					<span class="stamped-meta">{issue.venue} · {date}</span>
				</div>
			</div>
		{/if}

		<div class="endpaper-actions">
			{#if !stamped}
				{#if isScanVerified}
					{#if signedIn}
						<form method="POST" action="?/claimStamp" use:enhance>
							<input type="hidden" name="issueId" value={issue.id} />
							<button type="submit" class="endpaper-button is-primary">Claim your Stamp</button>
						</form>
					{:else}
						<button type="button" class="endpaper-button is-primary" onclick={() => onSignIn('stamp')}>
							Sign in to claim your Stamp
						</button>
					{/if}
					<p class="endpaper-hint">You scanned the venue's QR code, so this Issue can be stamped as attended.</p>
				{:else}
					<span class="endpaper-button is-unavailable" aria-disabled="true" data-testid="stamp-unavailable">Stamp</span>
					<p class="endpaper-hint">Stamps are for Fans who were there: scan the QR code at the venue during the Stamp Window.</p>
				{/if}
			{/if}

			{#if stamped || saved}
				<p class="endpaper-saved" role="status">
					<svg viewBox="0 0 24 24" class="endpaper-icon" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
					In your Stubs
				</p>
			{:else if signedIn}
				<form method="POST" action="?/saveIssue" use:enhance>
					<input type="hidden" name="issueId" value={issue.id} />
					<button type="submit" class="endpaper-button">Save to My Stubs</button>
				</form>
			{:else}
				<button type="button" class="endpaper-button" onclick={() => onSignIn('save')}>Sign in to save</button>
			{/if}
		</div>

		<nav class="endpaper-links" aria-label="After the zine">
			<a href="/a/{artistSlug}" class="endpaper-link">{artistName}'s page</a>
			<a href="/me/stubs" class="endpaper-link">My Stubs</a>
		</nav>
	</div>
</section>

<style>
	.story-endpaper {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		padding-block: var(--story-top-space) var(--story-bottom-space);
		padding-inline: var(--space-s);
		background: var(--bg-void);
		color: #ffffff;
		font-family: var(--story-font, system-ui, sans-serif);
	}

	.endpaper-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-m);
		margin-block: auto;
	}

	.endpaper-head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.endpaper-title {
		margin: 0;
		font-family: var(--story-heading-font, inherit);
		font-size: var(--text-title);
		font-weight: var(--weight-heavy);
		line-height: 1.05;
	}

	.endpaper-title:focus {
		outline: none;
	}

	.endpaper-meta {
		margin: 0;
		font-size: var(--text-ui);
		line-height: var(--leading-body);
		color: #c4c0cc;
	}

	/* The Stamped card: a check, "Stamped", venue and date. */
	.stamped-card {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		padding-block: var(--space-s);
		padding-inline: var(--space-s);
		border-radius: 12px;
		background: rgba(1, 255, 195, 0.1);
		box-shadow: inset 0 0 0 1px rgba(1, 255, 195, 0.45);
	}

	.stamped-check {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: var(--control-size);
		block-size: var(--control-size);
		border-radius: 999px;
		background: var(--highlight);
		color: var(--bg-void);
	}

	.stamped-text {
		display: flex;
		flex-direction: column;
		gap: var(--space-4xs);
	}

	.stamped-title {
		font-size: var(--text-body);
		font-weight: var(--weight-heavy);
		color: var(--highlight);
	}

	.stamped-meta {
		font-size: var(--text-small);
		color: #ffffff;
	}

	.endpaper-icon {
		inline-size: 1.25rem;
		block-size: 1.25rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.endpaper-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.endpaper-actions form {
		display: contents;
	}

	.endpaper-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: 100%;
		min-block-size: var(--control-size);
		padding-inline: var(--space-m);
		border: 0;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
		font-family: inherit;
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		cursor: pointer;
	}

	.endpaper-button.is-primary {
		background: var(--highlight);
		color: var(--bg-void);
	}

	/* Not a broken button: an outline that says what Stamping needs, with the hint under it. */
	.endpaper-button.is-unavailable {
		background: transparent;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
		color: #c4c0cc;
		cursor: default;
	}

	.endpaper-hint {
		margin: 0;
		font-size: var(--text-small);
		line-height: var(--leading-body);
		color: #c4c0cc;
	}

	.endpaper-saved {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3xs);
		min-block-size: var(--control-size);
		margin: 0;
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		color: var(--highlight);
	}

	.endpaper-links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.endpaper-link {
		display: inline-flex;
		align-items: center;
		min-block-size: var(--control-size);
		font-size: var(--text-ui);
		font-weight: var(--weight-semibold);
		color: #ffffff;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.endpaper-button:focus-visible,
	.endpaper-link:focus-visible {
		outline: 2px solid #ffffff;
		outline-offset: 2px;
	}
</style>
