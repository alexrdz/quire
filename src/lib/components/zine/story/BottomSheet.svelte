<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';

	/**
	 * A bottom sheet (ADR 0011), like Instagram's comments: a grab handle and
	 * rounded top corners. Swipe the handle down, tap outside or press Escape to
	 * close. It is a modal <dialog>, so the page behind is inert and focus stays
	 * in the sheet while it is open; closing returns focus to what opened it.
	 */
	interface Props {
		open: boolean;
		/** The sheet's accessible name. */
		label: string;
		/** A visible heading; leave it out when the content brings its own. */
		title?: string;
		/** Extra class on the sheet, for its content's styles. */
		class?: string;
		onclose: () => void;
		children: Snippet;
	}

	let { open, label, title, class: className = '', onclose, children }: Props = $props();

	/** A drag of the handle this far down, in px, closes the sheet. */
	const CLOSE_DRAG_PX = 80;

	let dialog: HTMLDialogElement | undefined = $state();
	let opener: HTMLElement | null = null;
	let dragY = $state(0);
	let dragStart: number | null = null;

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	/** The dialog closed (Escape, a form, or `open` going false): hand focus back. */
	async function handleClosed() {
		dragY = 0;
		if (open) onclose();
		await tick();
		opener?.focus({ preventScroll: true });
		opener = null;
	}

	function handleCancel(event: Event) {
		// Escape: close through the owner, so `open` and the dialog agree.
		event.preventDefault();
		onclose();
	}

	function handleClick(event: MouseEvent) {
		// The dialog fills the screen; only the sheet is inside it. A click on the dialog itself is outside the sheet.
		if (event.target === dialog) onclose();
	}

	function dragDown(event: PointerEvent) {
		if (event.button !== 0) return;
		dragStart = event.clientY;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function dragMove(event: PointerEvent) {
		if (dragStart === null) return;
		dragY = Math.max(0, event.clientY - dragStart);
	}

	function dragEnd() {
		if (dragStart === null) return;
		dragStart = null;
		if (dragY >= CLOSE_DRAG_PX) onclose();
		else dragY = 0;
	}
</script>

<dialog
	bind:this={dialog}
	class="bottom-sheet"
	aria-label={title ? undefined : label}
	aria-labelledby={title ? 'sheet-title-' + label.replace(/\W+/g, '-').toLowerCase() : undefined}
	oncancel={handleCancel}
	onclose={handleClosed}
	onclick={handleClick}
>
	<div class="sheet {className}" class:is-dragging={dragY > 0} style="--sheet-drag: {dragY}px;">
		<div
			class="sheet-grab"
			role="presentation"
			onpointerdown={dragDown}
			onpointermove={dragMove}
			onpointerup={dragEnd}
			onpointercancel={dragEnd}
		>
			<span class="sheet-handle" aria-hidden="true"></span>
			<div class="sheet-top" class:is-bare={!title}>
				{#if title}
					<h2 class="sheet-title" id={'sheet-title-' + label.replace(/\W+/g, '-').toLowerCase()}>{title}</h2>
				{/if}
				<button type="button" class="sheet-close" aria-label="Close" onclick={onclose}>
					<svg viewBox="0 0 24 24" aria-hidden="true" class="sheet-close-icon">
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				</button>
			</div>
		</div>
		<div class="sheet-body">
			{#if open}
				{@render children()}
			{/if}
		</div>
	</div>
</dialog>

<style>
	.bottom-sheet {
		/* The dialog is the whole screen; the sheet sits at its bottom. */
		position: fixed;
		inset: 0;
		inline-size: 100%;
		max-inline-size: 100%;
		block-size: 100%;
		max-block-size: 100%;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: #ffffff;
		font-family: var(--story-font, system-ui, sans-serif);
	}

	.bottom-sheet[open] {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
	}

	.bottom-sheet::backdrop {
		background: rgba(0, 0, 0, 0.6);
	}

	.sheet {
		inline-size: 100%;
		max-inline-size: 480px;
		max-block-size: 85dvh;
		display: flex;
		flex-direction: column;
		background: #16131d;
		border-start-start-radius: 20px;
		border-start-end-radius: 20px;
		padding-block-end: max(var(--space-s), env(safe-area-inset-bottom));
		transform: translateY(var(--sheet-drag, 0));
		transition: transform 200ms ease;
	}

	.sheet.is-dragging {
		transition: none;
	}

	@media (prefers-reduced-motion: no-preference) {
		.bottom-sheet[open] .sheet {
			animation: sheet-in 200ms ease-out;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sheet {
			transition: none;
		}
	}

	@keyframes sheet-in {
		from {
			transform: translateY(100%);
		}
	}

	.sheet-grab {
		touch-action: none;
		cursor: grab;
		padding-block-start: var(--space-2xs);
		padding-inline: var(--space-s);
	}

	.sheet-handle {
		display: block;
		inline-size: 2.5rem;
		block-size: 0.3125rem;
		margin-inline: auto;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.35);
	}

	.sheet-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-xs);
		min-block-size: var(--control-size);
	}

	/* Without a title the close button floats beside the content's own heading, instead of taking a row. */
	.sheet {
		position: relative;
	}

	.sheet-top.is-bare {
		position: absolute;
		z-index: 1;
		inset-block-start: var(--space-s);
		inset-inline-end: var(--space-s);
	}

	.sheet-title {
		margin: 0;
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}

	.sheet-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: var(--control-size);
		block-size: var(--control-size);
		margin-inline-start: auto;
		border: 0;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
		cursor: pointer;
	}

	.sheet-close:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.sheet-close-icon {
		inline-size: 1.25rem;
		block-size: 1.25rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}

	.sheet-body {
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-inline: var(--space-s);
	}
</style>
