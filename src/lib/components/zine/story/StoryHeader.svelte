<script lang="ts">
	import { initialsOf } from './context';

	/**
	 * The reader's header (ADR 0011), over the top of every page: the progress
	 * bar (one bar per segment), then the Artist's avatar, name, "City · Date",
	 * and Close, which goes to the Artist's page.
	 */
	interface Props {
		progress: Array<'done' | 'current' | 'todo'>;
		artistName: string;
		artistSlug: string;
		avatarUrl?: string | null;
		city: string;
		date: string;
	}

	let { progress, artistName, artistSlug, avatarUrl, city, date }: Props = $props();
</script>

<header class="story-header">
	<ol class="story-progress" aria-hidden="true">
		{#each progress as state, i (i)}
			<li class="story-progress-bar is-{state}"></li>
		{/each}
	</ol>
	<div class="story-header-row">
		{#if avatarUrl}
			<img class="story-avatar" src={avatarUrl} alt="" />
		{:else}
			<span class="story-avatar story-avatar-initials" aria-hidden="true">{initialsOf(artistName)}</span>
		{/if}
		<div class="story-header-text">
			<span class="story-header-name">{artistName}</span>
			<span class="story-header-meta">{city} · {date}</span>
		</div>
		<a class="story-close" href="/a/{artistSlug}" aria-label="Close and go to {artistName}'s page">
			<svg viewBox="0 0 24 24" aria-hidden="true" class="story-icon">
				<path d="M6 6l12 12M18 6L6 18" />
			</svg>
		</a>
	</div>
</header>

<style>
	.story-header {
		position: absolute;
		z-index: 3;
		inset-block-start: 0;
		inset-inline: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding-block: max(var(--space-2xs), env(safe-area-inset-top)) var(--space-m);
		padding-inline: var(--space-xs);
		/* A scrim so the bars and the name read over any photo: at least 60% black
		   under every word (AA for white text over any image), fading out only in
		   the bottom padding, below the text. */
		background: linear-gradient(
			to bottom,
			rgba(0, 0, 0, 0.62),
			rgba(0, 0, 0, 0.6) calc(100% - var(--space-m)),
			transparent
		);
		pointer-events: none;
	}

	.story-progress {
		display: flex;
		gap: var(--space-4xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.story-progress-bar {
		flex: 1 1 0;
		block-size: 0.1875rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.35);
	}

	.story-progress-bar.is-done {
		background: rgba(255, 255, 255, 0.92);
	}

	.story-progress-bar.is-current {
		background: var(--accent);
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
	}

	.story-header-row {
		display: flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.story-avatar {
		flex: none;
		inline-size: 2rem;
		block-size: 2rem;
		border-radius: 999px;
		object-fit: cover;
		background: #2a2633;
	}

	.story-avatar-initials {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}

	.story-header-text {
		display: flex;
		flex-direction: column;
		min-inline-size: 0;
		flex: 1 1 auto;
		line-height: 1.25;
	}

	.story-header-name,
	.story-header-meta {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	.story-header-name {
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}

	.story-header-meta {
		font-size: var(--text-meta);
		color: #ffffff;
	}

	.story-close {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: var(--control-size);
		block-size: var(--control-size);
		border-radius: 999px;
		color: #ffffff;
		pointer-events: auto;
	}

	.story-close:focus-visible {
		outline: 2px solid #ffffff;
		outline-offset: -2px;
	}

	.story-icon {
		inline-size: 1.5rem;
		block-size: 1.5rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
	}
</style>
