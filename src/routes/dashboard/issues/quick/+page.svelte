<script lang="ts">
	import { enhance } from '$app/forms';
	import { Center, Box, Stack, Cluster, Split } from '$lib/components/layout';

	let { data, form } = $props();

	// Default date to today
	let today = new Date().toISOString().split('T')[0];
</script>

<svelte:head>
	<title>Publish Quick Issue (Phone Flow) | Quire</title>
</svelte:head>

<div class="quick-issue-root" style="--accent: {data.artist.accentColor || '#05D9E8'};">
	<Center max="md" padding="md" class="quick-issue-canvas">
		<Stack gap="lg">
			<header class="cover-header">
				<a href="/dashboard" class="glass-pill text-highlight link-clean">← Back to Dashboard</a>
				<span class="text-highlight header-eyebrow">60-Second Phone Flow</span>
			</header>

			{#if form?.success && form?.qrSvg}
				<!-- SUCCESS SCREEN: VECTOR STICKER ASSET -->
				<Box variant="raised" padding="xl" radius="lg">
					<Stack gap="lg" align="center">
						<Stack gap="xs" align="center">
							<span class="text-highlight success-eyebrow">
								✓ Issue Published Live!
							</span>
							<h1 class="success-title">
								{form.city} @ {form.venue}
							</h1>
							<p class="text-muted subtext-center">
								Physical QR code generated. Download the vector SVG for your merch sticker.
							</p>
						</Stack>

						<!-- Sticker Badge Display -->
						<div class="sticker-badge">
							<div class="sticker-caption">SCAN AT GIG</div>
							<div class="sticker-qr-svg">
								{@html form.qrSvg}
							</div>
							<div class="sticker-caption">{data.artist.displayName}</div>
						</div>

						<Cluster justify="center" gap="sm">
							<a
								href="data:image/svg+xml;utf8,{encodeURIComponent(form.qrSvg)}"
								download="quire-sticker-{form.slug}.svg"
								class="floating-tip-btn btn-static"
							>
								⬇ Download Vector Sticker SVG
							</a>

							<a
								href={form.issueUrl}
								class="glass-pill text-highlight action-open-link"
							>
								Open Tonight's Zine ↗
							</a>
						</Cluster>
					</Stack>
				</Box>
			{:else}
				<Box variant="raised" padding="xl" radius="lg">
					<Stack gap="md">
						<Stack gap="xs">
							<h1 class="form-title">Publish Tonight's Issue</h1>
							<p class="text-muted form-subtitle">
								Enter city and venue. Your master template styling is applied automatically.
							</p>
						</Stack>

						{#if form?.error}
							<Box variant="subtle" padding="sm" radius="md" class="error-box">
								{form.error}
							</Box>
						{/if}

						<form method="POST" use:enhance>
							<Stack gap="md">
								<Split ratio="1-1" gap="md" collapse="sm">
									<Stack gap="xs">
										<label for="city" class="input-label">City</label>
										<input
											id="city"
											type="text"
											name="city"
											required
											placeholder="e.g. Philadelphia"
											class="form-field-input"
										/>
									</Stack>

									<Stack gap="xs">
										<label for="venue" class="input-label">Venue</label>
										<input
											id="venue"
											type="text"
											name="venue"
											required
											placeholder="e.g. Johnny Brenda's"
											class="form-field-input"
										/>
									</Stack>
								</Split>

								<Split ratio="1-1" gap="md" collapse="sm">
									<Stack gap="xs">
										<label for="date" class="input-label">Gig Date</label>
										<input
											id="date"
											type="date"
											name="date"
											value={today}
											required
											class="form-field-input"
										/>
									</Stack>

									<Stack gap="xs">
										<label for="timezone" class="input-label">Venue Timezone</label>
										<select
											id="timezone"
											name="timezone"
											class="form-field-input"
										>
											<option value="America/New_York">Eastern (US & Canada)</option>
											<option value="America/Chicago">Central (US & Canada)</option>
											<option value="America/Denver">Mountain (US & Canada)</option>
											<option value="America/Los_Angeles">Pacific (US & Canada)</option>
											<option value="Europe/London">London (GMT)</option>
											<option value="UTC">UTC</option>
										</select>
									</Stack>
								</Split>

								<Stack gap="xs">
									<label for="coverNote" class="input-label">Cover Note (Optional)</label>
									<textarea
										id="coverNote"
										name="coverNote"
										rows="2"
										placeholder="e.g. Doors at 8. Playing the new album front to back."
										maxlength="300"
										class="form-field-input"
									></textarea>
								</Stack>

								<label class="pointer-cursor">
									<Cluster align="center" gap="xs">
										<input type="checkbox" name="approveFirst" value="true" />
										<span class="checkbox-label">Approve Wall notes before they appear publicly</span>
									</Cluster>
								</label>

								<button
									type="submit"
									class="floating-tip-btn btn-publish"
								>
									Publish Issue & Generate QR Sticker →
								</button>
							</Stack>
						</form>
					</Stack>
				</Box>
			{/if}
		</Stack>
	</Center>
</div>

<style>
	.quick-issue-root {
		background-color: var(--ink);
		min-block-size: 100vh;
	}

	:global(.quick-issue-canvas) {
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

	.success-eyebrow {
		font-size: 0.9rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.success-title {
		font-size: 2rem;
		font-weight: 800;
		color: #ffffff;
		margin-block-start: var(--space-2xs);
		text-align: center;
	}

	.subtext-center {
		font-size: 0.9rem;
		text-align: center;
	}

	.btn-static {
		position: static;
		text-decoration: none;
		box-shadow: none;
	}

	.action-open-link {
		text-decoration: none;
		padding: 0.75rem 1.25rem;
	}

	.form-title {
		font-size: 1.8rem;
		font-weight: 800;
		color: #ffffff;
	}

	.form-subtitle {
		font-size: 0.9rem;
	}

	:global(.error-box) {
		border-color: var(--support);
		color: var(--support);
		font-size: 0.85rem;
	}

	.input-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--paper);
	}

	.form-field-input {
		inline-size: 100%;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		padding: 0.75rem;
	}

	.pointer-cursor {
		cursor: pointer;
	}

	.checkbox-label {
		font-size: 0.85rem;
		color: var(--paper);
	}

	.btn-publish {
		position: static;
		inline-size: 100%;
		justify-content: center;
		padding: 1rem;
		font-size: 1.1rem;
		box-shadow: none;
	}
</style>
