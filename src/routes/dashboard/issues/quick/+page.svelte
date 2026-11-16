<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	// Default date to today
	let today = new Date().toISOString().split('T')[0];
</script>

<svelte:head>
	<title>Publish Quick Issue (Phone Flow) | Quire</title>
</svelte:head>

<div style="background-color: var(--ink); min-block-size: 100vh; --accent: {data.artist.accentColor || '#05D9E8'};">
	<div data-center style="padding-block: 2rem;" data-stack="lg">
		<header class="cover-header">
			<a href="/dashboard" class="glass-pill text-highlight" style="text-decoration: none;">← Back to Dashboard</a>
			<span class="glass-pill tag-highlight">60-Second Phone Flow</span>
		</header>

		{#if form?.success && form?.qrSvg}
			<!-- SUCCESS SCREEN: VECTOR STICKER ASSET -->
			<div class="glass-panel" style="padding: 2.5rem; text-align: center;" data-stack="lg">
				<div data-stack="xs">
					<span class="tag-highlight glass-pill" style="display: inline-block; margin-inline: auto;">
						✓ Issue Published Live!
					</span>
					<h1 style="font-size: 2rem; font-weight: 800; color: #FFFFFF; margin-block-start: 0.5rem;">
						{form.city} @ {form.venue}
					</h1>
					<p class="text-muted" style="font-size: 0.9rem;">
						Physical QR code generated. Download the vector SVG for your merch sticker.
					</p>
				</div>

				<!-- Sticker Badge Display -->
				<div class="sticker-badge" style="margin-inline: auto;">
					<div class="sticker-caption">SCAN AT GIG</div>
					<div class="sticker-qr-svg">
						{@html form.qrSvg}
					</div>
					<div class="sticker-caption">{data.artist.displayName}</div>
				</div>

				<div data-cluster="center">
					<a
						href="data:image/svg+xml;utf8,{encodeURIComponent(form.qrSvg)}"
						download="quire-sticker-{form.slug}.svg"
						class="floating-tip-btn"
						style="position: static; text-decoration: none; box-shadow: none;"
					>
						⬇ Download Vector Sticker SVG
					</a>

					<a
						href={form.issueUrl}
						class="glass-pill text-highlight"
						style="text-decoration: none; padding: 0.75rem 1.25rem;"
					>
						Open Tonight's Zine ↗
					</a>
				</div>
			</div>
		{:else}
			<div class="glass-panel" style="padding: 2rem;" data-stack="md">
				<div data-stack="xs">
					<h1 style="font-size: 1.8rem; font-weight: 800; color: #FFFFFF;">Publish Tonight's Issue</h1>
					<p class="text-muted" style="font-size: 0.9rem;">
						Enter city and venue. Your master template styling is applied automatically.
					</p>
				</div>

				{#if form?.error}
					<div class="glass-panel" style="padding: 0.75rem; border-color: var(--support); color: var(--support); font-size: 0.85rem;">
						{form.error}
					</div>
				{/if}

				<form method="POST" use:enhance data-stack="md">
					<div data-split style="--split-ratio: 1fr 1fr;">
						<div data-stack="xs">
							<label for="city" style="font-size: 0.8rem; font-weight: 600; color: var(--paper);">City</label>
							<input
								id="city"
								type="text"
								name="city"
								required
								placeholder="e.g. Philadelphia"
								style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem;"
							/>
						</div>

						<div data-stack="xs">
							<label for="venue" style="font-size: 0.8rem; font-weight: 600; color: var(--paper);">Venue</label>
							<input
								id="venue"
								type="text"
								name="venue"
								required
								placeholder="e.g. Johnny Brenda's"
								style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem;"
							/>
						</div>
					</div>

					<div data-split style="--split-ratio: 1fr 1fr;">
						<div data-stack="xs">
							<label for="date" style="font-size: 0.8rem; font-weight: 600; color: var(--paper);">Gig Date</label>
							<input
								id="date"
								type="date"
								name="date"
								value={today}
								required
								style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem;"
							/>
						</div>

						<div data-stack="xs">
							<label for="timezone" style="font-size: 0.8rem; font-weight: 600; color: var(--paper);">Venue Timezone</label>
							<select
								id="timezone"
								name="timezone"
								style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem;"
							>
								<option value="America/New_York">Eastern (US & Canada)</option>
								<option value="America/Chicago">Central (US & Canada)</option>
								<option value="America/Denver">Mountain (US & Canada)</option>
								<option value="America/Los_Angeles">Pacific (US & Canada)</option>
								<option value="Europe/London">London (GMT)</option>
								<option value="UTC">UTC</option>
							</select>
						</div>
					</div>

					<div data-stack="xs">
						<label for="coverNote" style="font-size: 0.8rem; font-weight: 600; color: var(--paper);">Cover Note (Optional)</label>
						<textarea
							id="coverNote"
							name="coverNote"
							rows="2"
							placeholder="e.g. Doors at 8. Playing the new album front to back."
							maxlength="300"
							style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem;"
						></textarea>
					</div>

					<label data-cluster style="cursor: pointer; font-size: 0.85rem; color: var(--paper);">
						<input type="checkbox" name="approveFirst" value="true" />
						<span>Approve Wall notes before they appear publicly</span>
					</label>

					<button
						type="submit"
						class="floating-tip-btn"
						style="position: static; inline-size: 100%; justify-content: center; padding: 1rem; font-size: 1.1rem; box-shadow: none;"
					>
						Publish Issue & Generate QR Sticker →
					</button>
				</form>
			</div>
		{/if}
	</div>
</div>
