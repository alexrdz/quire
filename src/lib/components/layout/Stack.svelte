<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: string;
		gap?: 'none' | '4xs' | '3xs' | 'compact' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
		align?: 'start' | 'center' | 'end' | 'stretch';
		onlyChild?: boolean;
		class?: string;
		children?: Snippet;
		[key: string]: any;
	}

	let {
		as = 'div',
		gap = 'md',
		align,
		onlyChild,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const dataAttributes = $derived(
		[
			gap && `gap:${gap}`,
			align && `align:${align}`,
			onlyChild && 'only-child'
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<svelte:element
	this={as}
	data-stack={dataAttributes || ''}
	class={className || undefined}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
