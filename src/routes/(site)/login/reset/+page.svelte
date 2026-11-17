<script lang="ts">
	import { enhance } from '$app/forms';
	import { Cover, Center, Box, Stack, Cluster } from '$lib/components/layout';

	let { data, form } = $props();

	const isConfirmMode = $derived(data.mode === 'confirm');
	const activeError = $derived(form?.error ?? data.tokenError);
</script>

<svelte:head>
	<title>{isConfirmMode ? 'Set New Password' : 'Reset Band Password'} | Quire</title>
</svelte:head>

<Cover padding="lg" height={25} class="reset-page-canvas">
	<Center max="sm" padding="none" data-cover-main class="reset-center-wrapper">
		<Stack gap="md">
			<Cluster justify="between" align="center">
				<a href="/login" class="btn-back-link">← Back to Sign In</a>
			</Cluster>

			<Box variant="raised" padding="xl" radius="lg" class="reset-card-shell">
				<Stack gap="lg">
					<Stack as="header" gap="xs" align="center">
						<span class="text-highlight font-mono reset-brand">QUIRE</span>
						<h1 class="reset-title">
							{isConfirmMode ? 'Choose a New Password' : 'Reset Band Password'}
						</h1>
						<p class="text-muted reset-subtext">
							{#if isConfirmMode}
								Enter a new shared password for your artist account.
							{:else}
								Enter your band's shared email and we will send a password reset link.
							{/if}
						</p>
					</Stack>

					{#if activeError}
						<Box padding="sm" radius="md" class="reset-error-box">
							{activeError}
						</Box>
					{/if}

					{#if form?.sent && form?.message}
						<Box padding="md" radius="md" class="reset-success-box">
							<Stack gap="xs">
								<p class="reset-success-text">{form.message}</p>
								<a href="/login" class="text-highlight reset-return-link">
									Return to Artist Sign In
								</a>
							</Stack>
						</Box>
					{:else if isConfirmMode}
						<form data-stack="gap:md" method="POST" action="?/confirm" use:enhance>
							<input type="hidden" name="token" value={data.token} />

							<Stack gap="xs">
								<label for="newPassword" class="reset-label">New Password</label>
								<input
									id="newPassword"
									type="password"
									name="newPassword"
									required
									minlength="8"
									autocomplete="new-password"
									placeholder="At least 8 characters"
									class="reset-input"
								/>
							</Stack>

							<Stack gap="xs">
								<label for="confirmPassword" class="reset-label">Confirm New Password</label>
								<input
									id="confirmPassword"
									type="password"
									name="confirmPassword"
									required
									minlength="8"
									autocomplete="new-password"
									placeholder="Re-enter new password"
									class="reset-input"
								/>
							</Stack>

							<button type="submit" class="btn-reset-submit">
								Update Band Password
							</button>
						</form>
					{:else}
						<form data-stack="gap:md" method="POST" action="?/request" use:enhance>
							<Stack gap="xs">
								<label for="email" class="reset-label">Band Shared Email</label>
								<input
									id="email"
									type="email"
									name="email"
									required
									autocomplete="email"
									value={form?.email ?? ''}
									placeholder="band@example.com"
									class="reset-input"
								/>
							</Stack>

							<button type="submit" class="btn-reset-submit">
								Send Reset Link
							</button>
						</form>
					{/if}

					{#if isConfirmMode && activeError}
						<Cluster justify="center" gap="xs" class="reset-footer-links">
							<a href="/login/reset" class="text-highlight reset-return-link">
								Request a fresh reset link
							</a>
						</Cluster>
					{/if}
				</Stack>
			</Box>
		</Stack>
	</Center>
</Cover>

<style>
	:global(.reset-page-canvas) {
		background-color: var(--bg-void);
	}

	:global(.reset-center-wrapper) {
		inline-size: 100%;
	}

	:global(.reset-card-shell) {
		border-color: var(--glass-border);
	}

	.reset-brand {
		font-size: var(--text-small);
		letter-spacing: var(--tracking-display);
		font-weight: var(--weight-bold);
	}

	.reset-title {
		font-size: var(--text-heading);
		font-weight: var(--weight-heavy);
		color: #ffffff;
		letter-spacing: var(--tracking-snug);
		text-align: center;
	}

	.reset-subtext {
		font-size: var(--text-body);
		text-align: center;
	}

	:global(.reset-error-box) {
		background: rgba(255, 42, 109, 0.15);
		border-color: var(--support);
		color: #ffffff;
		font-size: var(--text-small);
	}

	:global(.reset-success-box) {
		background: rgba(1, 255, 195, 0.12);
		border-color: var(--highlight);
		color: #ffffff;
		font-size: var(--text-ui);
	}

	.reset-success-text {
		margin: 0;
		line-height: var(--leading-body);
	}

	.reset-return-link {
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		text-decoration: underline;
	}

	.reset-label {
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		color: #e4e4e7;
	}

	.reset-input {
		inline-size: 100%;
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		font-size: var(--text-body);
	}

	.btn-back-link {
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
		text-decoration: none;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.btn-back-link:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
	}

	.btn-reset-submit {
		inline-size: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 8px;
		background: var(--support);
		color: #ffffff;
		border: 1px solid rgba(255, 42, 109, 0.5);
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		cursor: pointer;
		box-shadow: 0 0 20px rgba(255, 42, 109, 0.35);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-reset-submit:hover {
		transform: translateY(-1px);
		box-shadow: 0 0 26px rgba(255, 42, 109, 0.6);
	}

	:global(.reset-footer-links) {
		padding-block-start: var(--space-sm);
		border-block-start: 1px solid var(--glass-border);
	}
</style>
