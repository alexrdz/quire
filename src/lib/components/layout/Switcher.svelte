<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: string;
		collapse?: 'sm' | 'md' | 'lg';
		limit?: 2 | 3 | 4 | 5;
		gap?: 'xs' | 'sm' | 'md' | 'lg';
		align?: 'start' | 'center' | 'end';
		class?: string;
		children?: Snippet;
		[key: string]: any;
	}

	let {
		as = 'div',
		collapse = 'md',
		limit,
		gap = 'md',
		align,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const dataAttributes = $derived(
		[
			collapse && `collapse:${collapse}`,
			limit && `limit:${limit}`,
			gap && `gap:${gap}`,
			align && `align:${align}`
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<svelte:element
	this={as}
	data-switcher={dataAttributes || ''}
	class={className || undefined}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
