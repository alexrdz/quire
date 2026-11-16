<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let isSignUp = $state(false);
</script>

<svelte:head>
	<title>{isSignUp ? 'Sign Up' : 'Artist Login'} | Quire</title>
</svelte:head>

<div style="background-color: var(--ink); min-block-size: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem;">
	<div class="glass-panel" style="inline-size: 100%; max-inline-size: 420px; padding: 2rem;" data-stack="lg">
		<header data-stack="xs" style="text-align: center;">
			<div class="glass-pill text-highlight" style="display: inline-block; margin-inline: auto;">
				Quire
			</div>
			<h1 style="font-size: 1.8rem; font-weight: 800; color: #FFFFFF; margin-block-start: 0.5rem;">
				{isSignUp ? 'Create Band Account' : 'Artist Login'}
			</h1>
			<p class="text-muted" style="font-size: 0.85rem;">
				One login per artist, shared between bandmates.
			</p>
		</header>

		{#if form?.error}
			<div class="glass-panel" style="padding: 0.75rem; border-color: var(--support); color: var(--support); font-size: 0.85rem; text-align: center;">
				{form.error}
			</div>
		{/if}

		<form
			method="POST"
			action={isSignUp ? `?/signup&redirect=${encodeURIComponent(data.redirectTo)}` : `?/login&redirect=${encodeURIComponent(data.redirectTo)}`}
			use:enhance
			data-stack="md"
		>
			{#if isSignUp}
				<div data-stack="xs">
					<label for="name" style="font-size: 0.8rem; font-weight: 600; color: var(--paper);">Band / Artist Name</label>
					<input
						id="name"
						type="text"
						name="name"
						required
						placeholder="The Neon Velvet"
						style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem;"
					/>
				</div>
			{/if}

			<div data-stack="xs">
				<label for="email" style="font-size: 0.8rem; font-weight: 600; color: var(--paper);">Band Shared Email</label>
				<input
					id="email"
					type="email"
					name="email"
					required
					placeholder="band@example.com"
					style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem;"
				/>
			</div>

			<div data-stack="xs">
				<label for="password" style="font-size: 0.8rem; font-weight: 600; color: var(--paper);">Password</label>
				<input
					id="password"
					type="password"
					name="password"
					required
					placeholder="••••••••••••"
					style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem;"
				/>
			</div>

			<button
				type="submit"
				class="floating-tip-btn"
				style="position: static; inline-size: 100%; justify-content: center; padding: 0.85rem; font-size: 1rem; box-shadow: none;"
			>
				{isSignUp ? 'Create Band Account' : 'Sign In to Dashboard'}
			</button>
		</form>

		<!-- One-Click Demo Mode Button -->
		<div style="border-block-start: 1px solid var(--glass-border); padding-block-start: 1.25rem;" data-stack="sm">
			<a
				href="/demo"
				class="glass-pill text-highlight"
				style="display: block; text-align: center; text-decoration: none; padding: 0.75rem;"
			>
				⚡ Explore Demo Tour as "The Neon Velvet" →
			</a>

			<div data-cluster="center" style="font-size: 0.8rem;">
				<span class="text-muted">{isSignUp ? 'Already have an account?' : 'New artist?'}</span>
				<button
					type="button"
					onclick={() => (isSignUp = !isSignUp)}
					style="background: none; border: none; color: var(--highlight); font-weight: 700; cursor: pointer; text-decoration: underline;"
				>
					{isSignUp ? 'Sign in' : 'Create an account'}
				</button>
			</div>
		</div>
	</div>
</div>
