<script lang="ts">
	import { enhance } from '$app/forms';

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

<div style="background-color: var(--ink); min-block-size: 100vh; --accent: {accentColor};">
	<div data-center style="padding-block: 2rem;" data-stack="lg">
		<header class="cover-header">
			<a href="/dashboard" class="glass-pill text-highlight" style="text-decoration: none;">← Back to Dashboard</a>
			<span class="glass-pill tag-accent">Master Template</span>
		</header>

		<div class="glass-panel" style="padding: 2rem;" data-stack="md">
			<div data-stack="xs">
				<h1 style="font-size: 1.8rem; font-weight: 800; color: #FFFFFF;">
					Master Template Styling
				</h1>
				<p class="text-muted" style="font-size: 0.9rem;">
					Platform law (Decision 16): House dark glass aesthetic stays fixed. Artists customize `--accent`, typography pairing, and recurring bio.
				</p>
			</div>

			{#if form?.success}
				<div class="glass-panel" style="padding: 0.75rem; border-color: var(--highlight); color: var(--highlight); font-size: 0.85rem;">
					✓ Master Template updated successfully!
				</div>
			{/if}

			<form method="POST" use:enhance data-stack="md">
				<!-- Accent Color Picker -->
				<div data-stack="xs">
					<label for="accentColor" style="font-size: 0.8rem; font-weight: 600; color: var(--paper);">
						Custom Artist Accent Color (<span style="color: {accentColor};">{accentColor}</span>)
					</label>
					<div data-cluster>
						<input
							id="accentColor"
							type="color"
							name="accentColor"
							bind:value={accentColor}
							style="inline-size: 50px; block-size: 40px; border: none; background: none; cursor: pointer;"
						/>
						<span class="text-muted" style="font-size: 0.8rem;">
							Used for tags, borders, and bespoke page highlights across every issue.
						</span>
					</div>
				</div>

				<!-- Typography Pairing -->
				<div data-stack="xs">
					<label for="typePairing" style="font-size: 0.8rem; font-weight: 600; color: var(--paper);">
						Typography Pairing
					</label>
					<select
						id="typePairing"
						name="typePairing"
						bind:value={typePairing}
						style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem;"
					>
						<option value="sans-serif">Modern Sans / Bold Industrial (Default)</option>
						<option value="serif">Literary Serif / Unbleached Print</option>
						<option value="mono">Raw Monospace / DIY Xerox</option>
					</select>
				</div>

				<!-- Bio -->
				<div data-stack="xs">
					<label for="bio" style="font-size: 0.8rem; font-weight: 600; color: var(--paper);">
						Band Bio (Included on Back Page & Issues)
					</label>
					<textarea
						id="bio"
						name="bio"
						rows="3"
						style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem;"
					>{data.artist.bio}</textarea>
				</div>

				<!-- Tip Presets JSON -->
				<div data-stack="xs">
					<label for="tipPresetsJson" style="font-size: 0.8rem; font-weight: 600; color: var(--paper);">
						1-Tap Tip Presets (JSON Array in USD $)
					</label>
					<input
						id="tipPresetsJson"
						type="text"
						name="tipPresetsJson"
						value={data.artist.tipPresetsJson || '[3, 5, 10, 20]'}
						style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem; font-family: var(--font-mono);"
					/>
				</div>

				<button
					type="submit"
					class="floating-tip-btn"
					style="position: static; inline-size: 100%; justify-content: center; padding: 0.85rem; font-size: 1rem; box-shadow: none;"
				>
					Save Master Template
				</button>
			</form>
		</div>
	</div>
</div>
