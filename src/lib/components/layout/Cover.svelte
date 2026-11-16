<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: string;
		padding?: 'none' | 'sm' | 'md' | 'lg';
		height?: 25 | 50 | 75 | 100;
		class?: string;
		children?: Snippet;
		[key: string]: any;
	}

	let {
		as = 'div',
		padding = 'sm',
		height = 100,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const dataAttributes = $derived(
		[
			padding && `padding:${padding}`,
			height && `height:${height}`
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<svelte:element
	this={as}
	data-cover={dataAttributes || ''}
	class={className || undefined}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
