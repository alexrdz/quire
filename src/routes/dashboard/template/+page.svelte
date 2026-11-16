<script lang="ts">
	import { enhance } from '$app/forms';
	import { Center, Box, Stack, Cluster } from '$lib/components/layout';

	let { data, form } = $props();

	let accentColor = $state('#05D9E8');
	let typePairing = $state('sans-serif');

	$effect(() => {
		accentColor = data.artist.accentColor || '#05D9E8';
		typePairing = data.artist.typePairing || 'sans-serif';
	});
</script>

<svelte:head>
	<title>Master Template Editor | Quire</title>
</svelte:head>

<div class="template-root" style="--accent: {accentColor};">
	<Center max="md" padding="md" class="template-canvas">
		<Stack gap="lg">
			<header class="cover-header">
				<a href="/dashboard" class="glass-pill text-highlight link-clean">← Back to Dashboard</a>
				<span class="glass-pill tag-accent">Master Template</span>
			</header>

			<Box variant="raised" padding="xl" radius="lg">
				<Stack gap="md">
					<Stack gap="xs">
						<h1 class="template-title">
							Master Template Styling
						</h1>
						<p class="text-muted template-subtitle">
							Platform law (Decision 16): House dark glass aesthetic stays fixed. Artists customize `--accent`, typography pairing, and recurring bio.
						</p>
					</Stack>

					{#if form?.success}
						<Box variant="subtle" padding="sm" radius="md" class="success-box">
							✓ Master Template updated successfully!
						</Box>
					{/if}

					<form method="POST" use:enhance>
						<Stack gap="md">
							<!-- Accent Color Picker -->
							<Stack gap="xs">
								<label for="accentColor" class="input-label">
									Custom Artist Accent Color (<span style="color: {accentColor};">{accentColor}</span>)
								</label>
								<Cluster align="center" gap="sm">
									<input
										id="accentColor"
										type="color"
										name="accentColor"
										bind:value={accentColor}
										class="color-picker-input"
									/>
									<span class="text-muted subtext-small">
										Used for tags, borders, and bespoke page highlights across every issue.
									</span>
								</Cluster>
							</Stack>

							<!-- Typography Pairing -->
							<Stack gap="xs">
								<label for="typePairing" class="input-label">
									Typography Pairing
								</label>
								<select
									id="typePairing"
									name="typePairing"
									bind:value={typePairing}
									class="form-field-input"
								>
									<option value="sans-serif">Modern Sans / Bold Industrial (Default)</option>
									<option value="serif">Literary Serif / Unbleached Print</option>
									<option value="mono">Raw Monospace / DIY Xerox</option>
								</select>
							</Stack>

							<!-- Bio -->
							<Stack gap="xs">
								<label for="bio" class="input-label">
									Band Bio (Included on Back Page & Issues)
								</label>
								<textarea
									id="bio"
									name="bio"
									rows="3"
									class="form-field-input"
								>{data.artist.bio}</textarea>
							</Stack>

							<!-- Tip Presets JSON -->
							<Stack gap="xs">
								<label for="tipPresetsJson" class="input-label">
									1-Tap Tip Presets (JSON Array in USD $)
								</label>
								<input
									id="tipPresetsJson"
									type="text"
									name="tipPresetsJson"
									value={data.artist.tipPresetsJson || '[3, 5, 10, 20]'}
									class="form-field-input font-mono"
								/>
							</Stack>

							<button
								type="submit"
								class="floating-tip-btn btn-save"
							>
								Save Master Template
							</button>
						</Stack>
					</form>
				</Stack>
			</Box>
		</Stack>
	</Center>
</div>

<style>
	.template-root {
		background-color: var(--ink);
		min-block-size: 100vh;
	}

	:global(.template-canvas) {
		padding-block: var(--space-xl);
	}

	.link-clean {
		text-decoration: none;
	}

	.template-title {
		font-size: 1.8rem;
		font-weight: 800;
		color: #ffffff;
	}

	.template-subtitle {
		font-size: 0.9rem;
	}

	:global(.success-box) {
		border-color: var(--highlight);
		color: var(--highlight);
		font-size: 0.85rem;
	}

	.input-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--paper);
	}

	.subtext-small {
		font-size: 0.8rem;
	}

	.color-picker-input {
		inline-size: 50px;
		block-size: 40px;
		border: none;
		background: none;
		cursor: pointer;
	}

	.form-field-input {
		inline-size: 100%;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		padding: 0.75rem;
	}

	.font-mono {
		font-family: var(--font-mono);
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
