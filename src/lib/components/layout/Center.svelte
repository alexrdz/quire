<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: string;
		max?: 'xs' | 'sm' | 'md' | 'lg' | 'measure';
		padding?: 'none' | 'sm' | 'md' | 'lg';
		intrinsic?: boolean;
		centerText?: boolean;
		centerVertically?: boolean;
		class?: string;
		children?: Snippet;
		[key: string]: any;
	}

	let {
		as = 'div',
		max = 'measure',
		padding,
		intrinsic,
		centerText,
		centerVertically,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const dataAttributes = $derived(
		[
			max && `max:${max}`,
			padding && `padding:${padding}`,
			intrinsic && 'intrinsic',
			centerText && 'center:text',
			centerVertically && 'center:vertically'
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<svelte:element
	this={as}
	data-center={dataAttributes || ''}
	class={className || undefined}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
