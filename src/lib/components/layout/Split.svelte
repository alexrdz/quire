<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: string;
		ratio?: '1-4' | '1-3' | '1-2' | '1-1' | '2-1' | '2-3' | '3-4';
		gap?: 'none' | 'sm' | 'md' | 'lg';
		collapse?: 'sm' | 'md' | 'lg';
		align?: 'start' | 'center' | 'end' | 'stretch';
		class?: string;
		children?: Snippet;
		[key: string]: any;
	}

	let {
		as = 'div',
		ratio = '1-2',
		gap = 'md',
		collapse = 'md',
		align,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const dataAttributes = $derived(
		[
			ratio && `ratio:${ratio}`,
			gap && `gap:${gap}`,
			collapse && `collapse:${collapse}`,
			align && `align:${align}`
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<svelte:element
	this={as}
	data-split={dataAttributes || ''}
	class={className || undefined}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
