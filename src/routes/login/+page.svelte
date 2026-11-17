<script lang="ts">
	import { enhance } from '$app/forms';
	import { normalizeArtistSlug } from '$domain/theme';
	import { Cover, Center, Box, Stack, Cluster } from '$lib/components/layout';

	let { data, form } = $props();

	let roleOverride = $state<'artist' | 'fan' | null>(null);
	let modeOverride = $state<'login' | 'signup' | null>(null);

	let bandName = $state('');
	let artistSlug = $state('');
	let slugManuallyEdited = $state(false);
	let emailValue = $state('');
	let showPetitionForm = $state(false);

	const activeRole = $derived(roleOverride ?? data.defaultRole);
	const isSignUp = $derived(
		modeOverride !== null
			? modeOverride === 'signup'
			: form?.mode
				? form.mode === 'signup'
				: data.initialMode === 'signup'
	);

	const previewSlug = $derived(
		normalizeArtistSlug(artistSlug || bandName) || 'your-band-name'
	);

	const slugSuggestions = $derived(
		form && 'slugSuggestions' in form && Array.isArray(form.slugSuggestions)
			? form.slugSuggestions
			: []
	);

	const collidedSlug = $derived(
		form && 'collidedSlug' in form && typeof form.collidedSlug === 'string'
			? form.collidedSlug
			: ''
	);

	const petitionError = $derived(
		form && 'petitionError' in form && typeof form.petitionError === 'string'
			? form.petitionError
			: ''
	);

	const petitionSubmitted = $derived(
		Boolean(form && 'petitionSubmitted' in form && form.petitionSubmitted)
	);

	const petitionedSlug = $derived(
		form && 'petitionedSlug' in form && typeof form.petitionedSlug === 'string'
			? form.petitionedSlug
			: ''
	);

	$effect(() => {
		if (petitionError) {
			showPetitionForm = true;
		}
	});

	$effect(() => {
		if (form?.values) {
			if ('name' in form.values && typeof form.values.name === 'string') {
				bandName = form.values.name;
			}
			if ('slug' in form.values && typeof form.values.slug === 'string') {
				artistSlug = form.values.slug;
				slugManuallyEdited = true;
			}
			if ('email' in form.values && typeof form.values.email === 'string') {
				emailValue = form.values.email;
			}
		}
	});

	function handleBandNameInput(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		bandName = value;
		if (!slugManuallyEdited) {
			artistSlug = normalizeArtistSlug(value);
		}
	}

	function handleSlugInput(event: Event) {
		const raw = (event.currentTarget as HTMLInputElement).value;
		const cleaned = raw
			.toLowerCase()
			.replace(/[^a-z0-9-]+/g, '-')
			.replace(/-{2,}/g, '-');
		artistSlug = cleaned;
		slugManuallyEdited = cleaned.trim().length > 0;
	}

	function handleSlugBlur() {
		if (artistSlug.trim().length > 0) {
			artistSlug = normalizeArtistSlug(artistSlug);
		} else {
			slugManuallyEdited = false;
			artistSlug = normalizeArtistSlug(bandName);
		}
	}

	function selectSlugSuggestion(suggestion: string) {
		artistSlug = suggestion;
		slugManuallyEdited = true;
	}

	function toggleAuthMode() {
		modeOverride = isSignUp ? 'login' : 'signup';
	}
</script>

<svelte:head>
	<title
		>{activeRole === 'fan'
			? 'Fan Sign In'
			: isSignUp
				? 'Create Band Account'
				: 'Artist Sign In'} | Quire</title
	>
</svelte:head>

