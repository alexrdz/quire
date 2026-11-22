<script lang="ts">
	import type { Snippet } from 'svelte';
	import { zineTilt, MAX_TEXT_TILT } from './reader';

	interface Props {
		/** Its place on the page; picks a deterministic resting tilt. */
		position: number;
		/** dark: a scrap of dark paper. light: a typed paper slip with dark ink. */
		tone?: 'dark' | 'light';
		/** Degrees. Text scraps stay at the ADR 0009 limit of about 2. */
		maxTilt?: number;
		as?: string;
		class?: string;
		children: Snippet;
	}

	let { position, tone = 'dark', maxTilt = MAX_TEXT_TILT, as = 'div', class: className = '', children }: Props =
		$props();

	const tilt = $derived(zineTilt(position, maxTilt));
</script>

<svelte:element this={as} class="scrap scrap-{tone} {className}" style="--scrap-tilt: {tilt}deg;">
	{@render children()}
</svelte:element>

<style>
	.scrap {
		position: relative;
		padding-block: var(--space-s);
		padding-inline: var(--space-s);
		border-radius: 2px 3px 2px 4px;
		transform: rotate(var(--scrap-tilt, 0deg));
		transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.scrap-dark {
		background-color: var(--zine-scrap-dark);
		background-image:
			var(--zine-grain),
			radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.05), transparent 75%),
			linear-gradient(to bottom, rgba(255, 255, 255, 0.03), transparent 50%);
		background-size: 160px 160px, auto, auto;
		color: var(--paper);
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.35),
			0 8px 24px -4px rgba(0, 0, 0, 0.65),
			0 18px 36px -10px rgba(0, 0, 0, 0.5),
			inset 0 1px 0 rgba(255, 255, 255, 0.08);
	}

	.scrap-light {
		background-color: var(--zine-scrap-light);
		background-image:
			var(--zine-mottle),
			radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.45), transparent 70%),
			linear-gradient(to bottom, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.04) 100%);
		background-size: 420px 420px, auto, auto;
		color: var(--zine-scrap-light-ink);
		border: 1px solid rgba(28, 24, 36, 0.12);
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.2),
			0 6px 18px -4px rgba(0, 0, 0, 0.35),
			0 16px 30px -8px rgba(0, 0, 0, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.6);
	}
</style>
