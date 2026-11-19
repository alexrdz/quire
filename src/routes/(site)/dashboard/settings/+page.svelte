<script lang="ts">
	import { enhance } from '$app/forms';
	import { Container, Box, Stack, Cluster, Split } from '$lib/components/layout';
	import ArtistTopNav from '$lib/components/dashboard/ArtistTopNav.svelte';
	import FeatureNotice from '$lib/components/site/FeatureNotice.svelte';

	let { data, form } = $props();

	let generalWallApproveFirst = $state(false);
	let venmoInput = $state('');
	let changePassword = $state('');
	let removePassword = $state('');

	const venmo = $derived(data.venmo);
	const hasVenmo = $derived(Boolean(venmo.username));
	/** First set needs a confirmed email; changes need email to be on. */
	const saveBlocked = $derived(
		hasVenmo ? !venmo.canChange : Boolean(venmo.firstSetBlockedMessage)
	);

	$effect(() => {
		generalWallApproveFirst = Boolean(data.artist.generalWallApproveFirst);
	});

	$effect(() => {
		if (form && 'venmoValue' in form && typeof form.venmoValue === 'string') {
			venmoInput = form.venmoValue;
		} else if (form?.venmoSaved || form?.venmoChangeRequested) {
			venmoInput = '';
		}
		if (form?.venmoChangeRequested) {
			changePassword = '';
			removePassword = '';
		}
	});
</script>

<svelte:head>
	<title>Settings — {data.artist.displayName} | Quire</title>
</svelte:head>

