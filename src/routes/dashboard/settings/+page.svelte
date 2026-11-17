<script lang="ts">
	import { enhance } from '$app/forms';
	import { Container, Box, Stack, Cluster } from '$lib/components/layout';
	import ArtistTopNav from '$lib/components/dashboard/ArtistTopNav.svelte';

	type PayoutActionOption = 'connect' | 'replace' | 'disconnect';

	let { data, form } = $props();

	let generalWallApproveFirst = $state(false);
	let confirmPassword = $state('');
	let selectedAction = $state<PayoutActionOption>('connect');

	const hasAnyAccount = $derived(Boolean(data.artist.stripeAccountId));
	const hasLiveAccount = $derived(hasAnyAccount && !data.isSeededDemoAccount);

	const payoutStatusKind = $derived.by(() => {
		if (!data.artist.stripeAccountId) return 'not_connected' as const;
		if (data.artist.payoutsEnabled) return 'active' as const;
		return 'incomplete' as const;
	});

	const availableActions = $derived.by((): Array<{
		value: PayoutActionOption;
		label: string;
		description: string;
	}> => {
		if (!hasAnyAccount) {
			return [
				{
					value: 'connect',
					label: 'Connect Stripe Express',
					description:
						'Create a Stripe Express account and redirect to hosted onboarding after email confirmation.'
				}
			];
		}

		if (data.isSeededDemoAccount) {
			return [
				{
					value: 'connect',
					label: 'Connect Real Stripe Express Account',
					description:
						'Replace the seeded local test ID with a real Stripe Express connected account.'
				},
				{
					value: 'disconnect',
					label: 'Disconnect Payouts',
					description:
						'Clear the connected payout account and hide 1-tap tip buttons across your zines.'
				}
			];
		}

		if (!data.artist.payoutsEnabled) {
			return [
				{
					value: 'connect',
					label: 'Resume Stripe Express Onboarding',
					description:
						'Generate a fresh Stripe Express onboarding link to finish identity and bank verification.'
				},
				{
					value: 'replace',
					label: 'Replace Connected Account',
					description:
						'Create and onboard a brand new Stripe Express account for this band.'
				},
				{
					value: 'disconnect',
					label: 'Disconnect Payouts',
					description:
						'Remove the incomplete Stripe account and hide tip buttons until reconnected.'
				}
			];
		}

		return [
			{
				value: 'replace',
				label: 'Replace Connected Stripe Account',
				description:
					'Switch payouts to a new Stripe Express account via hosted onboarding.'
			},
			{
				value: 'disconnect',
				label: 'Disconnect Payouts',
				description:
					'Disconnect your Stripe Express account and hide 1-tap tip buttons across all pages.'
			}
		];
	});

	const actionButtonLabel = $derived.by(() => {
		if (selectedAction === 'disconnect') {
			return 'Send Confirmation Email to Disconnect Payouts';
		}
		if (selectedAction === 'replace') {
			return 'Send Confirmation Email to Replace Account';
		}
		if (hasLiveAccount && !data.artist.payoutsEnabled) {
			return 'Send Confirmation Email to Resume Onboarding';
		}
		return 'Send Confirmation Email to Connect Stripe';
	});

	$effect(() => {
		generalWallApproveFirst = Boolean(data.artist.generalWallApproveFirst);
	});

	$effect(() => {
		const allowed = availableActions.map((item) => item.value);
		const requested =
			form && 'selectedAction' in form
				? (form.selectedAction as PayoutActionOption | undefined)
				: undefined;
		if (requested && allowed.includes(requested)) {
			selectedAction = requested;
		} else if (!allowed.includes(selectedAction)) {
			selectedAction = allowed[0] ?? 'connect';
		}
	});

	$effect(() => {
		if (form?.payoutConfirmationSent) {
			confirmPassword = '';
		}
	});
</script>

<svelte:head>
	<title>Settings & Payouts — {data.artist.displayName} | Quire</title>
</svelte:head>

