<script lang="ts">
	/**
	 * The reader's bottom bar (ADR 0011), on every page but the Cover: the Tip
	 * pill (when the Artist has a Venmo username), the Wall with its note count,
	 * and Next. On the last page there is nothing to go on to, so Next is gone.
	 */
	interface Props {
		showTip: boolean;
		noteCount: number;
		hasNext: boolean;
		artistName: string;
		onTip: () => void;
		onWall: () => void;
		onNext: () => void;
	}

	let { showTip, noteCount, hasNext, artistName, onTip, onWall, onNext }: Props = $props();
</script>

<div class="story-bar">
	{#if showTip}
		<button type="button" class="story-pill story-tip" onclick={onTip} aria-haspopup="dialog">
			<span aria-hidden="true">Tip</span>
			<span class="visually-hidden">Tip {artistName} with Venmo</span>
		</button>
	{/if}
	<button
		type="button"
		class="story-pill story-wall"
		onclick={onWall}
		aria-haspopup="dialog"
		aria-label="The Wall, {noteCount} {noteCount === 1 ? 'note' : 'notes'}"
	>
		<svg viewBox="0 0 24 24" aria-hidden="true" class="story-bar-icon">
			<path d="M4 5h16v11H8l-4 4z" />
		</svg>
		<span aria-hidden="true">Wall</span>
		<span class="story-count" aria-hidden="true">{noteCount}</span>
	</button>
	{#if hasNext}
		<button type="button" class="story-pill story-next" onclick={onNext}>
			Next
			<svg viewBox="0 0 24 24" aria-hidden="true" class="story-bar-icon">
				<path d="M9 5l7 7-7 7" />
			</svg>
		</button>
	{/if}
</div>

<style>
	.story-bar {
		position: absolute;
		z-index: 3;
		inset-block-end: 0;
		inset-inline: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2xs);
		padding-block: var(--space-m) max(var(--space-xs), env(safe-area-inset-bottom));
		padding-inline: var(--space-xs);
		background: linear-gradient(to top, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.35) 60%, transparent);
	}

	.story-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3xs);
		min-block-size: var(--control-size);
		min-inline-size: var(--control-size);
		padding-inline: var(--space-s);
		border: 0;
		border-radius: 999px;
		font-family: inherit;
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		line-height: 1;
		cursor: pointer;
		white-space: nowrap;
	}

	.story-pill:focus-visible {
		outline: 2px solid #ffffff;
		outline-offset: 2px;
	}

	/* Dark text on --support: about 5.7:1 (white would be 3.5:1). */
	.story-tip {
		background: var(--support);
		color: var(--bg-void);
		font-weight: var(--weight-heavy);
	}

	/* A dark pill, so its white text passes AA over any photo behind the bar. */
	.story-wall {
		background: rgba(22, 19, 29, 0.88);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
		color: #ffffff;
	}

	.story-count {
		min-inline-size: 1.25rem;
		padding-inline: var(--space-3xs);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.16);
		font-size: var(--text-meta);
		line-height: 1.5;
		text-align: center;
	}

	.story-next {
		margin-inline-start: auto;
		background: var(--accent);
		color: var(--on-accent, #090710);
	}

	.story-bar-icon {
		inline-size: 1.125rem;
		block-size: 1.125rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