<div class="settings-root" style="--accent: {data.artist.accentColor || '#05D9E8'};">
	<ArtistTopNav artist={data.artist} activeTab="settings" />

	<Container as="main" width="md" padding="md" class="settings-canvas">
		<Stack gap="lg">
			<Stack gap="xs">
				<span class="text-highlight font-mono eyebrow-small">ACCOUNT SAFETY & VENMO TIPS</span>
				<h1 class="settings-title">Settings</h1>
				<p class="text-muted settings-subtitle">
					Choose where tips go, keep your shared band login safe, and set General Wall moderation rules.
				</p>
			</Stack>

			{#if data.verifiedReturn}
				<Box as="section" variant="subtle" padding="md" radius="md" class="success-box">
					Band email address verified. You can add your Venmo username and recover your password by email.
				</Box>
			{/if}

			{#if data.emailChangedReturn}
				<Box as="section" variant="subtle" padding="md" radius="md" class="success-box">
					Band shared email updated and verified.
				</Box>
			{/if}

			<!-- Venmo tips (ADR 0008) -->
			<Box as="section" variant="raised" padding="xl" radius="lg" class="settings-card">
				<Stack gap="lg">
					<Cluster justify="between" align="center" gap="sm">
						<Stack gap="2xs">
							<span class="box-section-title">Venmo Tips</span>
							<p class="text-muted subtext-small">
								Tips go straight to your Venmo. Quire never touches the money and takes no cut. Tip buttons appear on your Cover, Issue pages and Back Page once a username is set.
							</p>
						</Stack>
						{#if hasVenmo}
							<span class="status-badge status-active">
								<span class="status-dot" aria-hidden="true"></span>
								Tips on
							</span>
						{:else}
							<span class="status-badge status-disabled">
								<span class="status-dot" aria-hidden="true"></span>
								No Venmo yet
							</span>
						{/if}
					</Cluster>

					<p class="text-muted subtext-small">
						Venmo expects a business profile for receiving payments for goods and services. Check Venmo's terms for which profile fits your band.
					</p>

					{#if venmo.changedReturn === 'changed'}
						<Box variant="subtle" padding="sm" radius="md" class="success-box">
							Venmo username changed. Tips now go to <span class="font-mono">@{venmo.username}</span>.
						</Box>
					{:else if venmo.changedReturn === 'removed'}
						<Box variant="subtle" padding="sm" radius="md" class="success-box">
							Venmo username removed. Tip buttons are hidden until you add one.
						</Box>
					{/if}

					{#if hasVenmo && venmo.profileUrl}
						<Box variant="subtle" padding="md" radius="md" class="subsection-box">
							<Stack gap="xs">
								<Cluster justify="between" align="center" gap="sm">
									<span class="input-label">Tips go to</span>
									<span class="font-mono account-id-pill">@{venmo.username}</span>
								</Cluster>
								{#if venmo.testLinkOpens}
									<a href={venmo.profileUrl} target="_blank" rel="noopener noreferrer" class="btn-secondary test-link">
										Test your link
									</a>
									<p class="text-muted subtext-small">Opens your Venmo profile so you can check it is yours.</p>
								{:else}
									<Stack gap="3xs">
										<span class="input-label">Test your link</span>
										<span class="font-mono venmo-url">{venmo.profileUrl}</span>
										<p class="text-muted subtext-small">
											Outside production this link is shown, not opened: sample usernames may belong to real people.
										</p>
									</Stack>
								{/if}
							</Stack>
						</Box>
					{/if}

					{#if form?.venmoSaved}
						<Box variant="subtle" padding="sm" radius="md" class="success-box">
							Saved. Tips now go to <span class="font-mono">@{form.venmoUsername}</span>.
						</Box>
					{:else if form?.venmoChangeRequested}
						<Box variant="subtle" padding="md" radius="md" class="success-box">
							<Stack gap="2xs">
								<p>
									We sent a confirmation link to <strong>{form.sentToEmail}</strong>.
									{#if form.pendingUsername}
										Open it within 1 hour to switch tips to <span class="font-mono">@{form.pendingUsername}</span>.
									{:else}
										Open it within 1 hour to remove your Venmo username.
									{/if}
									Tips keep going to <span class="font-mono">@{venmo.username}</span> until then.
								</p>
								{#if form.emailMode === 'dev_console'}
									<p class="text-muted subtext-small">
										Development note: <span class="font-mono">RESEND_API_KEY</span> is not set, so the email was logged to the server console.
									</p>
								{/if}
							</Stack>
						</Box>
					{:else if venmo.pending}
						<Box variant="subtle" padding="sm" radius="md" class="info-box">
							{#if venmo.pending.newUsername}
								A change to <span class="font-mono">@{venmo.pending.newUsername}</span> is waiting for confirmation by email.
							{:else}
								Removing your Venmo username is waiting for confirmation by email.
							{/if}
							A new request replaces that link.
						</Box>
					{/if}

					{#if form?.venmoError}
						<Box variant="subtle" padding="sm" radius="md" class="error-box">
							{form.venmoError}
						</Box>
					{/if}

					{#if !hasVenmo && venmo.firstSetBlockedMessage}
						<Box variant="subtle" padding="sm" radius="md" class="warning-box">
							{venmo.firstSetBlockedMessage}
						</Box>
					{:else if hasVenmo && !venmo.canChange}
						<FeatureNotice
							feature="email"
							mode={data.features.mode}
							detail="Changing or removing your Venmo username needs a confirmation email, so it is paused. Tips keep going to your current username."
						/>
					{/if}

					<form data-stack="gap:md" method="POST" action="?/saveVenmo" use:enhance>
						<Stack gap="3xs">
							<label for="venmoUsername" class="input-label">
								{hasVenmo ? 'New Venmo username' : 'Venmo username'}
							</label>
							<input
								id="venmoUsername"
								name="venmoUsername"
								bind:value={venmoInput}
								required
								autocomplete="off"
								autocapitalize="off"
								spellcheck="false"
								placeholder="@your-band"
								class="field-input"
							/>
							<p class="text-muted subtext-small">5 to 30 letters, numbers, hyphens or underscores. A leading @ is fine.</p>
						</Stack>

						{#if hasVenmo}
							<Stack gap="3xs">
								<label for="venmoChangePassword" class="input-label">Band password</label>
								<p class="text-muted subtext-small">
									Logins are shared, so a change needs your password and a link sent to <span class="font-mono">{data.userEmail}</span>.
								</p>
								<input
									id="venmoChangePassword"
									type="password"
									name="confirmPassword"
									bind:value={changePassword}
									required
									autocomplete="current-password"
									class="field-input"
								/>
							</Stack>
						{/if}

						<button type="submit" class="btn-save" disabled={saveBlocked}>
							{hasVenmo ? 'Send confirmation email' : 'Save'}
						</button>
					</form>

					{#if hasVenmo}
						<form data-stack="gap:sm" method="POST" action="?/removeVenmo" use:enhance>
							<Box variant="subtle" padding="md" radius="md" class="subsection-box">
								<Stack gap="sm">
									<Stack gap="3xs">
										<span class="input-label">Remove Venmo username</span>
										<p class="text-muted subtext-small">Hides tip buttons everywhere once you confirm by email.</p>
									</Stack>
									<Stack gap="3xs">
										<label for="venmoRemovePassword" class="input-label">Band password</label>
										<input
											id="venmoRemovePassword"
											type="password"
											name="confirmPassword"
											bind:value={removePassword}
											required
											autocomplete="current-password"
											class="field-input"
										/>
									</Stack>
									<button type="submit" class="btn-secondary" disabled={!venmo.canChange}>
										Send removal email
									</button>
								</Stack>
							</Box>
						</form>
					{/if}

					{#if !data.hasCredentialPassword}
						<p class="text-muted subtext-small">
							No password is set on this login. Set one with a password reset before changing your Venmo username.
						</p>
					{/if}
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

			<!-- Band Email Verification & Credentials Section -->
			<Box as="section" variant="raised" padding="xl" radius="lg" class="settings-card">
				<Stack gap="lg">
					<Cluster justify="between" align="center" gap="sm">
						<Stack gap="2xs">
							<span class="box-section-title">Account Credentials &amp; Email Verification</span>
							<p class="text-muted subtext-small">
								Your shared band email (<span class="font-mono">{data.userEmail}</span>) controls password resets and Stripe payout confirmations.
							</p>
						</Stack>

						{#if data.emailVerified}
							<span class="status-badge status-active">
								<span class="status-dot" aria-hidden="true"></span>
								Email Verified
							</span>
						{:else}
							<span class="status-badge status-incomplete">
								<span class="status-dot" aria-hidden="true"></span>
								Email Unverified
							</span>
						{/if}
					</Cluster>

					{#if !data.emailVerified}
						<Box variant="subtle" padding="md" radius="md" class="warning-box">
							<Cluster justify="between" align="center" gap="md">
								<p class="subtext-small">
									Confirm your band email address so you never miss payout security alerts or password reset links.
								</p>
								<form method="POST" action="?/resendVerification" use:enhance>
									<button type="submit" class="btn-secondary" disabled={!data.features.email}>
										Resend Verification Email
									</button>
								</form>
							</Cluster>
						</Box>
					{/if}

					{#if form?.verificationEmailSent}
						<Box variant="subtle" padding="sm" radius="md" class="success-box">
							Verification email sent to <strong>{form.sentToEmail}</strong>.
						</Box>
					{/if}

					{#if form?.accountError}
						<Box variant="subtle" padding="sm" radius="md" class="error-box">
							{form.accountError}
						</Box>
					{/if}

					<Split ratio="1-1" gap="lg" collapse="md">
						<!-- Update Band Email -->
						<Box variant="subtle" padding="lg" radius="md" class="subsection-box">
							<Stack gap="md">
								<Stack gap="3xs">
									<span class="input-label">Update Band Shared Email</span>
									<p class="text-muted subtext-small">
										Requires your current password and sends a verification link to the new email address.
									</p>
								</Stack>

								{#if form?.emailChangeRequested}
									<Box variant="subtle" padding="sm" radius="md" class="success-box">
										Verification link sent to <strong>{form.targetEmail}</strong>. Open that link to finish switching your band email.
									</Box>
								{/if}

								{#if form?.emailError}
									<Box variant="subtle" padding="sm" radius="md" class="error-box">
										{form.emailError}
									</Box>
								{/if}

								<form data-stack="gap:sm" method="POST" action="?/changeEmail" use:enhance>
									<Stack gap="3xs">
										<label for="newEmail" class="input-label">New Band Email</label>
										<input
											id="newEmail"
											type="email"
											name="newEmail"
											required
											placeholder="new-band-email@example.com"
											class="field-input"
										/>
									</Stack>
									<Stack gap="3xs">
										<label for="emailCurrentPassword" class="input-label">Current Password</label>
										<input
											id="emailCurrentPassword"
											type="password"
											name="currentPassword"
											required
											autocomplete="current-password"
											placeholder="Confirm current password"
											class="field-input"
										/>
									</Stack>
									<button type="submit" class="btn-secondary">
										Send Email Change Link
									</button>
								</form>
							</Stack>
						</Box>

						<!-- Change Shared Password -->
						<Box variant="subtle" padding="lg" radius="md" class="subsection-box">
							<Stack gap="md">
								<Stack gap="3xs">
									<span class="input-label">Change Shared Band Password</span>
									<p class="text-muted subtext-small">
										Rotate your band login password anytime band lineup or access changes.
									</p>
								</Stack>

								{#if form?.passwordChanged}
									<Box variant="subtle" padding="sm" radius="md" class="success-box">
										Shared band password updated.
									</Box>
								{/if}

								{#if form?.passwordError}
									<Box variant="subtle" padding="sm" radius="md" class="error-box">
										{form.passwordError}
									</Box>
								{/if}

								<form data-stack="gap:sm" method="POST" action="?/changePassword" use:enhance>
									<Stack gap="3xs">
										<label for="pwCurrent" class="input-label">Current Password</label>
										<input
											id="pwCurrent"
											type="password"
											name="currentPassword"
											required
											autocomplete="current-password"
											placeholder="Current password"
											class="field-input"
										/>
									</Stack>
									<Stack gap="3xs">
										<label for="pwNew" class="input-label">New Password (8+ chars)</label>
										<input
											id="pwNew"
											type="password"
											name="newPassword"
											required
											minlength="8"
											autocomplete="new-password"
											placeholder="New password"
											class="field-input"
										/>
									</Stack>
									<Stack gap="3xs">
										<label for="pwConfirm" class="input-label">Confirm New Password</label>
										<input
											id="pwConfirm"
											type="password"
											name="confirmNewPassword"
											required
											minlength="8"
											autocomplete="new-password"
											placeholder="Repeat new password"
											class="field-input"
										/>
									</Stack>
									<Cluster as="label" align="center" gap="xs" class="pointer-cursor">
										<input type="checkbox" name="revokeOtherSessions" value="true" checked />
										<span class="checkbox-label">Sign out all other band devices</span>
									</Cluster>
									<button type="submit" class="btn-secondary">
										Update Band Password
									</button>
								</form>
							</Stack>
						</Box>
					</Split>
				</Stack>
			</Box>

			<!-- Close Artist Account Section (EDGE-CASES.md) -->
			<Box as="section" variant="raised" padding="xl" radius="lg" class="danger-card">
				<Stack gap="md">
					<Stack gap="2xs">
						<span class="text-support eyebrow-small">DANGER ZONE · ACCOUNT CLOSURE</span>
						<h2 class="box-section-title">Close Artist Account</h2>
						<p class="text-muted subtext-small">
							Closing your artist account archives all of your Issues in read-only mode, disables payouts, revokes active sessions, and displays <strong>"This artist has left Quire."</strong> on <span class="font-mono">/a/{data.artist.slug}</span>. Your handle remains reserved to prevent impersonation, and fans keep all of their collected Stubs.
						</p>
					</Stack>

					{#if form?.closeError}
						<Box variant="subtle" padding="sm" radius="md" class="error-box">
							{form.closeError}
						</Box>
					{/if}

					<form data-stack="gap:md" method="POST" action="?/closeAccount" use:enhance>
						<Split ratio="1-1" gap="md" collapse="sm">
							<Stack gap="xs">
								<label for="closePassword" class="input-label">Confirm Shared Band Password</label>
								<input
									id="closePassword"
									type="password"
									name="confirmPassword"
									required
									autocomplete="current-password"
									placeholder="Enter band password"
									class="field-input"
								/>
							</Stack>
							<Stack gap="xs">
								<label for="closePhrase" class="input-label">Type CLOSE to confirm</label>
								<input
									id="closePhrase"
									type="text"
									name="confirmPhrase"
									required
									pattern="CLOSE"
									placeholder="CLOSE"
									class="field-input font-mono"
								/>
							</Stack>
						</Split>

						<button type="submit" class="btn-save">
							Close Artist Account
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
	}

	:global(.settings-canvas) {
		padding-block: var(--space-xl);
	}

	.eyebrow-small {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
	}

	.settings-title {
		font-size: var(--text-heading);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.settings-subtitle {
		font-size: var(--text-ui);
	}

	:global(.settings-card),
	:global(.subsection-box) {
		border-color: var(--glass-border);
	}

	:global(.danger-card) {
		border-color: rgba(255, 42, 109, 0.45);
	}

	:global(.success-box) {
		border-color: var(--highlight);
		color: var(--highlight);
		font-size: var(--text-small);
	}

	:global(.warning-box) {
		border-color: rgba(250, 204, 21, 0.45);
		color: #fde68a;
		font-size: var(--text-small);
	}

	:global(.info-box) {
		border-color: rgba(5, 217, 232, 0.35);
		color: #bae6fd;
		font-size: var(--text-small);
	}

	:global(.error-box) {
		border-color: var(--support);
		color: var(--support);
		font-size: var(--text-small);
	}



	.box-section-title {
		font-weight: var(--weight-bold);
		font-size: var(--text-body);
		color: #ffffff;
	}

	.subtext-small {
		font-size: var(--text-body);
		line-height: var(--leading-body);
	}

	.input-label {
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		color: #d4d2df;
	}

	.account-id-pill {
		font-size: var(--text-meta);
		color: var(--highlight);
		background: rgba(1, 255, 195, 0.08);
		border: 1px solid rgba(1, 255, 195, 0.25);
		border-radius: var(--radius-sm);
		padding-block: var(--space-3xs);
		padding-inline: var(--space-2xs);
	}







	.venmo-url {
		font-size: var(--text-small);
		overflow-wrap: anywhere;
		color: #e4e4e7;
	}

	.test-link {
		align-self: flex-start;
		text-decoration: none;
	}

	.field-input {
		inline-size: 100%;
		padding-block: var(--space-xs);
		padding-inline: var(--space-xs);
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		font-size: var(--text-body);
	}

	.font-mono {
		font-family: var(--font-mono);
	}

	:global(.pointer-cursor) {
		cursor: pointer;
	}

	.checkbox-label {
		font-size: var(--text-small);
		color: #e4e4e7;
	}

	.btn-save {
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
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
		border: 1px solid var(--glass-border-hover);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
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
		gap: var(--space-2xs);
		padding-block: var(--space-3xs);
		padding-inline: var(--space-xs);
		border-radius: 4px;
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		font-family: var(--font-mono);
		letter-spacing: var(--tracking-label);
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
