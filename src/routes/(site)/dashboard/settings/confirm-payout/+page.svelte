<script lang="ts">
	import { Container, Box, Stack, Cluster } from '$lib/components/layout';
	import ArtistTopNav from '$lib/components/dashboard/ArtistTopNav.svelte';

	let { data } = $props();

	const headingText = $derived.by(() => {
		if (data.status === 'disconnected') {
			return 'Stripe Payouts Disconnected';
		}
		if (data.errorCode === 'STRIPE_NOT_CONFIGURED') {
			return 'Stripe Is Not Configured';
		}
		if (data.errorCode === 'TOKEN_EXPIRED') {
			return 'Confirmation Link Expired';
		}
		if (data.errorCode === 'TOKEN_ALREADY_USED') {
			return 'Confirmation Link Already Used';
		}
		if (data.errorCode === 'UNAUTHORIZED') {
			return 'Account Mismatch';
		}
		return 'Unable to Confirm Payout Change';
	});
</script>

<svelte:head>
	<title>Confirm Payout Change — {data.artist.displayName} | Quire</title>
</svelte:head>

<div class="confirm-root" style="--accent: {data.artist.accentColor || '#05D9E8'};">
	<ArtistTopNav artist={data.artist} activeTab="settings" />

	<Container as="main" width="sm" padding="md" class="confirm-canvas">
		<Box variant="raised" padding="xl" radius="lg" class="confirm-card">
			<Stack gap="md">
				<span class="text-highlight font-mono eyebrow-small">SPEC 6.4 PAYOUT CONFIRMATION</span>
				<h1 class="confirm-title">{headingText}</h1>

				{#if data.status === 'disconnected'}
					<Box variant="subtle" padding="md" radius="md" class="success-box">
						Your Stripe Express payout account has been disconnected and payouts are now disabled. Tip buttons are hidden on your Cover, Issue pages, and Back Page until you connect a new Stripe Express account.
					</Box>
				{:else}
					<Box variant="subtle" padding="md" radius="md" class="error-box">
						{data.errorMessage}
					</Box>
				{/if}

				<Cluster gap="sm" align="center">
					<a href="/dashboard/settings" class="btn-back">
						Back to Settings & Payouts
					</a>
					<a href="/dashboard" class="btn-ghost">
						Studio Overview
					</a>
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

	:global(.success-box) {
		border-color: var(--highlight);
		color: var(--highlight);
		font-size: var(--text-ui);
		line-height: var(--leading-body);
	}

	:global(.error-box) {
		border-color: var(--support);
		color: var(--support);
		font-size: var(--text-ui);
		line-height: var(--leading-body);
	}

	.btn-back {
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
		text-decoration: none;
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
