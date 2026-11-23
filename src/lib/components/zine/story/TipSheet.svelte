<script lang="ts">
	import VenmoTipPanel from '$lib/components/tips/VenmoTipPanel.svelte';
	import BottomSheet from './BottomSheet.svelte';

	/**
	 * The tip sheet (ADR 0011) over the Venmo tip panel. The panel's logic is
	 * unchanged (ADR 0008): real venmo.com links in production, the Demo message
	 * elsewhere, and every tap reported to /api/tip-tap.
	 */
	interface Props {
		open: boolean;
		onclose: () => void;
		artistSlug: string;
		artistName: string;
		venmoUsername: string;
		issueSlug: string;
		presets: number[];
		opensVenmo: boolean;
	}

	let { open, onclose, artistSlug, artistName, venmoUsername, issueSlug, presets, opensVenmo }: Props = $props();
</script>

<BottomSheet {open} {onclose} label="Tip {artistName} with Venmo" class="tip-sheet">
	<VenmoTipPanel {artistSlug} {artistName} {venmoUsername} {issueSlug} {presets} {opensVenmo} compact />
</BottomSheet>

<style>
	/* The panel sits flat in the sheet: no card, no glass. */
	:global(.tip-sheet .venmo-tip-panel) {
		background: transparent;
		border: 0;
		padding: 0;
		padding-block-end: var(--space-xs);
	}

	:global(.tip-sheet .venmo-tip-title) {
		/* Clear of the sheet's floating close button. */
		padding-inline-end: calc(var(--control-size) + var(--space-2xs));
		font-size: var(--text-heading-sm);
		font-family: var(--story-heading-font, inherit);
	}

	:global(.tip-sheet .venmo-tip-hint),
	:global(.tip-sheet .venmo-tip-label) {
		color: #c4c0cc;
	}

	/* The same pills as the Cover: solid --support, bold dark text (about 5.7:1). */
	:global(.tip-sheet .venmo-tip-preset),
	:global(.tip-sheet .venmo-tip-go) {
		min-block-size: var(--control-size);
		border: 0;
		border-radius: 999px;
		background: var(--support);
		color: var(--bg-void);
		font-weight: var(--weight-heavy);
	}

	:global(.tip-sheet .venmo-tip-preset) {
		font-size: var(--text-body);
	}

	:global(.tip-sheet .venmo-tip-preset:hover),
	:global(.tip-sheet .venmo-tip-preset:focus-visible),
	:global(.tip-sheet .venmo-tip-go:hover),
	:global(.tip-sheet .venmo-tip-go:focus-visible) {
		filter: brightness(1.08);
		outline: 2px solid #ffffff;
		outline-offset: 2px;
	}

	/* No amount yet: not a faded pay button, but a quiet outline that says what it needs. */
	:global(.tip-sheet .venmo-tip-go[aria-disabled='true']) {
		opacity: 1;
		background: transparent;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
		color: #ffffff;
		font-weight: var(--weight-semibold);
		cursor: default;
	}

	/* A bad amount reads as an error: the field and the hint under it turn pink (about 8:1 on the sheet). */
	:global(.tip-sheet .venmo-tip-input[aria-invalid='true']) {
		border-color: var(--support);
		box-shadow: 0 0 0 1px var(--support);
	}

	:global(.tip-sheet .venmo-tip-input[aria-invalid='true'] ~ .venmo-tip-hint) {
		color: #ff8fb2;
	}

	:global(.tip-sheet .venmo-tip-input) {
		min-block-size: var(--control-size);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.2);
	}
</style>
