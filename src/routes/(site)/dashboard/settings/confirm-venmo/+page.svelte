<script lang="ts">
	import { enhance } from '$app/forms';
	import { Container, Box, Stack, Cluster } from '$lib/components/layout';
	import ArtistTopNav from '$lib/components/dashboard/ArtistTopNav.svelte';

	let { data, form } = $props();

	const errorMessage = $derived(form?.confirmError ?? (data.status === 'error' ? data.errorMessage : null));
	const errorCode = $derived(form?.errorCode ?? (data.status === 'error' ? data.errorCode : null));

	const headingText = $derived.by(() => {
		if (errorCode === 'TOKEN_EXPIRED') return 'Confirmation link expired';
		if (errorCode === 'TOKEN_USED') return 'Confirmation link already used';
		if (errorCode === 'WRONG_ACCOUNT') return 'Different artist account';
		if (errorMessage) return 'Unable to confirm this change';
		return data.status === 'pending' && data.newUsername ? 'Confirm Venmo change' : 'Confirm Venmo removal';
	});
</script>

<svelte:head>
	<title>Confirm Venmo Change | Quire</title>
</svelte:head>

<div class="confirm-root" style="--accent: {data.artist.accentColor || '#05D9E8'};">
	<ArtistTopNav artist={data.artist} activeTab="settings" />

	<Container as="main" width="sm" padding="md" class="confirm-canvas">
		<Box variant="raised" padding="xl" radius="lg" class="confirm-card">
			<Stack gap="md">
				<span class="text-highlight font-mono eyebrow-small">VENMO TIPS</span>
				<h1 class="confirm-title">{headingText}</h1>

				{#if errorMessage}
					<Box variant="subtle" padding="md" radius="md" class="error-box">
						{errorMessage}
					</Box>
				{:else if data.status === 'pending'}
					<p class="confirm-question">
						{#if data.newUsername}
							Change <span class="font-mono">@{data.oldUsername}</span> to
							<span class="font-mono">@{data.newUsername}</span>?
						{:else}
							Remove <span class="font-mono">@{data.oldUsername}</span>? Tip buttons will stop opening Venmo.
						{/if}
					</p>
					<p class="text-muted confirm-note">
						Tips keep going to <span class="font-mono">@{data.oldUsername}</span> until you confirm. We will email your band address once it is done.
					</p>
					<form method="POST" use:enhance>
						<input type="hidden" name="token" value={data.token} />
						<button type="submit" class="btn-confirm">
							{data.newUsername ? `Change to @${data.newUsername}` : 'Remove Venmo username'}
						</button>
					</form>
				{/if}

				<Cluster gap="sm" align="center">
					<a href="/dashboard/settings" class="btn-ghost">Back to Settings</a>
				</Cluster>
			</Stack>
		</Box>
	</Container>
</div>

<style>
	.confirm-root {
		background-color: var(--bg-void);
	}

	:global(.confirm-canvas) {
		padding-block: var(--space-2xl);
	}

	:global(.confirm-card) {
		border-color: var(--glass-border);
	}

	.eyebrow-small {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
	}

	.confirm-title {
		font-size: var(--text-heading-sm);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.confirm-question {
		font-size: var(--text-body);
		line-height: var(--leading-body);
		color: #ffffff;
	}

	.confirm-note {
		font-size: var(--text-small);
		line-height: var(--leading-body);
	}

	:global(.error-box) {
		border-color: var(--support);
		color: var(--support);
		font-size: var(--text-ui);
		line-height: var(--leading-body);
	}

	.btn-confirm {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 8px;
		background: var(--support);
		color: #ffffff;
		border: 1px solid rgba(255, 42, 109, 0.5);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		cursor: pointer;
	}

	.btn-ghost {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.05);
		color: #e4e4e7;
		border: 1px solid var(--glass-border);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		text-decoration: none;
	}
</style>
