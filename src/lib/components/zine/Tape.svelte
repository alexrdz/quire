<script lang="ts">
	import { zineTilt } from './reader';

	interface Props {
		/** Where the strip holds its parent down; the parent must be positioned. */
		placement?: 'top' | 'top-left' | 'top-right';
		/** Picks the strip's deterministic angle. */
		position?: number;
	}

	let { placement = 'top', position = 0 }: Props = $props();

	/** Tape lies at a visible angle; it is decoration, not text, so it may tilt further. */
	const angle = $derived(zineTilt(position + 7, 8) + (placement === 'top-left' ? -32 : placement === 'top-right' ? 32 : 0));
</script>

<span class="tape tape-{placement}" style="--tape-tilt: {angle}deg;" aria-hidden="true"></span>

<style>
	.tape {
		display: none;
		position: absolute;
		z-index: 2;
		inline-size: 0;
		block-size: 0;
		pointer-events: none;
		visibility: hidden;
		opacity: 0;
	}

	.tape-top {
		inset-block-start: -0.65rem;
		inset-inline-start: 50%;
		transform: translateX(-50%) rotate(var(--tape-tilt));
	}

	.tape-top-left {
		inset-block-start: -0.35rem;
		inset-inline-start: -1.1rem;
		transform: rotate(var(--tape-tilt));
	}

	.tape-top-right {
		inset-block-start: -0.35rem;
		inset-inline-end: -1.1rem;
		transform: rotate(var(--tape-tilt));
	}
</style>
