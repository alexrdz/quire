<script lang="ts">
	import { enhance } from '$app/forms';

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

<div style="background-color: var(--ink); min-block-size: 100vh; --accent: {data.artist.accentColor || '#05D9E8'};">
	<div data-center style="padding-block: 2rem;" data-stack="lg">
		<header class="cover-header">
			<a href="/dashboard" class="glass-pill text-highlight" style="text-decoration: none;">← Back to Dashboard</a>
			<span class="glass-pill">Settings & Security</span>
		</header>

		<div class="glass-panel" style="padding: 2rem;" data-stack="lg">
			<div data-stack="xs">
				<h1 style="font-size: 1.8rem; font-weight: 800; color: #FFFFFF;">
					Settings & Payouts
				</h1>
				<p class="text-muted" style="font-size: 0.9rem;">
					Manage Stripe Connect payout account and guestbook moderation rules.
				</p>
			</div>

			{#if form?.success}
				<div class="glass-panel" style="padding: 0.75rem; border-color: var(--highlight); color: var(--highlight); font-size: 0.85rem;">
					✓ Settings updated successfully!
				</div>
			{/if}

			<!-- Stripe Connect Box -->
			<div class="glass-panel" style="padding: 1.5rem;" data-stack="sm">
				<div data-cluster="between">
					<div data-stack="xs">
						<span style="font-weight: 700; color: #FFFFFF;">Stripe Connect (Express Payouts)</span>
						<p class="text-muted" style="font-size: 0.85rem;">
							Direct bank deposits for live gig tips. Bandcamp-style 5% platform cut is automatically transferred.
						</p>
					</div>

					{#if payoutsEnabled}
						<span class="glass-pill tag-highlight">● Payouts Active</span>
					{:else}
						<span class="glass-pill tag-support">Pending Setup</span>
					{/if}
				</div>

				<div style="padding-block-start: 0.75rem;">
					<label data-cluster style="cursor: pointer; font-size: 0.85rem; color: var(--paper);">
						<input type="checkbox" bind:checked={payoutsEnabled} />
						<span>Enable test mode tipping (Simulate verified Stripe Express account)</span>
					</label>
				</div>
			</div>

			<!-- Moderation Preferences Form -->
			<form method="POST" action="?/updateSettings" use:enhance data-stack="md">
				<input type="hidden" name="simulatePayouts" value={String(payoutsEnabled)} />

				<div class="glass-panel" style="padding: 1.5rem;" data-stack="sm">
					<span style="font-weight: 700; color: #FFFFFF;">General Wall Moderation</span>
					<p class="text-muted" style="font-size: 0.85rem;">
						Controls whether notes posted on your Back Page appear immediately or require approval.
					</p>

					<label data-cluster style="cursor: pointer; font-size: 0.85rem; color: var(--paper); margin-block-start: 0.5rem;">
						<input type="checkbox" name="generalWallApproveFirst" value="true" bind:checked={generalWallApproveFirst} />
						<span>Require artist approval before General Wall notes go live</span>
					</label>
				</div>

				<button
					type="submit"
					class="floating-tip-btn"
					style="position: static; inline-size: 100%; justify-content: center; padding: 0.85rem; font-size: 1rem; box-shadow: none;"
				>
					Save Changes
				</button>
			</form>
		</div>
	</div>
</div>
