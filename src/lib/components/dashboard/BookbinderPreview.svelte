<script lang="ts" module>
	/** The phone the preview shows the reader in, in CSS px (ADR 0011). */
	export const PREVIEW_PHONE = { width: 390, height: 844 } as const;

	/**
	 * How much to scale the phone to fit `available` (never up, never below a sliver).
	 * The phone keeps its aspect ratio: the tighter of width and height wins. The
	 * scale is rounded down to a thousandth, never to the nearest: rounding up made
	 * the scaled phone a fraction of a pixel wider than its room, which widened the
	 * Bookbinder's one-column layout and scrolled the page sideways at 390 px (B1-T36).
	 */
	export function previewScale(availableWidth: number, availableHeight: number): number {
		if (!(availableWidth > 0) || !(availableHeight > 0)) return 1;
		const scale = Math.min(1, availableWidth / PREVIEW_PHONE.width, availableHeight / PREVIEW_PHONE.height);
		return Math.max(0.25, Math.floor(scale * 1000) / 1000);
	}

	/**
	 * Everything in the reader that would tip, as one list: the preview cancels these
	 * before the reader sees them (no Venmo, no Tip Tap).
	 *
	 * Contract for reader changes: every tip action (each preset, the custom amount, a
	 * Cover pill, and any new tip control) must carry `data-amount-cents`. Venmo links are
	 * caught by their href as well. bookbinder-preview.spec.ts fails if a tip control
	 * appears in the reader without one of these.
	 */
	export const TIP_ACTION_SELECTORS = ['[data-amount-cents]', 'a[href*="venmo.com"]'] as const;
	export const TIP_ACTION_SELECTOR = TIP_ACTION_SELECTORS.join(', ');

	/** Whether a URL goes to Venmo (window.open from inside the preview is refused for these). */
	export function isVenmoUrl(url: string | URL | undefined | null): boolean {
		if (!url) return false;
		try {
			const host = new URL(String(url), 'https://quire.invalid').hostname.toLowerCase();
			return host === 'venmo.com' || host.endsWith('.venmo.com');
		} catch {
			return false;
		}
	}
</script>

<script lang="ts">
	import { page } from '$app/state';

	/**
	 * The Bookbinder's preview (ADR 0011): the same Stories reader Fans see, in a 390 by
	 * 844 phone scaled down to fit the pane. In the Bookbinder it frames the Artist's own
	 * preview route (/dashboard/bookbinder/<id>/preview, B1-T33), which shows drafts too
	 * and refuses every write on the server; anywhere else, the public /i/<slug>. The reader runs in
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
	const src = $derived(page.params.id ? `/dashboard/bookbinder/${page.params.id}/preview` : `/i/${slug}`);

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
		// Enter and Space on a focused tip button arrive here too: they fire click.
		event.preventDefault();
		event.stopImmediatePropagation();
		notice = TIPS_OFF;
	}

	const TIPS_OFF = "This is a preview, so tips are off: nothing opens Venmo and no tip is counted.";

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
			// Nothing in the preview may open Venmo in a new window either.
			const open = win.open.bind(win);
			win.open = ((url?: string | URL, ...rest: unknown[]) => {
				if (isVenmoUrl(url)) {
					notice = TIPS_OFF;
					return null;
				}
				return open(url, ...(rest as [string?, string?]));
			}) as typeof win.open;
			if (pendingHash) {
				win.location.hash = pendingHash;
				pendingHash = null;
			}
		};
		frame.addEventListener('load', onLoad);
		// Already loaded before this ran (a fast, cached load).
		if (frame.contentDocument?.readyState === 'complete' && frame.contentWindow?.location.pathname !== 'blank') {
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
			<iframe bind:this={iframe} {src} title="Live Issue Mobile Preview"></iframe>
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

	/* The chip keeps its one word on one line; the note beside it wraps instead. */
	.bookbinder-preview-chip {
		flex: none;
		white-space: nowrap;
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
