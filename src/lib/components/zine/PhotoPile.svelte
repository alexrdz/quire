<script lang="ts">
	import { untrack } from 'svelte';
	import { Stack, Cluster, Frame } from '$lib/components/layout';
	import {
		createPile,
		pileTilt,
		transitionPile,
		type PhotoEntry,
		type PileEvent,
		type PileState
	} from '$domain/photo-pile';

	interface Props {
		photos: PhotoEntry[];
		/** Accessible name of the pile and alt-text prefix for photos without a caption. */
		label: string;
	}

	let { photos, label }: Props = $props();

	/** Horizontal drag distance, in px, that counts as a toss. */
	const TOSS_DISTANCE = 72;
	/** Visible depth of the stack under the top photo. */
	const VISIBLE_DEPTH = 2;

	let pile = $state<PileState>(untrack(() => createPile(photos.length)));
	let tossDirections = $state<Record<number, 1 | -1>>({});

	let dragX = $state(0);
	let dragging = $state(false);
	let dragStartX = 0;
	let dragMoved = false;

	let topIndex = $derived(pile.phase === 'stacked' ? pile.top : photos.length);
	let isBack = $derived(pile.phase === 'stacked' && pile.side === 'back');
	let topPhoto = $derived(pile.phase === 'stacked' ? photos[pile.top] : undefined);
	let canFlip = $derived(Boolean(topPhoto?.caption));
	let canRestore = $derived(pile.phase === 'cleared' || pile.top > 0);
	let counter = $derived(
		pile.phase === 'stacked'
			? `${pad(pile.top + 1)} / ${pad(pile.total)}`
			: `${pad(pile.total)} / ${pad(pile.total)}`
	);
	let announcement = $derived(
		pile.phase === 'stacked'
			? `Photo ${pile.top + 1} of ${pile.total}${topPhoto?.caption ? `: ${topPhoto.caption}` : ''}${isBack ? ' (caption side)' : ''}`
			: 'End of the pile. Use Restack to view the photos again.'
	);

	function pad(n: number): string {
		return String(n).padStart(2, '0');
	}

	function send(event: PileEvent): void {
		const next = transitionPile(pile, event);
		if (next.ok) pile = next.value;
	}

	function defaultDirection(index: number): 1 | -1 {
		return index % 2 === 0 ? -1 : 1;
	}

	function toss(direction?: 1 | -1): void {
		if (pile.phase !== 'stacked') return;
		tossDirections[pile.top] = direction ?? defaultDirection(pile.top);
		send('toss');
	}

	function flip(): void {
		if (canFlip) send('flip');
	}

	function cardState(index: number): 'top' | 'under' | 'hidden' | 'tossed' {
		if (index < topIndex) return 'tossed';
		if (index === topIndex) return 'top';
		return index - topIndex <= VISIBLE_DEPTH ? 'under' : 'hidden';
	}

	function onPointerDown(event: PointerEvent): void {
		if (pile.phase !== 'stacked') return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		dragging = true;
		dragMoved = false;
		dragStartX = event.clientX;
		dragX = 0;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent): void {
		if (!dragging) return;
		dragX = event.clientX - dragStartX;
		if (Math.abs(dragX) > 6) dragMoved = true;
	}

	function onPointerUp(): void {
		if (!dragging) return;
		const distance = dragX;
		dragging = false;
		dragX = 0;
		if (Math.abs(distance) >= TOSS_DISTANCE) {
			toss(distance > 0 ? 1 : -1);
		}
	}

	function onPointerCancel(): void {
		dragging = false;
		dragX = 0;
		dragMoved = false;
	}

	/** A tap flips a captioned photo and tosses a photo without a caption. */
	function onCardClick(): void {
		if (dragMoved) {
			dragMoved = false;
			return;
		}
		if (canFlip) {
			flip();
		} else {
			toss();
		}
	}

	function cardStyle(index: number): string {
		const state = cardState(index);
		const parts = [
			`--tilt: ${pileTilt(index)}deg`,
			`--depth: ${Math.max(0, index - topIndex)}`,
			`--toss-dir: ${tossDirections[index] ?? defaultDirection(index)}`
		];
		if (state === 'top') {
			parts.push(`--drag-x: ${dragX}px`, `--drag-rot: ${dragX / 14}deg`);
		}
		return parts.join('; ');
	}
