<script lang="ts">
	import BottomSheet from './BottomSheet.svelte';
	import { getStoryNav } from './context';

	/**
	 * The Wall sheet (ADR 0011). R-T04 fills it with the notes and the composer;
	 * for now it says how many notes there are and opens the Wall page.
	 */
	interface Props {
		open: boolean;
		onclose: () => void;
		noteCount: number;
	}

	let { open, onclose, noteCount }: Props = $props();
	const nav = getStoryNav();

	function goToWall() {
		onclose();
		nav.goToPage('page-wall');
	}
</script>

<BottomSheet {open} {onclose} label="The Wall" title="The Wall" class="wall-sheet">
	<div class="wall-sheet-body">
		<p class="wall-sheet-count">
			{noteCount === 0 ? 'No notes yet.' : noteCount === 1 ? '1 note from tonight.' : `${noteCount} notes from tonight.`}
		</p>
		<button type="button" class="wall-sheet-open" onclick={goToWall}>Open the Wall</button>
	</div>
</BottomSheet>

<style>
	.wall-sheet-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-s);
		padding-block: var(--space-xs) var(--space-s);
	}

	.wall-sheet-count {
		margin: 0;
		font-size: var(--text-body);
		color: #c4c0cc;
	}

	.wall-sheet-open {
		min-block-size: var(--control-size);
		border: 0;
		border-radius: 12px;
		background: var(--accent);
		color: var(--bg-void);
		font-family: inherit;
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		cursor: pointer;
	}

	.wall-sheet-open:focus-visible {
		outline: 2px solid #ffffff;
		outline-offset: 2px;
	}
</style>
