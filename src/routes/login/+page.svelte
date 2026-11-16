<script lang="ts">
	import { enhance } from '$app/forms';
	import { Center, Box, Stack, Cluster } from '$lib/components/layout';

	let { data, form } = $props();

	let isSignUp = $state(false);
</script>

<svelte:head>
	<title>{isSignUp ? 'Sign Up' : 'Artist Login'} | Quire</title>
</svelte:head>

<div class="login-page-canvas">
	<Center max="xs" padding="sm" class="login-center-wrapper">
		<Box variant="raised" padding="xl" radius="lg" class="login-card-shell">
			<Stack gap="lg">
				<header>
					<Stack gap="xs" align="center">
						<div class="glass-pill text-highlight">
							Quire
						</div>
						<h1 class="login-title">
							{isSignUp ? 'Create Band Account' : 'Artist Login'}
						</h1>
						<p class="text-muted login-subtext">
							One login per artist, shared between bandmates.
						</p>
					</Stack>
				</header>

				{#if form?.error}
					<Box padding="sm" radius="md" class="login-error-box">
						{form.error}
					</Box>
				{/if}

				<form
					method="POST"
					action={isSignUp ? `?/signup&redirect=${encodeURIComponent(data.redirectTo)}` : `?/login&redirect=${encodeURIComponent(data.redirectTo)}`}
					use:enhance
				>
					<Stack gap="md">
						{#if isSignUp}
							<Stack gap="xs">
								<label for="name" class="login-label">Band / Artist Name</label>
								<input
									id="name"
									type="text"
									name="name"
									required
									placeholder="The Neon Velvet"
									class="login-input"
								/>
							</Stack>
						{/if}

						<Stack gap="xs">
							<label for="email" class="login-label">Band Shared Email</label>
							<input
								id="email"
								type="email"
								name="email"
								required
								placeholder="band@example.com"
								class="login-input"
							/>
						</Stack>

						<Stack gap="xs">
							<label for="password" class="login-label">Password</label>
							<input
								id="password"
								type="password"
								name="password"
								required
								placeholder="••••••••••••"
								class="login-input"
							/>
						</Stack>

						<button
							type="submit"
							class="floating-tip-btn btn-full"
						>
							{isSignUp ? 'Create Band Account' : 'Sign In to Dashboard'}
						</button>
					</Stack>
				</form>

				<!-- One-Click Demo Mode Button -->
				<Stack gap="sm" class="demo-section-wrap">
					<a
						href="/demo"
						class="glass-pill text-highlight demo-cta-link"
					>
						⚡ Explore Demo Tour as "The Neon Velvet" →
					</a>

					<Cluster justify="center" gap="xs" class="toggle-cluster">
						<span class="text-muted">{isSignUp ? 'Already have an account?' : 'New artist?'}</span>
						<button
							type="button"
							onclick={() => (isSignUp = !isSignUp)}
							class="text-highlight toggle-action-btn"
						>
							{isSignUp ? 'Sign in instead' : 'Create band account'}
						</button>
					</Cluster>
				</Stack>
			</Stack>
		</Box>
	</Center>
</div>

<style>
	.login-page-canvas {
		background-color: var(--ink);
		min-block-size: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-l);
	}

	:global(.login-center-wrapper) {
		inline-size: 100%;
	}

	:global(.login-card-shell) {
		inline-size: 100%;
	}

	.login-title {
		font-size: 1.8rem;
		font-weight: 800;
		color: #ffffff;
		margin-block-start: var(--space-2xs);
		text-align: center;
	}

	.login-subtext {
		font-size: 0.85rem;
		text-align: center;
	}

	:global(.login-error-box) {
		border-color: var(--support);
		color: var(--support);
		font-size: 0.85rem;
		text-align: center;
		background: rgba(255, 42, 109, 0.1);
	}

	.login-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--paper);
	}

	.login-input {
		inline-size: 100%;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		padding: 0.75rem;
	}

	.btn-full {
		position: static;
		inline-size: 100%;
		justify-content: center;
		padding: 0.85rem;
		font-size: 1rem;
		box-shadow: none;
	}

	:global(.demo-section-wrap) {
		border-block-start: 1px solid var(--glass-border);
		padding-block-start: var(--space-m);
	}

	.demo-cta-link {
		display: block;
		text-align: center;
		text-decoration: none;
		padding: 0.75rem;
	}

	:global(.toggle-cluster) {
		font-size: 0.8rem;
	}

	.toggle-action-btn {
		background: none;
		border: none;
		font-size: 0.8rem;
		cursor: pointer;
		font-weight: 700;
		text-decoration: underline;
	}
</style>
