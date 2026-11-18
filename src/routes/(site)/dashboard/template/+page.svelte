<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Container, Box, Stack, Cluster, Split, Grid, Frame } from '$lib/components/layout';
	import ArtistTopNav from '$lib/components/dashboard/ArtistTopNav.svelte';
	import { checkAccentContrast } from '$domain/theme';
	import { optimizeFileInputOnChange } from '$lib/utils/image-optimize';

	import FeatureNotice from '$lib/components/site/FeatureNotice.svelte';

	let { data, form } = $props();

	let accentColor = $state('#05D9E8');
	let typePairing = $state('sans-serif');
	let coverArtUrl = $state('');
	let coverFilePreviewUrl = $state<string | null>(null);
	let preset1 = $state(3);
	let preset2 = $state(5);
	let preset3 = $state(10);
	let editableLinks = $state<Array<{ label: string; url: string }>>([]);
	let newPageKind = $state<'text' | 'audio' | 'photo' | 'video'>('text');
	let editingPageId = $state<string | null>(null);

	const contrastStatus = $derived(checkAccentContrast(accentColor));
	const activeCoverPreview = $derived(coverFilePreviewUrl || coverArtUrl.trim());

	$effect(() => {
		accentColor = data.artist.accentColor || '#05D9E8';
		typePairing = data.artist.typePairing || 'sans-serif';
		coverArtUrl = data.artist.coverArtUrl || '';
		preset1 = data.tipPresets?.[0] ?? 3;
		preset2 = data.tipPresets?.[1] ?? 5;
		preset3 = data.tipPresets?.[2] ?? 10;
		editableLinks =
			data.links?.length > 0
				? [...data.links]
				: [
						{ label: 'Bandcamp', url: 'https://bandcamp.com' },
						{ label: 'Tour Tickets', url: 'https://dice.fm' }
					];
	});

	$effect(() => {
		return () => {
			if (coverFilePreviewUrl) {
				URL.revokeObjectURL(coverFilePreviewUrl);
			}
		};
	});

	async function handleCoverFileChange(event: Event) {
		const file = await optimizeFileInputOnChange(event);
		if (coverFilePreviewUrl) {
			URL.revokeObjectURL(coverFilePreviewUrl);
			coverFilePreviewUrl = null;
		}
		if (file && file.size > 0) {
			coverFilePreviewUrl = URL.createObjectURL(file);
		}
	}

	function addLinkRow() {
		editableLinks = [...editableLinks, { label: '', url: '' }];
	}

	function removeLinkRow(index: number) {
		editableLinks = editableLinks.filter((_, i) => i !== index);
	}

	function parsePageContent(jsonStr: string): {
		title?: string;
		body?: string;
		duration?: string;
		audioUrl?: string;
		imageUrl?: string;
		videoUrl?: string;
	} {
		try {
			return JSON.parse(jsonStr || '{}');
		} catch {
			return {};
		}
	}

	const handleSaveTemplateEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success' && coverFilePreviewUrl) {
				URL.revokeObjectURL(coverFilePreviewUrl);
				coverFilePreviewUrl = null;
			}
		};
	};

	const handleEditPageEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				editingPageId = null;
			}
		};
	};
</script>

<svelte:head>
	<title>Master Template — {data.artist.displayName} | Quire</title>
</svelte:head>

