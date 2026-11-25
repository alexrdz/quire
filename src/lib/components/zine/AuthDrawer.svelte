<script lang="ts">
	import { enhance } from '$app/forms';
	import FeatureNotice from '$lib/components/site/FeatureNotice.svelte';
	import BottomSheet from './story/BottomSheet.svelte';
	import type { ComponentProps } from 'svelte';
	import type { AuthAction } from './reader';

	/**
	 * Fan sign-in (ADR 0011): a bottom sheet like the reader's others, a modal
	 * dialog with the grab handle, Escape and tap outside, and focus kept inside.
	 * Google sign-in returns to the Wall or the Endpaper, whichever asked.
	 */
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

<BottomSheet open={true} onclose={onClose} label="Sign in" title="Sign in" class="auth-sheet">
	<div class="auth-body">
		<p class="auth-text">
			{#if pendingAction === 'note'}
				Your note is saved here. Sign in with Google, then post it from the Wall.
			{:else if pendingAction === 'stamp'}
				Sign in to keep this show's Stamp in your Stubs.
			{:else if pendingAction === 'save'}
				Sign in to save this Issue to your Stubs.
			{:else}
				Sign in to sign the Wall or save Issues to your Stubs.
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
				<button type="submit" class="auth-google">Continue with Google</button>
			</form>
		{:else}
			<FeatureNotice feature="fanSignIn" {mode} />
		{/if}
	</div>
</BottomSheet>

<style>
	.auth-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-s);
		padding-block: var(--space-2xs) var(--space-s);
	}

	.auth-text {
		margin: 0;
		font-size: var(--text-body);
		line-height: var(--leading-body);
		color: #c4c0cc;
	}

	.auth-google {
		inline-size: 100%;
		min-block-size: var(--control-size);
		border: 0;
		border-radius: 12px;
		background: #ffffff;
		color: #090710;
		font-family: inherit;
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		cursor: pointer;
	}

	.auth-google:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
