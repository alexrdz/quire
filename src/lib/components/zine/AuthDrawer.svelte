<script lang="ts">
	import { enhance } from '$app/forms';
	import { Stack, Cluster } from '$lib/components/layout';
	import FeatureNotice from '$lib/components/site/FeatureNotice.svelte';
	import type { ComponentProps } from 'svelte';
	import type { AuthAction } from './reader';

	interface Props {
		/** What the Fan was doing when asked to sign in; it picks the copy and where sign-in returns to. */
		pendingAction: AuthAction;
		fanSignIn: boolean;
		mode: ComponentProps<typeof FeatureNotice>['mode'];
		fanSignInError?: string;
		onClose: () => void;
	}

	let { pendingAction, fanSignIn, mode, fanSignInError, onClose }: Props = $props();
</script>

<!-- BOTTOM-SHEET AUTH DRAWER (from ui-prototype/index.html) -->
<div class="drawer-backdrop">
	<Stack gap="md" class="glass-drawer bottom-sheet-modal" role="dialog" aria-modal="true" aria-label="Fan Authentication">
		<div class="drawer-handle"></div>
		<Cluster justify="between" align="center">
			<Stack gap="3xs">
				<span class="text-highlight font-mono eyebrow-small">FAN IDENTITY</span>
				<h3 class="drawer-title">Sign in with Google</h3>
			</Stack>
			<button type="button" class="btn-drawer-close" onclick={onClose}>
				✕ Close
			</button>
		</Cluster>

		<p class="text-muted drawer-subtext">
			{#if pendingAction === 'note'}
				Your Wall note draft is saved and will post automatically as soon as you sign in.
			{:else if pendingAction === 'stamp'}
				Sign in to permanently bind this gig’s attendance stub to your collection.
			{:else}
				Identity is only required to sign a Wall or save to My Stubs.
			{/if}
		</p>

		{#if fanSignInError}
			<p class="feature-notice" role="alert">{fanSignInError}</p>
		{/if}
		{#if fanSignIn}
			<form method="POST" action="?/googleAuth" use:enhance>
				<input
					type="hidden"
					name="targetHash"
					value={pendingAction === 'stamp' || pendingAction === 'save' ? '#page-endpaper' : '#page-wall'}
				/>

				<button type="submit" class="google-sheet-btn">
					<span>Continue with Google</span>
				</button>
			</form>
		{:else}
			<FeatureNotice feature="fanSignIn" {mode} />
		{/if}
	</Stack>
</div>

<style>
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(4px);
		z-index: 100;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	:global(.bottom-sheet-modal) {
		inline-size: 100%;
		max-inline-size: 500px;
		padding-block: var(--space-m);
		padding-inline: var(--space-m);
		border-radius: 24px 24px 0 0;
	}

	.drawer-handle {
		inline-size: 2.5rem;
		block-size: 0.25rem;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		margin-inline: auto;
	}

	.eyebrow-small {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}

	.drawer-title {
		font-size: var(--text-lead);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.drawer-subtext {
		font-size: var(--text-body);
		line-height: var(--leading-body);
	}

	.google-sheet-btn {
		inline-size: 100%;
		block-size: 2.9rem;
		background: #ffffff;
		color: #090710;
		font-weight: var(--weight-bold);
		font-size: var(--text-ui);
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.btn-drawer-close {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-compact);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.05);
		color: #e4e4e7;
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-drawer-close:hover {
		background: rgba(255, 255, 255, 0.1);
	}
</style>
