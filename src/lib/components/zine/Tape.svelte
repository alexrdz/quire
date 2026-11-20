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
		position: absolute;
		z-index: 2;
		inline-size: 4.75rem;
		block-size: 1.35rem;
		background-color: var(--zine-tape);
		background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.18), transparent 60%);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
		/* Torn ends. */
		clip-path: polygon(
			0% 8%, 4% 0%, 8% 10%, 12% 2%, 88% 3%, 92% 11%, 96% 1%, 100% 9%,
			100% 92%, 96% 100%, 92% 89%, 88% 98%, 12% 97%, 8% 88%, 4% 100%, 0% 90%
		);
		pointer-events: none;
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
