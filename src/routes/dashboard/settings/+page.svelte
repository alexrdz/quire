<script lang="ts">
	import { enhance } from '$app/forms';
	import { Center, Box, Stack, Cluster } from '$lib/components/layout';

	let { data, form } = $props();

	let generalWallApproveFirst = $state(false);
	let payoutsEnabled = $state(false);

	$effect(() => {
		generalWallApproveFirst = Boolean(data.artist.generalWallApproveFirst);
		payoutsEnabled = Boolean(data.artist.payoutsEnabled);
	});
</script>

<svelte:head>
	<title>Artist Settings & Payouts | Quire</title>
</svelte:head>

<div class="settings-root" style="--accent: {data.artist.accentColor || '#05D9E8'};">
	<Center max="md" padding="md" class="settings-canvas">
		<Stack gap="lg">
			<header class="cover-header">
				<a href="/dashboard" class="glass-pill text-highlight link-clean">← Back to Dashboard</a>
				<span class="text-muted header-eyebrow">Settings & Security</span>
			</header>

			<Box variant="raised" padding="xl" radius="lg">
				<Stack gap="lg">
					<Stack gap="xs">
						<h1 class="settings-title">
							Settings & Payouts
						</h1>
						<p class="text-muted settings-subtitle">
							Manage Stripe Connect payout account and guestbook moderation rules.
						</p>
					</Stack>

					{#if form?.success}
						<Box variant="subtle" padding="sm" radius="md" class="success-box">
							✓ Settings updated successfully!
						</Box>
					{/if}

					<!-- Stripe Connect Box -->
					<Box variant="subtle" padding="md" radius="md">
						<Stack gap="sm">
							<Cluster justify="between" align="center">
								<Stack gap="xs">
									<span class="box-section-title">Stripe Connect (Express Payouts)</span>
									<p class="text-muted subtext-small">
										Direct bank deposits for live gig tips. Bandcamp-style 5% platform cut is automatically transferred.
									</p>
								</Stack>

								{#if payoutsEnabled}
									<span class="text-highlight font-semibold payout-status-badge">● Payouts Active</span>
								{:else}
									<span class="text-support font-semibold payout-status-badge">Pending Setup</span>
								{/if}
							</Cluster>

							<div class="checkbox-strip">
								<label class="pointer-cursor">
									<Cluster align="center" gap="xs">
										<input type="checkbox" bind:checked={payoutsEnabled} />
										<span class="checkbox-label">Enable test mode tipping (Simulate verified Stripe Express account)</span>
									</Cluster>
								</label>
							</div>
						</Stack>
					</Box>

					<!-- Moderation Preferences Form -->
					<form method="POST" action="?/updateSettings" use:enhance>
						<Stack gap="md">
							<input type="hidden" name="simulatePayouts" value={String(payoutsEnabled)} />

							<Box variant="subtle" padding="md" radius="md">
								<Stack gap="sm">
									<span class="box-section-title">General Wall Moderation</span>
									<p class="text-muted subtext-small">
										Controls whether notes posted on your Back Page appear immediately or require approval.
									</p>

									<label class="pointer-cursor">
										<Cluster align="center" gap="xs">
											<input type="checkbox" name="generalWallApproveFirst" value="true" bind:checked={generalWallApproveFirst} />
											<span class="checkbox-label">Require artist approval before General Wall notes go live</span>
										</Cluster>
									</label>
								</Stack>
							</Box>

							<button
								type="submit"
								class="floating-tip-btn btn-save"
							>
								Save Changes
							</button>
						</Stack>
					</form>
				</Stack>
			</Box>
		</Stack>
	</Center>
</div>

<style>
	.settings-root {
		background-color: var(--ink);
		min-block-size: 100vh;
	}

	:global(.settings-canvas) {
		padding-block: var(--space-xl);
	}

	.link-clean {
		text-decoration: none;
	}

	.header-eyebrow {
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.settings-title {
		font-size: 1.8rem;
		font-weight: 800;
		color: #ffffff;
	}

	.settings-subtitle {
		font-size: 0.9rem;
	}

	:global(.success-box) {
		border-color: var(--highlight);
		color: var(--highlight);
		font-size: 0.85rem;
	}

	.box-section-title {
		font-weight: 700;
		color: #ffffff;
	}

	.subtext-small {
		font-size: 0.85rem;
	}

	.payout-status-badge {
		font-size: 0.85rem;
	}

	.checkbox-strip {
		padding-block-start: var(--space-xs);
	}

	.pointer-cursor {
		cursor: pointer;
	}

	.checkbox-label {
		font-size: 0.85rem;
		color: var(--paper);
	}

	.btn-save {
		position: static;
		inline-size: 100%;
		justify-content: center;
		padding: 0.85rem;
		font-size: 1rem;
		box-shadow: none;
	}
</style>