<Cover padding="lg" height={100} class="login-page-canvas">
	<Center max="sm" padding="none" data-cover-main class="login-center-wrapper">
		<Stack gap="md">
			<Cluster justify="between" align="center">
				<a href="/" class="btn-back-link">← Quire Home</a>
			</Cluster>

			<Box variant="raised" padding="xl" radius="lg" class="login-card-shell">
				<Stack gap="lg">
					<Stack as="header" gap="xs" align="center">
						<span class="text-highlight font-mono login-brand">QUIRE</span>
						<h1 class="login-title">
							{#if activeRole === 'fan'}
								Fan Sign In
							{:else if isSignUp}
								Create Band Account
							{:else}
								Artist Sign In
							{/if}
						</h1>
						<p class="text-muted login-subtext">
							{#if activeRole === 'fan'}
								Sign in with Google to post on Walls, save zines, and claim your gig stubs.
							{:else}
								One login per Artist, shared among bandmates.
							{/if}
						</p>
					</Stack>

					<!-- Role Switcher Tabs -->
					<Cluster
						distributeEqually
						gap="2xs"
						class="role-tabs"
						role="tablist"
						aria-label="Account Type"
					>
						<button
							type="button"
							role="tab"
							aria-selected={activeRole === 'artist'}
							class="role-tab {activeRole === 'artist' ? 'is-active' : ''}"
							onclick={() => (roleOverride = 'artist')}
						>
							Artist / Band
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={activeRole === 'fan'}
							class="role-tab {activeRole === 'fan' ? 'is-active' : ''}"
							onclick={() => (roleOverride = 'fan')}
						>
							Fan (Google)
						</button>
					</Cluster>

					{#if data.accountClosed && !form?.error}
						<Box padding="sm" radius="md" class="login-success-box">
							Your artist account has been closed. Your issues remain archived in read-only mode and fans keep their Stubs.
						</Box>
					{/if}

					{#if data.resetSuccess && !form?.error}
						<Box padding="sm" radius="md" class="login-success-box">
							Password updated. Sign in below with your new band password.
						</Box>
					{/if}

					{#if petitionSubmitted}
						<Box padding="sm" radius="md" class="login-success-box">
							Petition received for <span class="font-mono">/a/{petitionedSlug}</span>. We sent a confirmation to <span class="font-mono">{emailValue}</span> and will review your claim. You can also choose an available handle above to start right away.
						</Box>
					{/if}

					{#if form?.error}
						<Box padding="sm" radius="md" class="login-error-box">
							{form.error}
						</Box>
					{/if}

					{#if activeRole === 'fan'}
						<form data-stack="gap:md" method="POST" action="?/googleSignIn" use:enhance>
							<input type="hidden" name="redirectTo" value={data.redirectTo} />
							<button type="submit" class="google-auth-btn">
								<svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true">
									<path
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
										fill="#4285F4"
									/>
									<path
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
										fill="#34A853"
									/>
									<path
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
										fill="#FBBC05"
									/>
									<path
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
										fill="#EA4335"
									/>
								</svg>
								<span>Continue with Google</span>
							</button>
						</form>
					{:else}
						<form
							data-stack="gap:md"
							method="POST"
							action={isSignUp
								? data.hasExplicitRedirect
									? `?/signup&redirect=${encodeURIComponent(data.redirectTo)}`
									: '?/signup'
								: data.hasExplicitRedirect
									? `?/login&redirect=${encodeURIComponent(data.redirectTo)}`
									: '?/login'}
							use:enhance
						>
							{#if data.hasExplicitRedirect}
								<input type="hidden" name="redirectTo" value={data.redirectTo} />
							{/if}

							{#if isSignUp}
								<Stack gap="xs">
									<label for="name" class="login-label">Band / Artist Name</label>
									<input
										id="name"
										type="text"
										name="name"
										required
										value={bandName}
										oninput={handleBandNameInput}
										placeholder="e.g. The Neon Velvet"
										class="login-input"
									/>
								</Stack>

								<Stack gap="xs">
									<label for="slug" class="login-label">
										Artist Handle (Permanent QR URL)
									</label>
									<div class="slug-input-group">
										<span class="slug-prefix font-mono">/a/</span>
										<input
											id="slug"
											type="text"
											name="slug"
											required
											minlength="2"
											maxlength="60"
											pattern="[a-z0-9]+(-[a-z0-9]+)*"
											value={artistSlug}
											oninput={handleSlugInput}
											onblur={handleSlugBlur}
											placeholder="the-neon-velvet"
											aria-describedby="slug-preview-hint"
											class="slug-input font-mono"
										/>
									</div>
									<p id="slug-preview-hint" class="slug-hint text-muted">
										Baked into your permanent Artist QR sticker:
										<span class="text-highlight font-mono">/a/{previewSlug}</span>
									</p>

									{#if slugSuggestions.length > 0}
										<Stack gap="2xs" class="slug-suggestions-wrap">
											<span class="slug-suggestions-label">Available alternatives:</span>
											<Cluster gap="xs">
												{#each slugSuggestions as suggestion}
													<button
														type="button"
														class="slug-suggestion-btn font-mono"
														onclick={() => selectSlugSuggestion(suggestion)}
													>
														/a/{suggestion}
													</button>
												{/each}
											</Cluster>
										</Stack>
									{/if}
								</Stack>
							{/if}

							<Stack gap="xs">
								<label for="email" class="login-label">Band Shared Email</label>
								<input
									id="email"
									type="email"
									name="email"
									required
									autocomplete="email"
									bind:value={emailValue}
									placeholder="band@example.com"
									class="login-input"
								/>
							</Stack>

							<Stack gap="xs">
								<Cluster justify="between" align="center">
									<label for="password" class="login-label">Password</label>
									{#if !isSignUp}
										<a href="/login/reset" class="forgot-password-link">
											Forgot password?
										</a>
									{/if}
								</Cluster>
								<input
									id="password"
									type="password"
									name="password"
									required
									minlength={isSignUp ? 8 : 1}
									autocomplete={isSignUp ? 'new-password' : 'current-password'}
									placeholder={isSignUp ? 'At least 8 characters' : 'Enter band password'}
									class="login-input"
								/>
							</Stack>

							<button type="submit" class="btn-band-submit">
								{isSignUp ? 'Create Band Account' : 'Sign In to Dashboard'}
							</button>
						</form>

						{#if isSignUp && collidedSlug && !petitionSubmitted}
							<Box variant="subtle" padding="md" radius="md" class="petition-panel">
								<Stack gap="sm">
									<Cluster justify="between" align="center" gap="xs">
										<span class="petition-title">
											Petition for <span class="text-highlight font-mono">/a/{collidedSlug}</span>
										</span>
										<button
											type="button"
											class="btn-petition-toggle"
											onclick={() => (showPetitionForm = !showPetitionForm)}
										>
											{showPetitionForm ? 'Hide Form' : 'Request Handle Review'}
										</button>
									</Cluster>
									<p class="slug-hint text-muted">
										If you are the rightful band and the current owner of <span class="font-mono">/a/{collidedSlug}</span> is inactive or closed, submit a handle-claim petition for review.
									</p>

									{#if petitionError}
										<Box padding="sm" radius="md" class="login-error-box">
											{petitionError}
										</Box>
									{/if}

									{#if showPetitionForm}
										<form data-stack="gap:sm" method="POST" action="?/petitionSlug" use:enhance>
											<input type="hidden" name="requestedSlug" value={collidedSlug} />
											<Stack gap="3xs">
												<label for="petitionerName" class="login-label">Your Band / Artist Name</label>
												<input
													id="petitionerName"
													type="text"
													name="petitionerName"
													required
													value={bandName}
													placeholder="e.g. The Neon Velvet"
													class="login-input"
												/>
											</Stack>
											<Stack gap="3xs">
												<label for="petitionerEmail" class="login-label">Contact Email</label>
												<input
													id="petitionerEmail"
													type="email"
													name="petitionerEmail"
													required
													value={emailValue}
													placeholder="band@example.com"
													class="login-input"
												/>
											</Stack>
											<Stack gap="3xs">
												<label for="evidenceUrl" class="login-label">
													Official Link (Bandcamp, Spotify, or Website — Optional)
												</label>
												<input
													id="evidenceUrl"
													type="url"
													name="evidenceUrl"
													placeholder="https://yourband.bandcamp.com"
													class="login-input"
												/>
											</Stack>
											<Stack gap="3xs">
												<label for="rationale" class="login-label">Why should this handle transfer to you?</label>
												<textarea
													id="rationale"
													name="rationale"
													required
													minlength="15"
													rows="3"
													placeholder="Explain your band's claim and why the existing account appears inactive..."
													class="login-input"
												></textarea>
											</Stack>
											<button type="submit" class="btn-petition-submit">
												Submit Handle Petition
											</button>
										</form>
									{/if}
								</Stack>
							</Box>
						{/if}

						<Cluster justify="center" gap="xs" class="toggle-cluster">
							<span class="text-muted">
								{isSignUp ? 'Already have an account?' : 'New artist?'}
							</span>
							<button
								type="button"
								onclick={toggleAuthMode}
								class="text-highlight toggle-action-btn"
							>
								{isSignUp ? 'Sign in instead' : 'Create band account'}
							</button>
						</Cluster>
					{/if}
				</Stack>
			</Box>
		</Stack>
	</Center>
</Cover>

<style>
	:global(.login-page-canvas) {
		background-color: var(--bg-void);
	}

	:global(.login-center-wrapper) {
		inline-size: 100%;
	}

	:global(.login-card-shell) {
		border-color: var(--glass-border);
	}

	.login-brand {
		font-size: 0.85rem;
		letter-spacing: 0.15em;
		font-weight: 700;
	}

	.login-title {
		font-size: 1.85rem;
		font-weight: 800;
		color: #ffffff;
		letter-spacing: -0.02em;
	}

	.login-subtext {
		font-size: 0.9rem;
		text-align: center;
	}

	:global(.role-tabs) {
		background: rgba(0, 0, 0, 0.45);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		padding: 0.25rem;
	}

	.role-tab {
		padding-block: 0.55rem;
		padding-inline: 0.75rem;
		border-radius: var(--radius-sm);
		border: none;
		background: transparent;
		color: var(--ink-muted);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.role-tab.is-active {
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
	}

	:global(.login-error-box) {
		background: rgba(255, 42, 109, 0.15);
		border-color: var(--support);
		color: #ffffff;
		font-size: 0.85rem;
	}

	:global(.login-success-box) {
		background: rgba(1, 255, 195, 0.12);
		border-color: var(--highlight);
		color: #ffffff;
		font-size: 0.85rem;
	}

	.login-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #e4e4e7;
	}

	.forgot-password-link {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--highlight);
		text-decoration: underline;
	}

	.login-input {
		inline-size: 100%;
		padding-block: 0.75rem;
		padding-inline: 1rem;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		font-size: 0.95rem;
	}

	.slug-input-group {
		display: flex;
		align-items: stretch;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.slug-input-group:focus-within {
		border-color: var(--highlight);
	}

	.slug-prefix {
		display: inline-flex;
		align-items: center;
		padding-inline-start: 0.9rem;
		padding-inline-end: 0.35rem;
		color: var(--ink-muted);
		background: rgba(255, 255, 255, 0.04);
		border-inline-end: 1px solid var(--glass-border);
		font-size: 0.88rem;
	}

	.slug-input {
		flex: 1;
		min-inline-size: 0;
		padding-block: 0.75rem;
		padding-inline: 0.75rem;
		background: transparent;
		border: none;
		color: #ffffff;
		font-size: 0.92rem;
	}

	.slug-input:focus {
		outline: none;
	}

	.slug-hint {
		margin: 0;
		font-size: 0.76rem;
		line-height: 1.4;
	}

	:global(.slug-suggestions-wrap) {
		padding-block-start: 0.25rem;
	}

	.slug-suggestions-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #e4e4e7;
	}

	.slug-suggestion-btn {
		padding-block: 0.3rem;
		padding-inline: 0.65rem;
		border-radius: 9999px;
		border: 1px solid rgba(1, 255, 195, 0.35);
		background: rgba(1, 255, 195, 0.1);
		color: var(--highlight);
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.slug-suggestion-btn:hover {
		background: rgba(1, 255, 195, 0.22);
		border-color: var(--highlight);
	}

	.google-auth-btn {
		inline-size: 100%;
		block-size: 3rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		background: #ffffff;
		color: #090710;
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.92rem;
		font-weight: 700;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.google-auth-btn:hover {
		background: #e4e4e7;
	}

	.google-icon {
		inline-size: 1.25rem;
		block-size: 1.25rem;
	}

	.btn-back-link {
		display: inline-flex;
		align-items: center;
		padding-block: 0.4rem;
		padding-inline: 0.8rem;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.05);
		color: #e4e4e7;
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: 0.78rem;
		font-weight: 600;
		text-decoration: none;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.btn-back-link:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
	}

	.btn-band-submit {
		inline-size: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: 0.85rem;
		padding-inline: 1.5rem;
		border-radius: 8px;
		background: var(--support);
		color: #ffffff;
		border: 1px solid rgba(255, 42, 109, 0.5);
		font-size: 0.92rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 0 20px rgba(255, 42, 109, 0.35);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-band-submit:hover {
		transform: translateY(-1px);
		box-shadow: 0 0 26px rgba(255, 42, 109, 0.6);
	}

	:global(.toggle-cluster) {
		font-size: 0.85rem;
		padding-block-start: var(--space-sm);
		border-block-start: 1px solid var(--glass-border);
	}

	.toggle-action-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-weight: 600;
		text-decoration: underline;
	}

	:global(.petition-panel) {
		border-color: rgba(5, 217, 232, 0.35);
	}

	.petition-title {
		font-size: 0.85rem;
		font-weight: 700;
		color: #ffffff;
	}

	.btn-petition-toggle {
		padding-block: 0.3rem;
		padding-inline: 0.65rem;
		border-radius: 6px;
		background: rgba(5, 217, 232, 0.12);
		border: 1px solid rgba(5, 217, 232, 0.35);
		color: var(--accent);
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
	}

	.btn-petition-submit {
		inline-size: 100%;
		padding-block: 0.7rem;
		padding-inline: 1rem;
		border-radius: 8px;
		background: rgba(1, 255, 195, 0.14);
		border: 1px solid rgba(1, 255, 195, 0.45);
		color: var(--highlight);
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
	}

	.btn-petition-submit:hover {
		background: rgba(1, 255, 195, 0.24);
	}
</style>
