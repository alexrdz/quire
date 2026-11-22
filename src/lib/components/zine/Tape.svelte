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
		inline-size: 4.5rem;
		block-size: 1.25rem;
		background-color: rgba(240, 235, 215, 0.48);
		background-image:
			linear-gradient(to bottom, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.05) 50%, rgba(0, 0, 0, 0.08)),
			repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0, 0, 0, 0.03) 3px, rgba(0, 0, 0, 0.03) 6px);
		border-radius: 2px;
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.35),
			inset 0 0 0 1px rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(1.5px);
		-webkit-backdrop-filter: blur(1.5px);
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
