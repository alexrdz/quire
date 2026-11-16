<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: string;
		padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		variant?: 'raised' | 'subtle' | 'muted' | 'invert';
		border?: 'none';
		radius?: 'none' | 'sm' | 'md' | 'lg';
		class?: string;
		children?: Snippet;
		[key: string]: any;
	}

	let {
		as = 'div',
		padding = 'md',
		variant,
		border,
		radius,
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const dataAttributes = $derived(
		[
			padding && `padding:${padding}`,
			variant && (variant === 'invert' ? 'invert' : `variant:${variant}`),
			border && `border:${border}`,
			radius && `radius:${radius}`
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<svelte:element
	this={as}
	data-box={dataAttributes || ''}
	class={className || undefined}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