<div class="settings-root" style="--accent: {data.artist.accentColor || '#05D9E8'};">
	<ArtistTopNav artist={data.artist} activeTab="settings" />

	<Container as="main" width="md" padding="md" class="settings-canvas">
		<Stack gap="lg">
			<Stack gap="xs">
				<span class="text-highlight font-mono eyebrow-small">ACCOUNT SAFETY & STRIPE CONNECT</span>
				<h1 class="settings-title">Settings & Payouts</h1>
				<p class="text-muted settings-subtitle">
					Connect your Stripe Express payout account, enforce shared band login security, and configure General Wall moderation rules.
				</p>
			</Stack>

			{#if data.stripeReturnState === 'return'}
				{#if data.artist.payoutsEnabled}
					<Box as="section" variant="subtle" padding="md" radius="md" class="success-box">
						<Stack gap="2xs">
							<span class="banner-heading">Stripe Connect Express Onboarding Complete</span>
							<p class="subtext-small">
								Live status synced with Stripe. Payouts are active and 1-tap tip buttons are enabled across your Cover, Issue pages, and Back Page.
							</p>
						</Stack>
					</Box>
				{:else}
					<Box as="section" variant="subtle" padding="md" radius="md" class="warning-box">
						<Stack gap="2xs">
							<span class="banner-heading">Returned from Stripe Express Onboarding</span>
							<p class="subtext-small">
								Your Stripe account is linked, but payouts are not enabled yet. Complete any remaining verification steps in Stripe Express to activate 1-tap tipping.
							</p>
							{#if data.stripeStatus?.requirementsCurrentlyDue.length}
								<p class="font-mono requirement-list">
									Requirements due: {data.stripeStatus.requirementsCurrentlyDue.join(', ')}
								</p>
							{/if}
						</Stack>
					</Box>
				{/if}
			{:else if data.stripeReturnState === 'refresh'}
				<Box as="section" variant="subtle" padding="md" radius="md" class="warning-box">
					<Stack gap="2xs">
						<span class="banner-heading">Stripe Onboarding Link Expired</span>
						<p class="subtext-small">
							Your Stripe Express onboarding session timed out before finishing. Re-enter your band password below to request a fresh confirmation email and resume onboarding.
						</p>
					</Stack>
				</Box>
			{/if}

			{#if data.stripeSyncError}
				<Box as="section" variant="subtle" padding="sm" radius="md" class="warning-box">
					Unable to sync live status from Stripe: {data.stripeSyncError}
				</Box>
			{/if}

			<!-- Stripe Connect Express Section (SPEC §6.4) -->
			<Box as="section" variant="raised" padding="xl" radius="lg" class="settings-card">
				<Stack gap="lg">
					<Cluster justify="between" align="center" gap="sm">
						<Stack gap="2xs">
							<span class="box-section-title">Stripe Connect (Express Payouts)</span>
							<p class="text-muted subtext-small">
								Direct bank payouts for 1-tap gig tips (5% platform cut). Tip buttons stay hidden on your Cover, Issue pages, and Back Page until Stripe reports payouts enabled.
							</p>
						</Stack>

						{#if payoutStatusKind === 'active'}
							<span class="status-badge status-active">
								<span class="status-dot" aria-hidden="true"></span>
								Payouts Active
							</span>
						{:else if payoutStatusKind === 'incomplete'}
							<span class="status-badge status-incomplete">
								<span class="status-dot" aria-hidden="true"></span>
								Onboarding Incomplete
							</span>
						{:else}
							<span class="status-badge status-disabled">
								<span class="status-dot" aria-hidden="true"></span>
								Not Connected
							</span>
						{/if}
					</Cluster>

					{#if data.artist.stripeAccountId}
						<Box variant="subtle" padding="md" radius="md" class="subsection-box">
							<Stack gap="xs">
								<Cluster justify="between" align="center" gap="sm">
									<span class="input-label">Connected Stripe Account</span>
									<span class="font-mono account-id-pill">{data.artist.stripeAccountId}</span>
								</Cluster>

								{#if data.isSeededDemoAccount}
									<p class="text-muted subtext-small">
										This artist profile is currently using a seeded local development account ID. Connect a real Stripe Express account below when Stripe keys are configured.
									</p>
								{:else if data.stripeStatus}
									<Cluster gap="sm" class="capability-row">
										<span class="capability-chip">
											Details Submitted: {data.stripeStatus.detailsSubmitted ? 'Yes' : 'No'}
										</span>
										<span class="capability-chip">
											Charges Enabled: {data.stripeStatus.chargesEnabled ? 'Yes' : 'No'}
										</span>
										<span class="capability-chip">
											Payouts Enabled: {data.stripeStatus.payoutsEnabled ? 'Yes' : 'No'}
										</span>
									</Cluster>
								{/if}
							</Stack>
						</Box>
					{/if}

					{#if !data.stripeConfigured}
						<Box variant="subtle" padding="sm" radius="md" class="info-box">
							Stripe Connect API keys are not configured on this server (<span class="font-mono">STRIPE_SECRET_KEY</span> is unset). Password verification and confirmation emails still execute, and the confirmation route will display the missing key error until Stripe is configured.
						</Box>
					{/if}

					{#if form?.payoutConfirmationSent}
						<Box variant="subtle" padding="md" radius="md" class="success-box">
							<Stack gap="2xs">
								<p>
									Confirmation email sent to <strong>{form.sentToEmail || data.userEmail}</strong>. Click the link in that email within 1 hour to complete your payout change.
								</p>
								{#if form.emailMode === 'dev_console'}
									<p class="text-muted subtext-small">
										Development note: <span class="font-mono">RESEND_API_KEY</span> is not set, so the confirmation URL was logged to the server console.
									</p>
								{/if}
							</Stack>
						</Box>
					{:else if data.pendingPayoutChange}
						<Box variant="subtle" padding="sm" radius="md" class="info-box">
							A payout confirmation link (<span class="font-mono">{data.pendingPayoutChange.action}</span>) was sent to <strong>{data.userEmail}</strong> and is awaiting confirmation. Submitting below will supersede that link with a fresh one.
						</Box>
					{/if}

					{#if form?.payoutError}
						<Box variant="subtle" padding="sm" radius="md" class="error-box">
							{form.payoutError}
						</Box>
					{/if}

					<form data-stack="gap:md" method="POST" action="?/requestPayoutChange" use:enhance>
						<Box variant="subtle" padding="md" radius="md" class="subsection-box">
							<Stack gap="sm">
								<span class="input-label">Select Payout Action</span>
								<Stack gap="xs">
									{#each availableActions as option (option.value)}
										<label class="action-option {selectedAction === option.value ? 'is-selected' : ''}">
											<input
												type="radio"
												name="action"
												value={option.value}
												bind:group={selectedAction}
											/>
											<Stack gap="3xs">
												<span class="action-option-title">{option.label}</span>
												<span class="text-muted subtext-small">{option.description}</span>
											</Stack>
										</label>
									{/each}
								</Stack>
							</Stack>
						</Box>

						<Stack gap="xs">
							<label for="confirmPassword" class="input-label">
								Confirm Shared Band Password (SPEC 6.4 Security Gate)
							</label>
							<p class="text-muted subtext-small">
								Because band logins are shared among bandmates, modifying or disconnecting your payout account requires re-entering your password and confirming via a single-use link sent to <span class="font-mono">{data.userEmail}</span>.
							</p>
							<input
								id="confirmPassword"
								type="password"
								name="confirmPassword"
								bind:value={confirmPassword}
								required
								autocomplete="current-password"
								placeholder="Re-enter your account password..."
								class="field-input"
							/>
							{#if !data.hasCredentialPassword}
								<p class="text-muted subtext-small">
									No email/password credential was found on this user account. Set a password via password reset before modifying payout settings.
								</p>
							{/if}
						</Stack>

						<button type="submit" class="btn-save">
							{actionButtonLabel}
						</button>
					</form>
				</Stack>
			</Box>

			<!-- General Wall Moderation Section (No password required) -->
			<Box as="section" variant="raised" padding="xl" radius="lg" class="settings-card">
				<Stack gap="md">
					<Stack gap="2xs">
						<span class="box-section-title">General Wall Moderation</span>
						<p class="text-muted subtext-small">
							Controls whether notes posted on your permanent Back Page go live immediately or wait in your dashboard moderation queue. Updates immediately without password re-entry.
						</p>
					</Stack>

					{#if form?.moderationSaved}
						<Box variant="subtle" padding="sm" radius="md" class="success-box">
							General Wall moderation settings saved.
						</Box>
					{/if}

					{#if form?.moderationError}
						<Box variant="subtle" padding="sm" radius="md" class="error-box">
							{form.moderationError}
						</Box>
					{/if}

					<form data-stack="gap:md" method="POST" action="?/updateModeration" use:enhance>
						<Cluster as="label" align="center" gap="xs" class="pointer-cursor">
							<input
								type="checkbox"
								name="generalWallApproveFirst"
								value="true"
								bind:checked={generalWallApproveFirst}
							/>
							<span class="checkbox-label">
								Require artist approval before General Wall notes go live
							</span>
						</Cluster>

						<button type="submit" class="btn-secondary">
							Save Moderation Settings
						</button>
					</form>
				</Stack>
			</Box>
		</Stack>
	</Container>
</div>

<style>
	.settings-root {
		background-color: var(--bg-void);
		min-block-size: 100vh;
	}

	:global(.settings-canvas) {
		padding-block: var(--space-xl);
	}

	.eyebrow-small {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.settings-title {
		font-size: clamp(1.85rem, 3.5vw, 2.5rem);
		font-weight: 800;
		color: #ffffff;
	}

	.settings-subtitle {
		font-size: 0.92rem;
	}

	:global(.settings-card),
	:global(.subsection-box) {
		border-color: var(--glass-border);
	}

	:global(.success-box) {
		border-color: var(--highlight);
		color: var(--highlight);
		font-size: 0.85rem;
	}

	:global(.warning-box) {
		border-color: rgba(250, 204, 21, 0.45);
		color: #fde68a;
		font-size: 0.85rem;
	}

	:global(.info-box) {
		border-color: rgba(5, 217, 232, 0.35);
		color: #bae6fd;
		font-size: 0.85rem;
	}

	:global(.error-box) {
		border-color: var(--support);
		color: var(--support);
		font-size: 0.85rem;
	}

	.banner-heading {
		font-weight: 700;
		font-size: 0.92rem;
	}

	.requirement-list {
		font-size: 0.78rem;
		color: #fef08a;
	}

	.box-section-title {
		font-weight: 700;
		font-size: 1.05rem;
		color: #ffffff;
	}

	.subtext-small {
		font-size: 0.85rem;
		line-height: 1.5;
	}

	.input-label {
		font-size: 0.78rem;
		font-weight: 600;
		color: #d4d2df;
	}

	.account-id-pill {
		font-size: 0.8rem;
		color: var(--highlight);
		background: rgba(1, 255, 195, 0.08);
		border: 1px solid rgba(1, 255, 195, 0.25);
		border-radius: var(--radius-sm);
		padding-block: 0.2rem;
		padding-inline: 0.5rem;
	}

	:global(.capability-row) {
		padding-block-start: 0.25rem;
	}

	.capability-chip {
		font-size: 0.75rem;
		font-family: var(--font-mono);
		color: #d4d2df;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-sm);
		padding-block: 0.2rem;
		padding-inline: 0.5rem;
	}

	.action-option {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding-block: 0.75rem;
		padding-inline: 0.9rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--glass-border);
		background: rgba(0, 0, 0, 0.35);
		cursor: pointer;
		transition: border-color 0.15s ease, background-color 0.15s ease;
	}

	.action-option input[type='radio'] {
		margin-block-start: 0.2rem;
		accent-color: var(--accent);
	}

	.action-option.is-selected {
		border-color: var(--accent);
		background: rgba(5, 217, 232, 0.08);
	}

	.action-option-title {
		font-size: 0.88rem;
		font-weight: 700;
		color: #ffffff;
	}

	.field-input {
		inline-size: 100%;
		padding-block: 0.65rem;
		padding-inline: 0.85rem;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		font-size: 0.88rem;
	}

	.font-mono {
		font-family: var(--font-mono);
	}

	:global(.pointer-cursor) {
		cursor: pointer;
	}

	.checkbox-label {
		font-size: 0.85rem;
		color: #e4e4e7;
	}

	.btn-save {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: 0.7rem;
		padding-inline: 1.5rem;
		border-radius: 8px;
		background: var(--support);
		color: #ffffff;
		border: 1px solid rgba(255, 42, 109, 0.5);
		font-size: 0.88rem;
		font-weight: 700;
		cursor: pointer;
		inline-size: fit-content;
		box-shadow: 0 0 20px rgba(255, 42, 109, 0.35);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-save:hover {
		transform: translateY(-1px);
		box-shadow: 0 0 26px rgba(255, 42, 109, 0.55);
	}

	.btn-secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: 0.65rem;
		padding-inline: 1.35rem;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
		border: 1px solid var(--glass-border-hover);
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		inline-size: fit-content;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-secondary:hover {
		background: rgba(255, 255, 255, 0.14);
		border-color: var(--accent);
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding-block: 0.28rem;
		padding-inline: 0.7rem;
		border-radius: 4px;
		font-size: 0.72rem;
		font-weight: 700;
		font-family: var(--font-mono);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.status-dot {
		inline-size: 0.45rem;
		block-size: 0.45rem;
		border-radius: var(--radius-full);
		background-color: currentColor;
	}

	.status-badge.status-active {
		background: rgba(1, 255, 195, 0.12);
		border: 1px solid rgba(1, 255, 195, 0.35);
		color: var(--highlight);
	}

	.status-badge.status-incomplete {
		background: rgba(250, 204, 21, 0.12);
		border: 1px solid rgba(250, 204, 21, 0.4);
		color: #fde047;
	}

	.status-badge.status-disabled {
		background: rgba(255, 42, 109, 0.14);
		border: 1px solid rgba(255, 42, 109, 0.4);
		color: #ff6b9b;
	}
</style>
