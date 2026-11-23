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
	<VenmoTipPanel {artistSlug} {artistName} {venmoUsername} {issueSlug} {presets} {opensVenmo} />
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

	/* Amounts are pills; the pay button is the --support colour. */
	:global(.tip-sheet .venmo-tip-preset) {
		min-block-size: var(--control-size);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.16);
	}

	:global(.tip-sheet .venmo-tip-preset:hover),
	:global(.tip-sheet .venmo-tip-preset:focus-visible) {
		background: var(--support);
		border-color: var(--support);
	}

	:global(.tip-sheet .venmo-tip-go) {
		min-block-size: var(--control-size);
		border-radius: 999px;
	}

	:global(.tip-sheet .venmo-tip-input) {
		min-block-size: var(--control-size);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.2);
	}
</style>
