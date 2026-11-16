<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		as?: string;
		ratio?: '1' | '1-1' | 'square' | '16-9' | '16/9' | 'video' | '4-3' | '4/3' | '3-2' | '21-9' | '21/9' | '';
		class?: string;
		children?: Snippet;
		[key: string]: any;
	}

	let {
		as = 'div',
		ratio = '16/9',
		class: className = '',
		children,
		...restProps
	}: Props = $props();

	const dataAttributes = $derived(
		ratio ? `ratio:${ratio}` : ''
	);
</script>

<svelte:element
	this={as}
	data-frame={dataAttributes}
	class={className || undefined}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
