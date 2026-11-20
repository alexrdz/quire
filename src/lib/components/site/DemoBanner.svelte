<script lang="ts">
	import { Box, Cluster } from '$lib/components/layout';
	import type { Mode } from '$lib/features';
	import { DEMO_BANNER_LEAD, DEMO_BANNER_TEXT, DEMO_BANNER_COMPACT, DEMO_SIGNUP_LABEL } from './demo-banner';

	/**
	 * "You're in the Demo" notice (CONTEXT decision 29, PRODUCTION_PLAN 4.2).
	 *
	 * Renders only when the mode is 'demo'; in production, development and test
	 * it renders nothing. The mode comes from the public features in page data,
	 * never from an env read here. It sits in the page flow, never overlaid, so it
	 * cannot cover tip buttons or the Cover CTA. `compact` is the one-line variant
	 * for the Full-Screen Case Display.
	 */
	interface Props {
		mode: Mode | undefined;
		compact?: boolean;
		/** The real site's sign-up URL. Omitted until the production URL is known. */
		signupUrl?: string | null;
	}

	let { mode, compact = false, signupUrl = null }: Props = $props();
</script>

{#if mode === 'demo'}
	<Box
		as="aside"
		padding={compact ? '3xs' : '2xs'}
		class="demo-banner {compact ? 'demo-banner--compact' : ''}"
		aria-label="Demo notice"
		data-testid="demo-banner"
	>
		<Cluster gap="2xs" justify="center" align="center" class="demo-banner-inner">
			{#if compact}
				<p class="demo-banner-text"><strong class="demo-banner-lead">{DEMO_BANNER_COMPACT}</strong></p>
			{:else}
				<p class="demo-banner-text">
					<strong class="demo-banner-lead">{DEMO_BANNER_LEAD}</strong>
					{DEMO_BANNER_TEXT}
				</p>
				{#if signupUrl}
					<a class="demo-banner-link" href={signupUrl}>{DEMO_SIGNUP_LABEL}</a>
				{/if}
			{/if}
		</Cluster>
	</Box>
{/if}
