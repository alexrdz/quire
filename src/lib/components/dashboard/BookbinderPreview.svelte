<script lang="ts" module>
	/** The phone the preview shows the reader in, in CSS px (ADR 0011). */
	export const PREVIEW_PHONE = { width: 390, height: 844 } as const;

	/**
	 * How much to scale the phone to fit `available` (never up, never below a sliver).
	 * The phone keeps its aspect ratio: the tighter of width and height wins.
	 */
	export function previewScale(availableWidth: number, availableHeight: number): number {
		if (!(availableWidth > 0) || !(availableHeight > 0)) return 1;
		const scale = Math.min(1, availableWidth / PREVIEW_PHONE.width, availableHeight / PREVIEW_PHONE.height);
		return Math.max(0.25, Math.round(scale * 1000) / 1000);
	}

	/** A tap in the preview that would tip: any preset or custom-amount button, or a Venmo link. */
	export const TIP_ACTION_SELECTOR = '[data-amount-cents], a[href*="venmo.com"]';
</script>

<script lang="ts">
	/**
	 * The Bookbinder's preview (ADR 0011): the same Stories reader Fans see, at
	 * /i/<slug>, in a 390 by 844 phone scaled down to fit the pane. The reader runs in
	 * its own frame, so its viewport, URL hash and keys never touch the editor.
	 *
	 * It is read-only. Before any reader handler runs, it cancels every tip action (so
	 * nothing opens Venmo and no Tip Tap is counted) and every form (the Wall, Save,
	 * Stamp, sign-in), and says so.
	 */
	interface Props {
		slug: string;
		/** Bump to reload the preview after a save. */
		refresh?: number;
		/** The page to show after the next reload: `page-cover`, `page-content-2`, ... */
		jumpTo?: string | null;
	}

	let { slug, refresh = 0, jumpTo = null }: Props = $props();

	let iframe = $state<HTMLIFrameElement | null>(null);
	let areaWidth = $state(0);
	let areaHeight = $state(0);
	let notice = $state('');
	let pendingHash: string | null = null;

	const scale = $derived(previewScale(areaWidth, areaHeight));

	/**
	 * The element an event in the frame came from. Not `instanceof Element`: the frame's
	 * nodes come from its own window, whose Element is not this page's, so that test is
	 * always false across frames. The node type is the same everywhere.
	 */
	function elementOf(target: EventTarget | null): Element | null {
		const node = target as Node | null;
		if (!node || typeof node.nodeType !== 'number') return null;
		return node.nodeType === 1 ? (node as Element) : node.parentElement;
	}

	function guardClick(event: MouseEvent) {
		if (!elementOf(event.target)?.closest(TIP_ACTION_SELECTOR)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		notice = "This is a preview, so tips are off: nothing opens Venmo and no tip is counted.";
	}

	function guardSubmit(event: Event) {
		event.preventDefault();
		event.stopImmediatePropagation();
		notice = 'This is a preview, so the Wall, Save and Stamp are off here.';
	}

	// Each time the reader loads (and reloads after a save): guard it, then show the page asked for.
	$effect(() => {
		const frame = iframe;
		if (!frame) return;
		const onLoad = () => {
			const win = frame.contentWindow;
			if (!win) return;
			win.addEventListener('click', guardClick, true);
			win.addEventListener('submit', guardSubmit, true);
			if (pendingHash) {
				win.location.hash = pendingHash;
				pendingHash = null;
			}
		};
		frame.addEventListener('load', onLoad);
		// Already loaded before this ran (a fast, cached load).
		if (frame.contentDocument?.readyState === 'complete' && frame.contentWindow?.location.pathname.startsWith('/i/')) {
			onLoad();
		}
		return () => frame.removeEventListener('load', onLoad);
	});

	// After a save: reload to show the change, at the page that changed. The first run is
	// the initial value, not a save, so it does nothing.
	let started = false;
	$effect(() => {
		void refresh;
		if (!started) {
			started = true;
			return;
		}
		pendingHash = jumpTo ? `#${jumpTo}` : null;
		notice = '';
		iframe?.contentWindow?.location.reload();
	});
</script>

<div class="bookbinder-preview">
	<p class="bookbinder-preview-label">
		<span class="bookbinder-preview-chip">Preview</span>
		Tips and the Wall are off here.
	</p>

	<div class="bookbinder-preview-area" bind:clientWidth={areaWidth} bind:clientHeight={areaHeight}>
		<div
			class="bookbinder-preview-phone"
			style="--preview-scale: {scale}; --preview-w: {PREVIEW_PHONE.width}px; --preview-h: {PREVIEW_PHONE.height}px;"
			data-testid="bookbinder-preview-phone"
		>
			<iframe bind:this={iframe} src="/i/{slug}" title="Live Issue Mobile Preview"></iframe>
		</div>
	</div>

	<p class="bookbinder-preview-notice" role="status" aria-live="polite">{notice}</p>
</div>

<style>
	.bookbinder-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
		inline-size: 100%;
		block-size: 100%;
		min-block-size: 0;
	}

	.bookbinder-preview-label {
		display: flex;
		align-items: center;
		gap: var(--space-2xs);
		margin: 0;
		font-size: var(--text-small);
		color: var(--ink-muted);
	}

	.bookbinder-preview-chip {
		padding-block: var(--space-3xs);
		padding-inline: var(--space-2xs);
		border-radius: 999px;
		background-color: var(--accent);
		color: var(--ink);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
	}

	/* The room the phone may take; it is scaled to fit, keeping its shape. */
	.bookbinder-preview-area {
		flex: 1;
		min-block-size: 0;
		inline-size: 100%;
		display: flex;
		align-items: flex-start;
		justify-content: center;
	}

	/* The phone's box at its scaled size, so the layout around it is right. */
	.bookbinder-preview-phone {
		position: relative;
		flex-shrink: 0;
		inline-size: calc(var(--preview-w) * var(--preview-scale));
		block-size: calc(var(--preview-h) * var(--preview-scale));
		border-radius: calc(var(--space-l) * var(--preview-scale));
		overflow: hidden;
		background-color: #000000;
		box-shadow:
			0 0 0 1px rgba(255, 255, 255, 0.14),
			0 24px 64px rgba(0, 0, 0, 0.8);
	}

	/* The reader at its real phone size, scaled down as one picture. */
	.bookbinder-preview-phone iframe {
		position: absolute;
		inset-block-start: 0;
		inset-inline-start: 0;
		inline-size: var(--preview-w);
		block-size: var(--preview-h);
		border: 0;
		transform: scale(var(--preview-scale));
		transform-origin: top left;
	}

	.bookbinder-preview-notice {
		min-block-size: 1lh;
		margin: 0;
		max-inline-size: 26rem;
		font-size: var(--text-small);
		text-align: center;
		color: var(--paper);
	}
</style>
