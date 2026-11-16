<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: string;
		gap?: 'xs' | 'sm' | 'md' | 'lg';
		items?: 2 | 3 | 4 | 5;
		snap?: 'start' | 'center' | 'end';
		class?: string;
		children?: Snippet;
		[key: string]: any;
	}

	let {
		as = 'div',
		gap = 'sm',
		items,
		snap,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const dataAttributes = $derived(
		[
			gap && `gap:${gap}`,
			items && `items:${items}`,
			snap && `snap:${snap}`
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<svelte:element
	this={as}
	data-reel={dataAttributes || ''}
	class={className || undefined}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