</script>

<Stack gap="sm" class="photo-pile">
	<div class="pile-stage" role="group" aria-roledescription="photo pile" aria-label={label}>
		{#each photos as photo, i (photo.url + i)}
			{@const state = cardState(i)}
			<div
				class="polaroid"
				data-state={state}
				data-dragging={state === 'top' && dragging ? 'true' : undefined}
				style={cardStyle(i)}
				inert={state !== 'top'}
			>
				<button
					type="button"
					class="polaroid-body"
					data-side={state === 'top' && isBack ? 'back' : 'front'}
					aria-label={photo.caption
						? `Photo ${i + 1} of ${photos.length}. Tap to flip and read the caption, or swipe to toss.`
						: `Photo ${i + 1} of ${photos.length}. Tap or swipe to toss.`}
					onpointerdown={onPointerDown}
					onpointermove={onPointerMove}
					onpointerup={onPointerUp}
					onpointercancel={onPointerCancel}
					onclick={onCardClick}
				>
					<Stack as="span" gap="none" class="polaroid-face polaroid-front">
						<Frame as="span" ratio="1-1" class="polaroid-photo">
							<img
								src={photo.url}
								alt={photo.caption || `${label} photo ${i + 1}`}
								loading={i < 3 ? 'eager' : 'lazy'}
								decoding="async"
								draggable="false"
							/>
						</Frame>
						<span class="polaroid-strip font-mono">
							<span>{pad(i + 1)}</span>
							{#if photo.caption}
								<span class="polaroid-hint">Flip</span>
							{/if}
						</span>
					</Stack>
					<Stack as="span" gap="xs" align="center" class="polaroid-face polaroid-back">
						<span class="polaroid-note">{photo.caption}</span>
						<span class="polaroid-strip font-mono">{pad(i + 1)} / {pad(photos.length)}</span>
					</Stack>
				</button>
			</div>
		{/each}
		{#if pile.phase === 'cleared'}
			<p class="pile-empty font-mono">End of the pile</p>
		{/if}
	</div>

	<Cluster justify="between" align="center" gap="xs" class="pile-controls">
		<button type="button" class="pile-btn" onclick={() => send('restore')} disabled={!canRestore}>
			Back
		</button>
		<button type="button" class="pile-btn" onclick={flip} disabled={!canFlip}>Flip</button>
		<span class="pile-counter font-mono" aria-hidden="true">{counter}</span>
		{#if pile.phase === 'cleared'}
			<button type="button" class="pile-btn pile-btn-primary" onclick={() => send('restack')}>
				Restack
			</button>
		{:else}
			<button type="button" class="pile-btn pile-btn-primary" onclick={() => toss()}>Toss</button>
		{/if}
	</Cluster>

	<p class="visually-hidden" aria-live="polite">{announcement}</p>
</Stack>

<style>
	.pile-stage {
		position: relative;
		inline-size: min(100%, 24rem, 48dvh);
		aspect-ratio: 1 / 1.04;
		margin-inline: auto;
		/* Tossed photos leave sideways; clip them so the zine pager never gains a horizontal scrollbar. */
		overflow-x: clip;
	}

	.polaroid {
		position: absolute;
		inset-block: 0;
		inset-inline: 8%;
		perspective: 1200px;
		transform-origin: 50% 92%;
		transition:
			transform 0.45s cubic-bezier(0.2, 0.8, 0.25, 1),
			opacity 0.3s ease;
	}

	.polaroid[data-state='top'] {
		z-index: 100;
		transform: translateX(var(--drag-x, 0px)) rotate(calc(var(--tilt) * 0.5 + var(--drag-rot, 0deg)));
	}

	.polaroid[data-state='under'],
	.polaroid[data-state='hidden'] {
		z-index: calc(100 - var(--depth));
		transform: translateY(calc(var(--depth) * 0.45rem)) rotate(var(--tilt))
			scale(calc(1 - var(--depth) * 0.04));
		pointer-events: none;
	}

	.polaroid[data-state='hidden'] {
		opacity: 0;
	}

	.polaroid[data-state='tossed'] {
		z-index: 102;
		opacity: 0;
		pointer-events: none;
		transform: translateX(calc(var(--toss-dir) * 130%)) rotate(calc(var(--toss-dir) * 28deg));
	}

	.polaroid[data-dragging='true'] {
		transition: none;
	}

	.polaroid-body {
		position: absolute;
		inset: 0;
		inline-size: 100%;
		block-size: 100%;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		text-align: start;
		cursor: grab;
		/* Vertical scrolling stays native; horizontal gestures belong to the pile, not the page pager. */
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
		-webkit-tap-highlight-color: transparent;
		transform-style: preserve-3d;
		transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.25, 1);
	}

	.polaroid-body:active {
		cursor: grabbing;
	}

	.polaroid-body:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 6px;
	}

	.polaroid-body[data-side='back'] {
		transform: rotateY(180deg);
	}

	/* Faces are rendered by the Stack primitive inside the button, so reach them with :global. */
	.polaroid-body :global(.polaroid-face) {
		position: absolute;
		inset: 0;
		padding-block: var(--space-xs) var(--space-2xs);
		padding-inline: var(--space-xs);
		background-color: var(--paper);
		color: var(--ink);
		border-radius: var(--radius-sm);
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.35),
			0 0.75rem 1.75rem rgba(0, 0, 0, 0.45);
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}

	.polaroid-body :global(.polaroid-front)::before {
		content: '';
		position: absolute;
		inset-block-start: calc(var(--space-xs) * -0.6);
		inset-inline-start: 50%;
		inline-size: 22%;
		block-size: var(--space-s);
		background-color: var(--accent);
		opacity: 0.55;
		transform: translateX(-50%) rotate(-3deg);
		z-index: 1;
	}

	.polaroid-body :global(.polaroid-back) {
		transform: rotateY(180deg);
		justify-content: center;
		padding-inline: var(--space-s);
		background-image: repeating-linear-gradient(
			to bottom,
			transparent 0,
			transparent calc(var(--space-m) - 1px),
			rgba(9, 7, 16, 0.08) calc(var(--space-m) - 1px),
			rgba(9, 7, 16, 0.08) var(--space-m)
		);
	}

	.polaroid-body :global(.polaroid-photo) {
		background-color: var(--ink-surface);
	}

	.polaroid-strip {
		display: block;
		padding-block-start: var(--space-2xs);
		font-size: var(--text-meta);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink-muted);
	}

	.polaroid-hint {
		float: inline-end;
	}

	.polaroid-note {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--text-lead);
		line-height: var(--leading-snug);
		text-align: center;
		overflow-wrap: anywhere;
	}

	.pile-empty {
		position: absolute;
		inset-block-start: 45%;
		inset-inline: 0;
		text-align: center;
		font-size: var(--text-small);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink-muted);
	}

	.pile-counter {
		font-size: var(--text-small);
		letter-spacing: var(--tracking-wide);
		color: var(--ink-muted);
	}

	.pile-btn {
		min-block-size: var(--control-size);
		padding-inline: var(--space-s);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-full);
		background-color: var(--glass-surface);
		color: var(--paper);
		font: inherit;
		font-size: var(--text-ui);
		font-weight: var(--weight-semibold);
		cursor: pointer;
	}

	.pile-btn:hover:not(:disabled) {
		border-color: var(--glass-border-hover);
	}

	.pile-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.pile-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.pile-btn-primary {
		border-color: var(--accent);
		color: var(--accent);
	}

	@media (prefers-reduced-motion: reduce) {
		.polaroid,
		.polaroid-body {
			transition: none;
		}
	}
</style>
