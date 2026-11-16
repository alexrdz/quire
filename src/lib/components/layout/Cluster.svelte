<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: string;
		gap?: 'none' | '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
		align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
		nowrap?: boolean;
		distributeEqually?: boolean;
		class?: string;
		children?: Snippet;
		[key: string]: any;
	}

	let {
		as = 'div',
		gap = 'sm',
		justify,
		align,
		nowrap,
		distributeEqually,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const dataAttributes = $derived(
		[
			gap && `gap:${gap}`,
			justify && `justify:${justify}`,
			align && `align:${align}`,
			nowrap && 'nowrap',
			distributeEqually && 'distribute:equally'
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<svelte:element
	this={as}
	data-cluster={dataAttributes || ''}
	class={className || undefined}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
