<script lang="ts">
	import { featureUnavailableMessage, type FeatureName, type Mode } from '$lib/features';

	interface Props {
		feature: FeatureName;
		mode?: Mode;
		/** Extra sentence after the standard message, e.g. what still works. */
		detail?: string;
		class?: string;
	}

	let { feature, mode, detail, class: className = '' }: Props = $props();
</script>

<p class={['feature-notice', className]} role="status" data-feature={feature}>
	<svg class="feature-notice-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
		<circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
		<path d="M8 4.5v4.25M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
	</svg>
	<span>
		{featureUnavailableMessage(feature, mode)}
		{#if detail}{' '}{detail}{/if}
	</span>
</p>
