<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: string;
		min?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		class?: string;
		children?: Snippet;
		[key: string]: any;
	}

	let {
		as = 'div',
		min = 'md',
		gap = 'md',
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const dataAttributes = $derived(
		[
			min && `min:${min}`,
			gap && `gap:${gap}`
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<svelte:element
	this={as}
	data-grid={dataAttributes || ''}
	class={className || undefined}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
