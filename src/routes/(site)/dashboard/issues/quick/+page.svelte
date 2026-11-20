<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { Container, Box, Stack, Cluster, Split } from '$lib/components/layout';
	import ArtistTopNav from '$lib/components/dashboard/ArtistTopNav.svelte';
	import QrCaseDisplay from '$lib/components/dashboard/QrCaseDisplay.svelte';
	import { optimizeFileInputOnChange } from '$lib/utils/image-optimize';
	import { MAX_PHOTO_CAPTION_LENGTH } from '$domain/photo-pile';

	import FeatureNotice from '$lib/components/site/FeatureNotice.svelte';

	let { data, form } = $props();

	const BASE_TIMEZONES = [
		{ value: 'America/New_York', label: 'Eastern (America/New_York)' },
		{ value: 'America/Chicago', label: 'Central (America/Chicago)' },
		{ value: 'America/Denver', label: 'Mountain (America/Denver)' },
		{ value: 'America/Los_Angeles', label: 'Pacific (America/Los_Angeles)' },
		{ value: 'Europe/London', label: 'UK (Europe/London)' },
		{ value: 'Europe/Berlin', label: 'Central Europe (Europe/Berlin)' }
	];

	let today = new Date().toISOString().split('T')[0];

	let city = $state('');
	let venue = $state('');
	let date = $state(today);
	let timezone = $state('America/New_York');
	let extraTimezones = $state<Array<{ value: string; label: string }>>([]);
	let timezoneOptions = $derived([...BASE_TIMEZONES, ...extraTimezones]);
	let timezoneTouched = $state(false);

	let coverNote = $state('');
	let setlistSongs = $state('');
	let photoUrl = $state('');
	let photoCaption = $state('');
	let approveFirst = $state(false);
	let duplicatedBanner = $state(false);
	let caseDisplayOpen = $state(false);

	function ensureTimezoneOption(tz: string, prefix = '') {
		if (!tz) return;
		const exists = BASE_TIMEZONES.some((t) => t.value === tz) || extraTimezones.some((t) => t.value === tz);
		if (!exists) {
			extraTimezones = [
				...extraTimezones,
				{ value: tz, label: prefix ? `${prefix} (${tz})` : tz }
			];
		}
	}

	onMount(() => {
		try {
			const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (detected && !timezoneTouched) {
				ensureTimezoneOption(detected, 'Detected');
				timezone = detected;
			}
		} catch {
			// Retain default timezone if Intl detection is unavailable
		}
	});

	function duplicateLastIssue() {
		if (!data.lastIssue) return;
		// SPEC.md §6.2: "Duplicate last issue" copies everything except city and date
		venue = data.lastIssue.venue;
		timezoneTouched = true;
		ensureTimezoneOption(data.lastIssue.timezone);
		timezone = data.lastIssue.timezone;
		coverNote = data.lastIssue.coverNote;
		setlistSongs = data.lastIssue.setlist;
		approveFirst = Boolean(data.lastIssue.approveFirst);
		duplicatedBanner = true;
	}
</script>

<svelte:head>
	<title>Publish Quick Issue (Phone Flow) | Quire</title>
</svelte:head>

