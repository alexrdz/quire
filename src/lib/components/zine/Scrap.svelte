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
		box-shadow:
			0 1px 1px rgba(0, 0, 0, 0.4),
			0 10px 22px -8px rgba(0, 0, 0, 0.7);
	}

	.scrap-dark {
		background-color: var(--zine-scrap-dark);
		background-image: var(--zine-grain);
		background-size: 160px 160px;
		color: var(--paper);
		border: 1px solid rgba(255, 255, 255, 0.07);
	}

	.scrap-light {
		background-color: var(--zine-scrap-light);
		background-image: var(--zine-mottle), linear-gradient(to bottom, rgba(0, 0, 0, 0.03), transparent 30%);
		background-size: 420px 420px, auto;
		color: var(--zine-scrap-light-ink);
	}
</style>