<div class="template-root" style="--accent: {accentColor};">
	<ArtistTopNav artist={data.artist} activeTab="template" />

	<Container as="main" width="md" padding="md" class="template-canvas">
		<Stack gap="xl">
			<Stack gap="xs">
				<span class="text-highlight font-mono eyebrow-small">REUSABLE HOUSE IDENTITY</span>
				<h1 class="template-title">Master Template</h1>
				<p class="text-muted template-subtitle">
					Your cover art, accent color, tip presets, Back Page links, and recurring pages are automatically included in every Issue you publish.
				</p>
			</Stack>

			{#if form?.error}
				<Box variant="subtle" padding="sm" radius="md" class="error-box" role="alert">
					{form.error}
				</Box>
			{/if}

			{#if form?.contrastAdjusted}
				<Box variant="subtle" padding="sm" radius="md" class="warning-box" role="status">
					Accent color {form.adjustedFrom} had low contrast ({form.contrastRatio}:1) against the dark background and was automatically adjusted to {form.adjustedTo} to meet WCAG AA (4.5:1).
				</Box>
			{/if}

			{#if form?.success || form?.pageAdded || form?.pageUpdated || form?.pageMoved || form?.pageDeleted}
				<Box variant="subtle" padding="sm" radius="md" class="success-box" role="status">
					{#if form?.pageAdded}
						Recurring page added to your Master Template.
					{:else if form?.pageUpdated}
						Recurring page updated across your Master Template.
					{:else if form?.pageMoved}
						Recurring page order updated.
					{:else if form?.pageDeleted}
						Recurring page removed from your Master Template.
					{:else}
						Master Template updated and applied across your Issues.
					{/if}
				</Box>
			{/if}

			<!-- MAIN TEMPLATE IDENTITY FORM -->
			<Box as="section" variant="raised" padding="xl" radius="lg" class="section-box">
				<form
					data-stack="gap:lg"
					method="POST"
					action="?/saveTemplate"
					enctype="multipart/form-data"
					use:enhance={handleSaveTemplateEnhance}
				>
					<h2 class="section-heading">Visual Look, Bio & Tip Presets</h2>

					<Split ratio="1-1" gap="md" collapse="sm">
						<Stack gap="xs">
							<label for="accentColor" class="input-label">
								Artist Accent Color (<span class="accent-color-preview font-mono">{accentColor}</span>)
							</label>
							<Cluster align="center" gap="sm">
								<input
									id="accentColor"
									type="color"
									name="accentColor"
									bind:value={accentColor}
									class="color-picker-input"
								/>
								<input
									type="text"
									bind:value={accentColor}
									maxlength={7}
									aria-label="Accent color hex code"
									class="form-field-input hex-code-input font-mono"
								/>
							</Cluster>
							<span class="text-muted subtext-small">
								Highlights tags, borders, and verified artist replies.
							</span>

							{#if contrastStatus.ok}
								<Cluster align="center" gap="xs">
									<span class="contrast-badge contrast-pass font-mono">
										{contrastStatus.ratio}:1 WCAG AA Pass
									</span>
								</Cluster>
							{:else}
								<Cluster align="center" gap="xs">
									<span class="contrast-badge contrast-warn font-mono">
										Low contrast ({contrastStatus.ratio}:1) — suggested {contrastStatus.suggestedHex}
									</span>
									<button
										type="button"
										class="btn-action-accent"
										onclick={() => (accentColor = contrastStatus.suggestedHex)}
									>
										Apply Accessible Color
									</button>
								</Cluster>
							{/if}
						</Stack>

						<Stack gap="xs">
							<label for="typePairing" class="input-label">Typography Pairing</label>
							<select
								id="typePairing"
								name="typePairing"
								bind:value={typePairing}
								class="form-field-input"
							>
								<option value="sans-serif">Inter — Clean Studio Sans (Default)</option>
								<option value="serif">Georgia — Editorial Print Serif</option>
								<option value="mono">Monospace — DIY Tape Label</option>
							</select>
						</Stack>
					</Split>

					<Stack gap="sm">
						<span class="input-label">Default Cover Art</span>
						<Split ratio="1-2" gap="md" collapse="sm">
							<Box variant="subtle" padding="xs" radius="md" class="cover-preview-box">
								{#if activeCoverPreview}
									<Frame ratio="1-1" class="cover-preview-frame">
										<img
											src={activeCoverPreview}
											alt="Master template cover art preview"
											class="cover-preview-img"
										/>
									</Frame>
								{:else}
									<Frame ratio="1-1" class="cover-preview-frame cover-preview-empty">
										<span class="text-muted font-mono subtext-small">No cover art set</span>
									</Frame>
								{/if}
							</Box>

							<Stack gap="sm">
								<Stack gap="3xs">
									<label for="coverArtFile" class="subtext-small text-muted">
										Upload Cover Image (JPEG, PNG, WebP, AVIF, max 10 MB)
									</label>
									<input
										id="coverArtFile"
										type="file"
										disabled={!data.features.uploads}
										name="coverArtFile"
										accept="image/jpeg,image/png,image/webp,image/avif"
										onchange={handleCoverFileChange}
										class="form-field-input file-field-input"
									/>
									{#if !data.features.uploads}
										<FeatureNotice feature="uploads" mode={data.features.mode} />
									{/if}
								</Stack>

								<Stack gap="3xs">
									<label for="coverArtUrl" class="subtext-small text-muted">
										Or Cover Art Image URL
									</label>
									<input
										id="coverArtUrl"
										type="text"
										inputmode="url"
										name="coverArtUrl"
										bind:value={coverArtUrl}
										placeholder="https://images.unsplash.com/... or /uploads/..."
										class="form-field-input"
									/>
								</Stack>
							</Stack>
						</Split>
					</Stack>

					<Stack gap="xs">
						<label for="bio" class="input-label">Band Bio (Shown on Back Page)</label>
						<textarea
							id="bio"
							name="bio"
							rows="3"
							class="form-field-input"
						>{data.artist.bio}</textarea>
					</Stack>

					<!-- 1-Tap Tip Presets (Human numeric fields, zero raw JSON) -->
					<Stack gap="xs">
						<span class="input-label">1-Tap Tip Presets ($2 – $500 USD)</span>
						<Grid min="xs" gap="sm">
							<Stack gap="3xs">
								<label for="preset1" class="subtext-small text-muted">Preset 1 ($)</label>
								<input
									id="preset1"
									type="number"
									name="preset1"
									min="2"
									max="500"
									bind:value={preset1}
									class="form-field-input font-mono"
								/>
							</Stack>
							<Stack gap="3xs">
								<label for="preset2" class="subtext-small text-muted">Preset 2 ($)</label>
								<input
									id="preset2"
									type="number"
									name="preset2"
									min="2"
									max="500"
									bind:value={preset2}
									class="form-field-input font-mono"
								/>
							</Stack>
							<Stack gap="3xs">
								<label for="preset3" class="subtext-small text-muted">Preset 3 ($)</label>
								<input
									id="preset3"
									type="number"
									name="preset3"
									min="2"
									max="500"
									bind:value={preset3}
									class="form-field-input font-mono"
								/>
							</Stack>
						</Grid>
					</Stack>

					<!-- Back Page Links Builder -->
					<Stack gap="sm">
						<Cluster justify="between" align="center">
							<span class="input-label">Back Page Links (Bandcamp, Tickets, Merch, Socials)</span>
							<button type="button" class="btn-action-accent" onclick={addLinkRow}>
								+ Add Link
							</button>
						</Cluster>

						<Stack gap="xs">
							{#each editableLinks as link, idx}
								<Cluster align="center" gap="xs" class="link-row">
									<input
										type="text"
										name="linkLabel"
										bind:value={link.label}
										placeholder="Label (e.g. Bandcamp)"
										class="form-field-input link-label-input"
									/>
									<input
										type="url"
										name="linkUrl"
										bind:value={link.url}
										placeholder="https://..."
										class="form-field-input link-url-input"
									/>
									<button
										type="button"
										class="btn-remove-row"
										aria-label="Remove link row"
										onclick={() => removeLinkRow(idx)}
									>
										Remove
									</button>
								</Cluster>
							{/each}
						</Stack>
					</Stack>

					<button type="submit" class="btn-save-primary">
						Save Master Template
					</button>
				</form>
			</Box>

			<!-- RECURRING MASTER TEMPLATE PAGES (Included in every Issue per SPEC.md §5.2 & §6.1) -->
			<Box as="section" variant="raised" padding="xl" radius="lg" class="section-box">
				<Stack gap="lg">
					<Cluster justify="between" align="center">
						<Stack gap="3xs">
							<h2 class="section-heading">
								Recurring Zine Pages ({data.templatePages.length})
							</h2>
							<p class="text-muted subtext-small">
								Automatically appended after each Issue's bespoke gig pages and before the Wall.
							</p>
						</Stack>
						<span class="meta-chip meta-highlight">Auto-Included</span>
					</Cluster>

					{#if data.templatePages.length === 0}
						<Box variant="subtle" padding="md" radius="md">
							<p class="text-muted subtext-small">No recurring pages yet. Add a Liner Note, Audio Demo, Photo, or Video below.</p>
						</Box>
					{:else}
						<Stack gap="sm">
							{#each data.templatePages as tPage, idx (tPage.id)}
								{@const parsed = parsePageContent(tPage.contentJson)}
								<Box as="article" variant="subtle" padding="md" radius="md" class="recurring-page-card">
									<Stack gap="sm">
										<Cluster justify="between" align="center" gap="sm">
											<Cluster align="center" gap="xs">
												<span class="meta-chip meta-accent">
													Recurring #{idx + 1}: {tPage.kind.toUpperCase()}
												</span>
												<strong class="page-card-title">{parsed.title || 'Band Liner Notes'}</strong>
												{#if tPage.kind === 'audio' && parsed.duration}
													<span class="meta-chip">{parsed.duration}</span>
												{/if}
											</Cluster>

											<Cluster align="center" gap="xs">
												{#if idx > 0}
													<form method="POST" action="?/moveTemplatePage" use:enhance>
														<input type="hidden" name="pageId" value={tPage.id} />
														<input type="hidden" name="direction" value="up" />
														<button type="submit" class="btn-order-page" title="Move page up">
															Up
														</button>
													</form>
												{/if}
												{#if idx + 1 < data.templatePages.length}
													<form method="POST" action="?/moveTemplatePage" use:enhance>
														<input type="hidden" name="pageId" value={tPage.id} />
														<input type="hidden" name="direction" value="down" />
														<button type="submit" class="btn-order-page" title="Move page down">
															Down
														</button>
													</form>
												{/if}
												<button
													type="button"
													class="btn-edit-page"
													onclick={() => (editingPageId = editingPageId === tPage.id ? null : tPage.id)}
												>
													{editingPageId === tPage.id ? 'Cancel' : 'Edit'}
												</button>
												<form method="POST" action="?/deleteTemplatePage" use:enhance>
													<input type="hidden" name="pageId" value={tPage.id} />
													<button type="submit" class="btn-remove-page">
														Remove
													</button>
												</form>
											</Cluster>
										</Cluster>

										{#if editingPageId === tPage.id}
											<form
												data-stack="gap:sm"
												method="POST"
												action="?/editTemplatePage"
												enctype="multipart/form-data"
												use:enhance={handleEditPageEnhance}
												class="edit-page-form"
											>
												<input type="hidden" name="pageId" value={tPage.id} />
												<input type="hidden" name="kind" value={tPage.kind} />

												<Stack gap="3xs">
													<label for="edit-title-{tPage.id}" class="subtext-small text-muted">
														Page Headline
													</label>
													<input
														id="edit-title-{tPage.id}"
														type="text"
														name="title"
														value={parsed.title || ''}
														required
														class="form-field-input"
													/>
												</Stack>

												{#if tPage.kind === 'audio'}
													<Split ratio="1-2" gap="sm" collapse="sm">
														<Stack gap="3xs">
															<label for="edit-duration-{tPage.id}" class="subtext-small text-muted">
																Duration
															</label>
															<input
																id="edit-duration-{tPage.id}"
																type="text"
																name="duration"
																value={parsed.duration || '03:42'}
																placeholder="03:42"
																class="form-field-input font-mono"
															/>
														</Stack>
														<Stack gap="3xs">
															<label for="edit-audio-url-{tPage.id}" class="subtext-small text-muted">
																Audio URL or Bandcamp Embed URL
															</label>
															<input
																id="edit-audio-url-{tPage.id}"
																type="text"
																inputmode="url"
																name="audioUrl"
																value={parsed.audioUrl || ''}
																placeholder="https://bandcamp.com/... or /uploads/..."
																class="form-field-input"
															/>
														</Stack>
													</Split>
													<Stack gap="3xs">
														<label for="edit-audio-file-{tPage.id}" class="subtext-small text-muted">
															Or Upload Replacement Audio File (MP3, WAV, M4A, OGG — max 25 MB)
														</label>
														<input
															id="edit-audio-file-{tPage.id}"
															type="file"
															disabled={!data.features.uploads}
															name="audioFile"
															accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,audio/aac"
															class="form-field-input file-field-input"
														/>
														{#if !data.features.uploads}
															<FeatureNotice feature="uploads" mode={data.features.mode} />
														{/if}
													</Stack>
												{:else if tPage.kind === 'photo'}
													<Split ratio="1-1" gap="sm" collapse="sm">
														<Stack gap="3xs">
															<label for="edit-photo-file-{tPage.id}" class="subtext-small text-muted">
																Upload Replacement Photo
															</label>
															<input
																id="edit-photo-file-{tPage.id}"
																type="file"
																disabled={!data.features.uploads}
																name="photoFile"
																accept="image/jpeg,image/png,image/webp,image/avif"
																onchange={optimizeFileInputOnChange}
																class="form-field-input file-field-input"
															/>
															{#if !data.features.uploads}
																<FeatureNotice feature="uploads" mode={data.features.mode} />
															{/if}
														</Stack>
														<Stack gap="3xs">
															<label for="edit-photo-url-{tPage.id}" class="subtext-small text-muted">
																Or Photo Image URL
															</label>
															<input
																id="edit-photo-url-{tPage.id}"
																type="text"
																inputmode="url"
																name="imageUrl"
																value={parsed.imageUrl || ''}
																placeholder="https://... or /uploads/..."
																class="form-field-input"
															/>
														</Stack>
													</Split>
												{:else if tPage.kind === 'video'}
													<Stack gap="3xs">
														<label for="edit-video-url-{tPage.id}" class="subtext-small text-muted">
															Video URL (YouTube, Vimeo, or Bandcamp)
														</label>
														<input
															id="edit-video-url-{tPage.id}"
															type="text"
															inputmode="url"
															name="videoUrl"
															value={parsed.videoUrl || ''}
															placeholder="https://youtube.com/watch?v=..."
															class="form-field-input"
														/>
													</Stack>
												{/if}

												<Stack gap="3xs">
													<label for="edit-body-{tPage.id}" class="subtext-small text-muted">
														Copy / Liner Notes
													</label>
													<textarea
														id="edit-body-{tPage.id}"
														name="body"
														rows="3"
														class="form-field-input"
													>{parsed.body || ''}</textarea>
												</Stack>

												<Cluster justify="end" gap="xs">
													<button
														type="button"
														class="btn-edit-page"
														onclick={() => (editingPageId = null)}
													>
														Cancel
													</button>
													<button type="submit" class="btn-action-primary">
														Save Page Changes
													</button>
												</Cluster>
											</form>
										{:else}
											{#if tPage.kind === 'photo' && parsed.imageUrl}
												<Frame ratio="16/9" class="page-thumb-frame">
													<img
														src={parsed.imageUrl}
														alt={parsed.title || 'Recurring photo page'}
														class="page-thumb-img"
													/>
												</Frame>
											{/if}
											{#if tPage.kind === 'audio' && parsed.audioUrl}
												<p class="text-accent font-mono subtext-small">
													Audio: {parsed.audioUrl}
												</p>
											{/if}
											{#if tPage.kind === 'video' && parsed.videoUrl}
												<p class="text-accent font-mono subtext-small">
													Video: {parsed.videoUrl}
												</p>
											{/if}
											{#if parsed.body}
												<p class="text-muted subtext-small">{parsed.body}</p>
											{/if}
										{/if}
									</Stack>
								</Box>
							{/each}
						</Stack>
					{/if}

					<!-- Add Recurring Page Form -->
					<form
						data-stack="gap:sm align:start"
						method="POST"
						action="?/addTemplatePage"
						enctype="multipart/form-data"
						use:enhance
						class="add-recurring-form"
					>
						<h3 class="subsection-heading">+ Add Recurring Page to Master Template</h3>
						<Split ratio="1-3" gap="sm" collapse="sm" class="w-full">
							<select name="kind" bind:value={newPageKind} class="form-field-input">
								<option value="text">Liner Notes / Bio Story</option>
								<option value="audio">Unreleased Audio Demo</option>
								<option value="photo">Tour Photo Story</option>
								<option value="video">Video Embed (YouTube / Bandcamp)</option>
							</select>
							<input
								type="text"
								name="title"
								required
								placeholder="Page Headline (e.g. Studio Session 04 or Band Story)"
								class="form-field-input"
							/>
						</Split>

						{#if newPageKind === 'audio'}
							<Split ratio="1-2" gap="sm" collapse="sm" class="w-full">
								<Stack gap="3xs">
									<label for="new-audio-duration" class="subtext-small text-muted">
										Track Duration
									</label>
									<input
										id="new-audio-duration"
										type="text"
										name="duration"
										value="03:42"
										placeholder="03:42"
										class="form-field-input font-mono"
									/>
								</Stack>
								<Stack gap="3xs">
									<label for="new-audio-url" class="subtext-small text-muted">
										Audio URL or Bandcamp Embed URL
									</label>
									<input
										id="new-audio-url"
										type="text"
										inputmode="url"
										name="audioUrl"
										placeholder="https://bandcamp.com/... or /uploads/..."
										class="form-field-input"
									/>
								</Stack>
							</Split>
							<Stack gap="3xs" class="w-full">
								<label for="new-audio-file" class="subtext-small text-muted">
									Or Upload Audio File (MP3, WAV, M4A, OGG — max 25 MB)
								</label>
								<input
									id="new-audio-file"
									type="file"
									disabled={!data.features.uploads}
									name="audioFile"
									accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,audio/aac"
									class="form-field-input file-field-input"
								/>
								{#if !data.features.uploads}
									<FeatureNotice feature="uploads" mode={data.features.mode} />
								{/if}
							</Stack>
						{:else if newPageKind === 'photo'}
							<Split ratio="1-1" gap="sm" collapse="sm" class="w-full">
								<Stack gap="3xs">
									<label for="new-photo-file" class="subtext-small text-muted">
										Upload Photo (JPEG, PNG, WebP, AVIF — max 10 MB)
									</label>
									<input
										id="new-photo-file"
										type="file"
										disabled={!data.features.uploads}
										name="photoFile"
										accept="image/jpeg,image/png,image/webp,image/avif"
										onchange={optimizeFileInputOnChange}
										class="form-field-input file-field-input"
									/>
									{#if !data.features.uploads}
										<FeatureNotice feature="uploads" mode={data.features.mode} />
									{/if}
								</Stack>
								<Stack gap="3xs">
									<label for="new-photo-url" class="subtext-small text-muted">
										Or Photo Image URL
									</label>
									<input
										id="new-photo-url"
										type="text"
										inputmode="url"
										name="imageUrl"
										placeholder="https://images.unsplash.com/... or /uploads/..."
										class="form-field-input"
									/>
								</Stack>
							</Split>
						{:else if newPageKind === 'video'}
							<Stack gap="3xs" class="w-full">
								<label for="new-video-url" class="subtext-small text-muted">
									Video URL (YouTube, Vimeo, or Bandcamp)
								</label>
								<input
									id="new-video-url"
									type="text"
									inputmode="url"
									name="videoUrl"
									placeholder="https://youtube.com/watch?v=..."
									class="form-field-input"
								/>
							</Stack>
						{/if}

						<textarea
							name="body"
							rows="2"
							required={newPageKind === 'text'}
							placeholder="Liner notes, gear notes, or story included in every issue..."
							class="form-field-input"
						></textarea>

						<button type="submit" class="btn-action-primary">
							+ Add Recurring Page
						</button>
					</form>
				</Stack>
			</Box>
		</Stack>
	</Container>
</div>

<style>
	.template-root {
		background-color: var(--bg-void);
	}

	:global(.template-canvas) {
		padding-block: var(--space-xl);
	}

	.eyebrow-small {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
	}

	.template-title {
		font-size: var(--text-heading);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.template-subtitle {
		font-size: var(--text-ui);
		line-height: var(--leading-body);
	}

	:global(.section-box) {
		border-color: var(--glass-border);
	}

	.section-heading {
		font-size: var(--text-lead);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.subsection-heading {
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}

	:global(.success-box) {
		border-color: var(--highlight);
		color: var(--highlight);
		font-size: var(--text-small);
	}

	:global(.warning-box) {
		border-color: #fbbf24;
		color: #fde68a;
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

	.accent-color-preview {
		color: var(--accent);
	}

	.color-picker-input {
		inline-size: 56px;
		block-size: 40px;
		background: none;
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.hex-code-input {
		inline-size: 8.5rem;
	}

	.contrast-badge {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-3xs);
		padding-inline: var(--space-2xs);
		border-radius: 4px;
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
	}

	.contrast-pass {
		background: rgba(1, 255, 195, 0.12);
		border: 1px solid rgba(1, 255, 195, 0.35);
		color: var(--highlight);
	}

	.contrast-warn {
		background: rgba(251, 191, 36, 0.12);
		border: 1px solid rgba(251, 191, 36, 0.45);
		color: #fde68a;
	}

	:global(.cover-preview-box) {
		border-color: var(--glass-border);
	}

	:global(.cover-preview-frame) {
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: rgba(0, 0, 0, 0.4);
	}

	:global(.cover-preview-empty) {
		display: grid;
		place-items: center;
		text-align: center;
		padding-block: var(--space-sm);
		padding-inline: var(--space-sm);
	}

	.cover-preview-img {
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
	}

	:global(.page-thumb-frame) {
		max-inline-size: 18rem;
		border-radius: var(--radius-sm);
		overflow: hidden;
		border: 1px solid var(--glass-border);
	}

	.page-thumb-img {
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
	}

	.subtext-small {
		font-size: var(--text-body);
		line-height: var(--leading-snug);
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

	.file-field-input {
		padding-block: var(--space-2xs);
		padding-inline: var(--space-xs);
		font-size: var(--text-body);
	}

	.font-mono {
		font-family: var(--font-mono);
	}

	.link-label-input {
		flex: 1;
	}

	.link-url-input {
		flex: 2;
	}

	/* Sleek Rectangular Buttons & Badges */
	.btn-save-primary {
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

	.btn-save-primary:hover {
		transform: translateY(-1px);
		box-shadow: 0 0 26px rgba(255, 42, 109, 0.55);
	}

	.btn-action-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-compact);
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		border-radius: 8px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-action-primary:hover {
		background: rgba(1, 255, 195, 0.22);
		border-color: rgba(1, 255, 195, 0.7);
	}

	.btn-action-accent {
		display: inline-flex;
		align-items: center;
		gap: var(--space-compact);
		padding-block: var(--space-compact);
		padding-inline: var(--space-xs);
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

	.btn-remove-row {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-xs);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.05);
		color: #a1a1aa;
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.btn-remove-row:hover {
		background: rgba(255, 42, 109, 0.2);
		color: #ffffff;
		border-color: rgba(255, 42, 109, 0.5);
	}

	.btn-order-page,
	.btn-edit-page,
	.btn-remove-page {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-compact);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.05);
		color: #d4d4d8;
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
	}

	.btn-order-page:hover,
	.btn-edit-page:hover {
		background: rgba(5, 217, 232, 0.16);
		color: var(--accent);
		border-color: rgba(5, 217, 232, 0.45);
	}

	.btn-remove-page:hover {
		background: rgba(255, 42, 109, 0.2);
		color: #ffffff;
		border-color: rgba(255, 42, 109, 0.5);
	}

	.meta-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3xs);
		padding-block: var(--space-3xs);
		padding-inline: var(--space-2xs);
		border-radius: 4px;
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		font-family: var(--font-mono);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
	}

	.meta-chip.meta-highlight {
		background: rgba(1, 255, 195, 0.12);
		border: 1px solid rgba(1, 255, 195, 0.35);
		color: var(--highlight);
	}

	.meta-chip.meta-accent {
		background: rgba(5, 217, 232, 0.12);
		border: 1px solid rgba(5, 217, 232, 0.35);
		color: var(--accent);
	}

	:global(.recurring-page-card) {
		border-color: rgba(255, 255, 255, 0.1);
	}

	.page-card-title {
		color: #ffffff;
		font-size: var(--text-ui);
	}

	.edit-page-form {
		padding-block-start: var(--space-sm);
		border-block-start: 1px solid var(--glass-border);
	}

	:global(.add-recurring-form) {
		padding-block-start: var(--space-md);
		border-block-start: 1px solid var(--glass-border);
	}
</style>