<div class="quick-issue-root" style="--accent: {data.artist.accentColor || '#05D9E8'};">
	<ArtistTopNav artist={data.artist} activeTab="quick" />

	<Container as="main" width="md" padding="md" class="quick-issue-canvas">
		<Stack gap="lg">
			{#if form?.success && form?.qrSvg}
				<!-- SUCCESS SCREEN: VECTOR STICKER ASSET -->
				<Box as="section" variant="raised" padding="xl" radius="lg" class="card-shell">
					<Stack gap="lg" align="center">
						<Stack gap="xs" align="center">
							<span class="meta-chip meta-highlight">✓ Issue Published Live</span>
							<h1 class="success-title">
								{form.city} @ {form.venue}
							</h1>
							<p class="text-muted subtext-center">
								Physical QR code generated. Download the vector SVG for your merch sticker or prop this screen up next to your case.
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
							<button
								type="button"
								class="btn-action-accent"
								onclick={() => (caseDisplayOpen = true)}
							>
								Full-Screen Case Display
							</button>

							<a
								href="data:image/svg+xml;utf8,{encodeURIComponent(form.qrSvg)}"
								download="quire-sticker-{form.slug}.svg"
								class="btn-action-primary"
							>
								Download Vector Sticker SVG
							</a>

							<a href={form.issueUrl} class="btn-action-highlight">
								Open Tonight's Zine ↗
							</a>

							{#if form.issueId}
								<a href="/dashboard/bookbinder/{form.issueId}" class="btn-action-ghost">
									Polish in Bookbinder →
								</a>
							{/if}
						</Cluster>
					</Stack>
				</Box>

				<QrCaseDisplay
					open={caseDisplayOpen}
					onClose={() => (caseDisplayOpen = false)}
					qrSvg={form.qrSvg}
					title="{form.city} @ {form.venue}"
					subtitle="{data.artist.displayName} · {form.date}"
					urlLabel={form.fullIssueUrl || form.issueUrl}
					accentColor={data.artist.accentColor || '#05D9E8'}
				/>
			{:else}
				<Box as="section" variant="raised" padding="xl" radius="lg" class="card-shell">
					<Stack gap="lg">
						<Cluster justify="between" align="center" gap="md">
							<Stack gap="2xs">
								<span class="text-highlight font-mono eyebrow-small">60-SECOND PHONE FLOW</span>
								<h1 class="form-title">Publish Tonight's Issue</h1>
								<p class="text-muted form-subtitle">
									Enter city, venue, and date. Your Master Template pages, links, Wall, and Endpaper are included automatically.
								</p>
							</Stack>

							{#if data.lastIssue}
								<button
									type="button"
									class="btn-action-accent"
									onclick={duplicateLastIssue}
								>
									Duplicate Last Issue ({data.lastIssue.city})
								</button>
							{/if}
						</Cluster>

						{#if duplicatedBanner}
							<Box variant="subtle" padding="sm" radius="md" class="duplicated-box">
								✓ Copied venue, time zone, cover note, and setlist from {data.lastIssue?.city}. Enter tonight’s city & date to publish!
							</Box>
						{/if}

						{#if form?.error}
							<Box variant="subtle" padding="sm" radius="md" class="error-box">
								{form.error}
							</Box>
						{/if}

						<form data-stack="gap:md" method="POST" enctype="multipart/form-data" use:enhance>
							<Split ratio="1-1" gap="md" collapse="sm">
								<Stack gap="xs">
									<label for="city" class="input-label">City *</label>
									<input
										id="city"
										type="text"
										name="city"
										bind:value={city}
										required
										placeholder="e.g. Philadelphia"
										class="form-field-input"
									/>
								</Stack>

								<Stack gap="xs">
									<label for="venue" class="input-label">Venue or Busking Spot *</label>
									<input
										id="venue"
										type="text"
										name="venue"
										bind:value={venue}
										required
										placeholder="e.g. Johnny Brenda's"
										class="form-field-input"
									/>
								</Stack>
							</Split>

							<Split ratio="1-1" gap="md" collapse="sm">
								<Stack gap="xs">
									<label for="date" class="input-label">Gig Date *</label>
									<input
										id="date"
										type="date"
										name="date"
										bind:value={date}
										required
										class="form-field-input font-mono"
									/>
								</Stack>

								<Stack gap="xs">
									<label for="timezone" class="input-label">Venue Time Zone</label>
									<select
										id="timezone"
										name="timezone"
										bind:value={timezone}
										onchange={() => (timezoneTouched = true)}
										class="form-field-input"
									>
										{#each timezoneOptions as tzOption}
											<option value={tzOption.value}>{tzOption.label}</option>
										{/each}
									</select>
								</Stack>
							</Split>

							<Stack gap="xs">
								<label for="coverNote" class="input-label">One-Line Cover Note (Optional)</label>
								<input
									id="coverNote"
									type="text"
									name="coverNote"
									bind:value={coverNote}
									maxlength="280"
									placeholder="e.g. Playing till 10pm! First 20 people at merch get a sticker."
									class="form-field-input"
								/>
							</Stack>

							<Stack gap="xs">
								<label for="setlistSongs" class="input-label">
									Tonight's Setlist (Optional — comma or newline separated)
								</label>
								<textarea
									id="setlistSongs"
									name="setlistSongs"
									bind:value={setlistSongs}
									rows="2"
									placeholder="Static Bloom, Velvet Wire, Subway Static (Encore)"
									class="form-field-input font-mono"
								></textarea>
							</Stack>

							<Box variant="subtle" padding="md" radius="md" class="photo-optional-box">
								<Stack gap="sm">
									<span class="input-label">Optional Gig Photo (Upload from phone or paste URL)</span>
									<Split ratio="1-1" gap="md" collapse="sm">
										<Stack gap="xs">
											<label for="photoFile" class="subtext-small text-muted">
												Upload Photo (JPEG, PNG, WebP, AVIF)
											</label>
											<input
												id="photoFile"
												type="file"
												disabled={!data.features.uploads}
												name="photoFile"
												accept="image/jpeg,image/png,image/webp,image/avif"
												onchange={optimizeFileInputOnChange}
												class="form-field-input"
											/>
											{#if !data.features.uploads}
												<FeatureNotice feature="uploads" mode={data.features.mode} />
											{/if}
										</Stack>

										<Stack gap="xs">
											<label for="photoUrl" class="subtext-small text-muted">
												Or Photo URL
											</label>
											<input
												id="photoUrl"
												type="text"
												name="photoUrl"
												bind:value={photoUrl}
												placeholder="https://... or /uploads/..."
												class="form-field-input"
											/>
										</Stack>
									</Split>

									<Stack gap="xs">
										<label for="photoCaption" class="subtext-small text-muted">
											Photo Caption (Optional)
										</label>
										<input
											id="photoCaption"
											type="text"
											name="photoCaption"
											bind:value={photoCaption}
											maxlength={MAX_PHOTO_CAPTION_LENGTH}
											aria-describedby="photoCaption-hint"
											placeholder="e.g. Soundcheck from the balcony"
											class="form-field-input"
										/>
										<span id="photoCaption-hint" class="subtext-small text-muted">
											Written on the back of the photo: fans flip it to read.
										</span>
									</Stack>
								</Stack>
							</Box>

							<Cluster as="label" align="center" gap="xs" class="checkbox-label-wrap">
								<input
									type="checkbox"
									name="approveFirst"
									value="true"
									bind:checked={approveFirst}
								/>
								<span class="checkbox-text">
									Require artist approval before Wall notes go live on this issue
								</span>
							</Cluster>

							<Split ratio="2-1" gap="sm" collapse="sm">
								<button type="submit" name="saveMode" value="published" class="btn-publish-submit">
									Publish Issue & Generate Venue QR →
								</button>
								<button type="submit" name="saveMode" value="draft" class="btn-draft-submit">
									Save Draft & Open in Bookbinder →
								</button>
							</Split>
						</form>
					</Stack>
				</Box>
			{/if}
		</Stack>
	</Container>
</div>

<style>
	.quick-issue-root {
		background-color: var(--bg-void);
	}

	:global(.quick-issue-canvas) {
		padding-block: var(--space-xl);
	}

	:global(.card-shell) {
		border-color: var(--glass-border);
	}

	.eyebrow-small {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
	}

	.success-title {
		font-size: var(--text-title);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.subtext-center {
		text-align: center;
		max-inline-size: 46ch;
		font-size: var(--text-body);
	}

	.form-title {
		font-size: var(--text-heading);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.form-subtitle {
		font-size: var(--text-ui);
		max-inline-size: 55ch;
	}

	:global(.duplicated-box) {
		border-color: var(--accent);
		color: var(--accent);
		font-size: var(--text-small);
	}

	:global(.error-box) {
		border-color: var(--support);
		color: var(--support);
		font-size: var(--text-small);
	}

	.input-label {
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		color: #e4e4e7;
	}

	.form-field-input {
		inline-size: 100%;
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		font-size: var(--text-body);
		font-family: inherit;
	}

	.font-mono {
		font-family: var(--font-mono);
	}

	:global(.checkbox-label-wrap) {
		cursor: pointer;
	}

	.checkbox-text {
		font-size: var(--text-small);
		color: #d4d2df;
	}

	/* Sleek Buttons (No 9999px Pills) */
	.btn-publish-submit {
		inline-size: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-s);
		padding-inline: var(--space-m);
		border-radius: 8px;
		background: var(--support);
		color: #ffffff;
		border: 1px solid rgba(255, 42, 109, 0.5);
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		cursor: pointer;
		box-shadow: 0 0 24px rgba(255, 42, 109, 0.35);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-publish-submit:hover {
		transform: translateY(-1px);
		box-shadow: 0 0 30px rgba(255, 42, 109, 0.6);
	}

	.btn-draft-submit {
		inline-size: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-s);
		padding-inline: var(--space-s);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.06);
		color: #f4f4f0;
		border: 1px solid rgba(255, 255, 255, 0.18);
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-draft-submit:hover {
		background: rgba(255, 255, 255, 0.12);
		border-color: var(--accent);
	}

	:global(.photo-optional-box) {
		border-color: var(--glass-border);
	}

	.subtext-small {
		font-size: var(--text-body);
	}

	.btn-action-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		border-radius: 8px;
		background: var(--support);
		color: #ffffff;
		border: 1px solid rgba(255, 42, 109, 0.5);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-decoration: none;
		box-shadow: 0 0 16px rgba(255, 42, 109, 0.3);
		transition: transform 0.15s ease;
	}

	.btn-action-primary:hover {
		transform: translateY(-1px);
		color: #ffffff;
	}

	.btn-action-highlight {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		border-radius: 8px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-decoration: none;
		transition: background-color 0.15s ease;
	}

	.btn-action-highlight:hover {
		background: rgba(1, 255, 195, 0.24);
		color: var(--highlight);
	}

	.btn-action-ghost {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.05);
		color: #d4d4d8;
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		text-decoration: none;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.btn-action-ghost:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
	}

	.btn-action-accent {
		display: inline-flex;
		align-items: center;
		gap: var(--space-compact);
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		border-radius: 6px;
		background: rgba(5, 217, 232, 0.12);
		color: var(--accent);
		border: 1px solid rgba(5, 217, 232, 0.35);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-action-accent:hover {
		background: rgba(5, 217, 232, 0.22);
	}

	.meta-chip {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-3xs);
		padding-inline: var(--space-2xs);
		border-radius: 4px;
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		font-family: var(--font-mono);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #e4e4e7;
	}

	.meta-chip.meta-highlight {
		background: rgba(1, 255, 195, 0.12);
		border-color: rgba(1, 255, 195, 0.35);
		color: var(--highlight);
	}
</style>
