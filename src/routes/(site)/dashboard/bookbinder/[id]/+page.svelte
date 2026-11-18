<script lang="ts">
	import { enhance } from '$app/forms';
	import { Box, Stack, Cluster, Split } from '$lib/components/layout';
	import QrCaseDisplay from '$lib/components/dashboard/QrCaseDisplay.svelte';
	import { optimizeFileInputFilesOnChange } from '$lib/utils/image-optimize';
	import PhotoPileEditor from '$lib/components/dashboard/PhotoPileEditor.svelte';
	import { MAX_PHOTOS_PER_PAGE, resolvePhotoEntries } from '$domain/photo-pile';

	import FeatureNotice from '$lib/components/site/FeatureNotice.svelte';

	let { data, form } = $props();

	let previewIframe = $state<HTMLIFrameElement | null>(null);
	let showQrSticker = $state(false);
	let caseDisplayOpen = $state(false);
	let newKind = $state<'text' | 'setlist' | 'photo' | 'audio' | 'video'>('text');

	function refreshPreview() {
		if (previewIframe) {
			previewIframe.src = previewIframe.src;
		}
	}

	function enhanceAndRefresh() {
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			refreshPreview();
		};
	}

	function parsePageContent(jsonStr: string): {
		title?: string;
		body?: string;
		songs?: string[];
		imageUrl?: string;
		photos?: unknown;
		audioUrl?: string;
		videoUrl?: string;
		embedUrl?: string;
		duration?: string;
	} {
		try {
			return JSON.parse(jsonStr || '{}');
		} catch {
			return {};
		}
	}
</script>

<svelte:head>
	<title>Bookbinder: {data.issue.city} — Split-Screen Editor | Quire</title>
</svelte:head>

<div class="bookbinder-workbench" style="--accent: {data.artist.accentColor || '#05D9E8'};">
	<!-- LEFT PANE: MODULAR BLOCK BUILDER -->
	<Stack as="main" gap="lg" class="editor-pane">
		<header class="cover-header">
			<Cluster align="center" gap="xs">
				<a href="/dashboard" class="btn-back-dashboard">← Dashboard</a>
				<span class="meta-chip meta-highlight">Desktop Bookbinder</span>
			</Cluster>
			<Cluster align="center" gap="xs">
				<button
					type="button"
					class="btn-action-accent"
					onclick={() => (showQrSticker = !showQrSticker)}
				>
					Venue QR Sticker
				</button>
				<a href="/i/{data.issue.slug}" target="_blank" class="btn-action-highlight">
					Open Live Zine ↗
				</a>
			</Cluster>
		</header>

		<Stack gap="2xs">
			<h1 class="bookbinder-title">
				Designing: {data.issue.city} @ {data.issue.venue}
			</h1>
			<p class="text-muted subtext-small">
				Edit cover metadata, lifecycle status, and bespoke zine pages. Saves update the live mobile preview on the right.
			</p>
		</Stack>

		{#if form?.error}
			<Box variant="subtle" padding="sm" radius="md" class="error-banner-box">
				{form.error}
			</Box>
		{/if}

		<!-- Collapsible Issue Venue QR Sticker (SPEC.md §4) -->
		{#if showQrSticker && data.issueQrSvg}
			<Box as="section" variant="raised" padding="lg" radius="lg" class="qr-card-box">
				<Cluster justify="between" align="center" gap="lg">
					<Stack gap="xs">
						<span class="text-highlight font-mono eyebrow-small">ISSUE VENUE STICKER</span>
						<h2 class="card-title">{data.issue.city} ({data.issue.date})</h2>
						<p class="text-muted subtext-small">
							Scanning this QR inside the 48-hour Stamp Window ({data.issue.timezone}) grants fans an authenticated attendance stub.
						</p>
						<Cluster gap="xs">
							<button
								type="button"
								class="btn-action-accent"
								onclick={() => (caseDisplayOpen = true)}
							>
								Full-Screen Case Display
							</button>
							<a
								href="data:image/svg+xml;utf8,{encodeURIComponent(data.issueQrSvg)}"
								download="quire-sticker-{data.issue.slug}.svg"
								class="btn-action-support"
							>
								Download Sticker SVG
							</a>
							<a
								href="/scan/{data.issue.slug}?k={data.issue.secretKey}"
								target="_blank"
								class="btn-action-highlight"
							>
								Test Scan Route ↗
							</a>
						</Cluster>
					</Stack>

					<div class="sticker-badge">
						<div class="sticker-caption">SCAN AT GIG</div>
						<div class="sticker-qr-svg">
							{@html data.issueQrSvg}
						</div>
						<div class="sticker-caption">{data.issue.city}</div>
					</div>
				</Cluster>
			</Box>
		{/if}

		<!-- Cover & Lifecycle Block -->
		<Box as="section" variant="raised" padding="lg" radius="lg" class="block-card">
			<Stack gap="md">
				<Cluster justify="between" align="center">
					<h2 class="card-title">Page 1: Cover & Issue Lifecycle</h2>
					<span class="meta-chip meta-highlight">{data.issue.status.toUpperCase()}</span>
				</Cluster>

				<form data-stack="gap:md" method="POST" action="?/save" use:enhance={enhanceAndRefresh}>
					<Split ratio="1-1" gap="md" collapse="sm">
						<Stack gap="xs">
							<label for="city" class="input-label-sm">City</label>
							<input
								id="city"
								type="text"
								name="city"
								value={data.issue.city}
								required
								class="bookbinder-input"
							/>
						</Stack>

						<Stack gap="xs">
							<label for="venue" class="input-label-sm">Venue / Busking Spot</label>
							<input
								id="venue"
								type="text"
								name="venue"
								value={data.issue.venue}
								required
								class="bookbinder-input"
							/>
						</Stack>
					</Split>

					<Split ratio="1-1" gap="md" collapse="sm">
						<Stack gap="xs">
							<label for="date" class="input-label-sm">Gig Date (Updates 48h Stamp Window)</label>
							<input
								id="date"
								type="date"
								name="date"
								value={data.issue.date}
								required
								class="bookbinder-input font-mono"
							/>
						</Stack>

						<Stack gap="xs">
							<label for="status" class="input-label-sm">Issue Lifecycle Status</label>
							<select
								id="status"
								name="status"
								value={data.issue.status}
								class="bookbinder-input"
							>
								<option value="draft">Draft</option>
								<option value="published">Published (Live)</option>
								<option value="cancelled">Cancelled (Shows Cancelled Label)</option>
								<option value="archived">Archived (Hidden from Back Page, Stubs Kept)</option>
							</select>
						</Stack>
					</Split>

					<Stack gap="xs">
						<label for="coverNote" class="input-label-sm">One-Line Cover Note</label>
						<textarea
							id="coverNote"
							name="coverNote"
							rows="2"
							class="bookbinder-input"
						>{data.issue.coverNote}</textarea>
					</Stack>

					<Cluster as="label" align="center" gap="xs" class="checkbox-row">
						<input
							type="checkbox"
							name="approveFirst"
							value="true"
							checked={Boolean(data.issue.approveFirst)}
						/>
						<span class="subtext-small">
							Require artist approval before Wall notes go live on this Issue
						</span>
					</Cluster>

					<Cluster justify="end">
						<button type="submit" class="btn-action-highlight">
							Save Cover & Status
						</button>
					</Cluster>
				</form>
			</Stack>
		</Box>

		<!-- Bespoke Pages Stack (Structured Editors, Zero Raw JSON) -->
		<Stack as="section" gap="md">
			<Cluster justify="between" align="center">
				<h2 class="card-title">Bespoke Gig Pages ({data.pages.length})</h2>
				<span class="text-muted font-mono sequence-label">
					Cover → Bespoke → Master Template → Wall → Endpaper
				</span>
			</Cluster>

			{#each data.pages as page, idx}
				{@const parsed = parsePageContent(page.contentJson)}
				<Box as="article" variant="raised" padding="lg" radius="lg" class="block-card">
					<Stack gap="md">
						<Cluster justify="between" align="center">
							<span class="meta-chip meta-accent">
								Page {idx + 2}: {page.kind.toUpperCase()}
							</span>

							<Cluster align="center" gap="xs">
								{#if idx > 0}
									<form method="POST" action="?/movePage" use:enhance={enhanceAndRefresh}>
										<input type="hidden" name="pageId" value={page.id} />
										<input type="hidden" name="direction" value="up" />
										<button type="submit" class="btn-order-action" title="Move page earlier">
											↑ Up
										</button>
									</form>
								{/if}
								{#if idx + 1 < data.pages.length}
									<form method="POST" action="?/movePage" use:enhance={enhanceAndRefresh}>
										<input type="hidden" name="pageId" value={page.id} />
										<input type="hidden" name="direction" value="down" />
										<button type="submit" class="btn-order-action" title="Move page later">
											↓ Down
										</button>
									</form>
								{/if}
								<form method="POST" action="?/deletePage" use:enhance={enhanceAndRefresh}>
									<input type="hidden" name="pageId" value={page.id} />
									<button type="submit" class="btn-delete-action">
										✕ Remove
									</button>
								</form>
							</Cluster>
						</Cluster>

						<!-- Structured Block Edit Form -->
						<form
							data-stack="gap:sm"
							method="POST"
							action="?/updatePage"
							enctype="multipart/form-data"
							use:enhance={enhanceAndRefresh}
						>
							<input type="hidden" name="pageId" value={page.id} />
							<input type="hidden" name="kind" value={page.kind} />

							{#if page.kind === 'setlist'}
								<Stack gap="xs">
									<label for="title-{page.id}" class="input-label-sm">Setlist Heading</label>
									<input
										id="title-{page.id}"
										type="text"
										name="title"
										value={parsed.title || "Tonight's Setlist"}
										class="bookbinder-input"
									/>
								</Stack>
								<Stack gap="xs">
									<label for="songs-{page.id}" class="input-label-sm">
										Songs (One per line or comma-separated)
									</label>
									<textarea
										id="songs-{page.id}"
										name="songs"
										rows="4"
										class="bookbinder-input font-mono"
									>{(parsed.songs || []).join('\n')}</textarea>
								</Stack>
							{:else if page.kind === 'photo'}
								<Stack gap="xs">
									<label for="title-{page.id}" class="input-label-sm">Photo Story Headline</label>
									<input
										id="title-{page.id}"
										type="text"
										name="title"
										value={parsed.title || 'Tour Diary'}
										class="bookbinder-input"
									/>
								</Stack>
								{#key page.contentJson}
									<PhotoPileEditor
										pageId={page.id}
										initial={resolvePhotoEntries(parsed)}
										uploadsEnabled={data.features.uploads}
										mode={data.features.mode}
									/>
								{/key}
								<Stack gap="xs">
									<label for="body-{page.id}" class="input-label-sm">Caption / Story</label>
									<textarea
										id="body-{page.id}"
										name="body"
										rows="2"
										class="bookbinder-input"
									>{parsed.body || ''}</textarea>
								</Stack>
							{:else if page.kind === 'audio'}
								<Split ratio="2-1" gap="sm" collapse="sm">
									<Stack gap="xs">
										<label for="title-{page.id}" class="input-label-sm">Track Title</label>
										<input
											id="title-{page.id}"
											type="text"
											name="title"
											value={parsed.title || 'Unreleased Demo'}
											class="bookbinder-input"
										/>
									</Stack>
									<Stack gap="xs">
										<label for="dur-{page.id}" class="input-label-sm">Duration</label>
										<input
											id="dur-{page.id}"
											type="text"
											name="duration"
											value={parsed.duration || '03:42'}
											class="bookbinder-input font-mono"
										/>
									</Stack>
								</Split>
								{#if parsed.audioUrl}
									<audio controls preload="metadata" src={parsed.audioUrl} class="editor-audio-preview"></audio>
								{/if}
								<Split ratio="1-1" gap="sm" collapse="sm">
									<Stack gap="xs">
										<label for="audio-file-{page.id}" class="input-label-sm">
											Upload Audio File (MP3, WAV, M4A, OGG)
										</label>
										<input
											id="audio-file-{page.id}"
											type="file"
											disabled={!data.features.uploads}
											name="audioFile"
											accept="audio/mpeg,audio/mp3,audio/mp4,audio/wav,audio/ogg,audio/webm,audio/aac"
											class="bookbinder-input"
										/>
										{#if !data.features.uploads}
											<FeatureNotice feature="uploads" mode={data.features.mode} />
										{/if}
									</Stack>
									<Stack gap="xs">
										<label for="audio-url-{page.id}" class="input-label-sm">Audio URL</label>
										<input
											id="audio-url-{page.id}"
											type="text"
											name="audioUrl"
											value={parsed.audioUrl || ''}
											placeholder="https://... or /uploads/..."
											class="bookbinder-input"
										/>
									</Stack>
								</Split>
								<Stack gap="xs">
									<label for="body-{page.id}" class="input-label-sm">Recording Notes</label>
									<textarea
										id="body-{page.id}"
										name="body"
										rows="2"
										class="bookbinder-input"
									>{parsed.body || ''}</textarea>
								</Stack>
							{:else if page.kind === 'video'}
								<Stack gap="xs">
									<label for="title-{page.id}" class="input-label-sm">Video Headline</label>
									<input
										id="title-{page.id}"
										type="text"
										name="title"
										value={parsed.title || 'Live Video'}
										class="bookbinder-input"
									/>
								</Stack>
								<Stack gap="xs">
									<label for="video-url-{page.id}" class="input-label-sm">
										Video / Embed URL (YouTube, Vimeo, or Bandcamp)
									</label>
									<input
										id="video-url-{page.id}"
										type="text"
										name="videoUrl"
										value={parsed.videoUrl || parsed.embedUrl || ''}
										placeholder="https://www.youtube.com/watch?v=... or Bandcamp URL"
										class="bookbinder-input"
									/>
								</Stack>
								<Stack gap="xs">
									<label for="body-{page.id}" class="input-label-sm">Video Notes / Caption</label>
									<textarea
										id="body-{page.id}"
										name="body"
										rows="2"
										class="bookbinder-input"
									>{parsed.body || ''}</textarea>
								</Stack>
							{:else}
								<Stack gap="xs">
									<label for="title-{page.id}" class="input-label-sm">Page Headline</label>
									<input
										id="title-{page.id}"
										type="text"
										name="title"
										value={parsed.title || 'From the Road'}
										class="bookbinder-input"
									/>
								</Stack>
								<Stack gap="xs">
									<label for="body-{page.id}" class="input-label-sm">Story / Liner Note</label>
									<textarea
										id="body-{page.id}"
										name="body"
										rows="3"
										class="bookbinder-input"
									>{parsed.body || ''}</textarea>
								</Stack>
							{/if}

							<Cluster justify="end">
								<button type="submit" class="btn-action-highlight">
									Save Page Block
								</button>
							</Cluster>
						</form>
					</Stack>
				</Box>
			{/each}

			<!-- Add Bespoke Page Form -->
			<Box as="section" variant="raised" padding="lg" radius="lg" class="block-card">
				<Stack gap="md">
					<h3 class="add-page-title">+ Add Bespoke Page Block</h3>
					<form
						data-stack="gap:sm align:start"
						method="POST"
						action="?/addPage"
						enctype="multipart/form-data"
						use:enhance={enhanceAndRefresh}
					>
						<Split ratio="1-2" gap="sm" collapse="sm" class="w-full">
							<Stack gap="xs">
								<label for="new-kind" class="input-label-sm">Page Type</label>
								<select id="new-kind" name="kind" bind:value={newKind} class="bookbinder-input">
									<option value="text">Road Story / Liner Note</option>
									<option value="setlist">Setlist</option>
									<option value="photo">Photo Story</option>
									<option value="audio">Audio Demo Track</option>
									<option value="video">Video / Embed (YouTube, Vimeo, Bandcamp)</option>
								</select>
							</Stack>

							<Stack gap="xs">
								<label for="new-title" class="input-label-sm">Page Headline</label>
								<input
									id="new-title"
									type="text"
									name="title"
									placeholder={newKind === 'setlist' ? "Tonight's Setlist" : 'From the Van'}
									class="bookbinder-input"
								/>
							</Stack>
						</Split>

						{#if newKind === 'setlist'}
							<Stack gap="xs" class="w-full">
								<label for="new-songs" class="input-label-sm">
									Setlist Songs (Comma or newline separated)
								</label>
								<textarea
									id="new-songs"
									name="songs"
									rows="3"
									placeholder="Static Bloom, Velvet Wire, Subway Static (Encore)"
									class="bookbinder-input font-mono"
								></textarea>
							</Stack>
						{:else if newKind === 'photo'}
							<Split ratio="1-1" gap="sm" collapse="sm" class="w-full">
								<Stack gap="xs">
									<label for="new-photo-file" class="input-label-sm">
										Upload Photos (select several, up to {MAX_PHOTOS_PER_PAGE})
									</label>
									<input
										id="new-photo-file"
										type="file"
										disabled={!data.features.uploads}
										name="photoFile"
										multiple
										accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
										onchange={optimizeFileInputFilesOnChange}
										class="bookbinder-input"
									/>
									{#if !data.features.uploads}
										<FeatureNotice feature="uploads" mode={data.features.mode} />
									{/if}
								</Stack>
								<Stack gap="xs">
									<label for="new-photo-url" class="input-label-sm">Or Photo URL</label>
									<input
										id="new-photo-url"
										type="text"
										name="imageUrl"
										placeholder="https://... or /uploads/..."
										class="bookbinder-input"
									/>
								</Stack>
							</Split>
							<Stack gap="xs" class="w-full">
								<label for="new-photo-body" class="input-label-sm">Photo Caption</label>
								<textarea
									id="new-photo-body"
									name="body"
									rows="2"
									placeholder="Soundcheck in the back room..."
									class="bookbinder-input"
								></textarea>
							</Stack>
						{:else if newKind === 'audio'}
							<Split ratio="1-1" gap="sm" collapse="sm" class="w-full">
								<Stack gap="xs">
									<label for="new-audio-file" class="input-label-sm">Upload Audio File</label>
									<input
										id="new-audio-file"
										type="file"
										disabled={!data.features.uploads}
										name="audioFile"
										accept="audio/mpeg,audio/mp3,audio/mp4,audio/wav,audio/ogg,audio/webm,audio/aac"
										class="bookbinder-input"
									/>
									{#if !data.features.uploads}
										<FeatureNotice feature="uploads" mode={data.features.mode} />
									{/if}
								</Stack>
								<Stack gap="xs">
									<label for="new-audio-url" class="input-label-sm">Or Audio URL</label>
									<input
										id="new-audio-url"
										type="text"
										name="audioUrl"
										placeholder="https://... or /uploads/..."
										class="bookbinder-input"
									/>
								</Stack>
							</Split>
							<Stack gap="xs" class="w-full">
								<label for="new-audio-duration" class="input-label-sm">Duration</label>
								<input
									id="new-audio-duration"
									type="text"
									name="duration"
									value="03:42"
									class="bookbinder-input font-mono"
								/>
							</Stack>
							<Stack gap="xs" class="w-full">
								<label for="new-audio-body" class="input-label-sm">Recording Notes</label>
								<textarea
									id="new-audio-body"
									name="body"
									rows="2"
									placeholder="Recorded live on 4-track cassette..."
									class="bookbinder-input"
								></textarea>
							</Stack>
						{:else if newKind === 'video'}
							<Stack gap="xs" class="w-full">
								<label for="new-video-url" class="input-label-sm">
									Video / Embed URL (YouTube, Vimeo, or Bandcamp)
								</label>
								<input
									id="new-video-url"
									type="text"
									name="videoUrl"
									placeholder="https://www.youtube.com/watch?v=... or Bandcamp URL"
									class="bookbinder-input"
								/>
							</Stack>
							<Stack gap="xs" class="w-full">
								<label for="new-video-body" class="input-label-sm">Video Notes</label>
								<textarea
									id="new-video-body"
									name="body"
									rows="2"
									placeholder="Live session video or tour clip..."
									class="bookbinder-input"
								></textarea>
							</Stack>
						{:else}
							<Stack gap="xs" class="w-full">
								<label for="new-body" class="input-label-sm">Page Copy</label>
								<textarea
									id="new-body"
									name="body"
									rows="3"
									placeholder="Write local shoutouts, liner notes, or a story from the road..."
									class="bookbinder-input"
								></textarea>
							</Stack>
						{/if}

						<button type="submit" class="btn-action-highlight">
							+ Append Page to Zine
						</button>
					</form>
				</Stack>
			</Box>
		</Stack>
	</Stack>

	<!-- RIGHT PANE: STICKY MOBILE DEVICE PREVIEW -->
	<aside class="preview-pane">
		<Stack gap="sm" align="center">
			<span class="text-muted font-mono preview-caption">
				LIVE MOBILE READER PREVIEW (375 × 780)
			</span>
			<div class="device-mockup">
				<iframe
					bind:this={previewIframe}
					src="/i/{data.issue.slug}"
					title="Live Issue Mobile Preview"
				></iframe>
			</div>
		</Stack>
	</aside>
</div>

{#if data.issueQrSvg}
	<QrCaseDisplay
		open={caseDisplayOpen}
		onClose={() => (caseDisplayOpen = false)}
		qrSvg={data.issueQrSvg}
		title="{data.issue.city} @ {data.issue.venue}"
		subtitle="{data.artist.displayName} · {data.issue.date}"
		urlLabel={data.issueUrl || `/i/${data.issue.slug}`}
		accentColor={data.artist.accentColor || '#05D9E8'}
	/>
{/if}

<style>
	.bookbinder-title {
		font-size: var(--text-heading-sm);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.subtext-small {
		font-size: var(--text-body);
		line-height: var(--leading-snug);
	}

	.eyebrow-small {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
	}

	:global(.error-banner-box) {
		border-color: var(--support);
		color: var(--support);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
	}

	:global(.qr-card-box) {
		border-color: var(--accent);
	}

	:global(.block-card) {
		border-color: var(--glass-border);
	}

	.card-title {
		font-size: var(--text-body);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.input-label-sm {
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		color: #d4d2df;
	}

	.bookbinder-input {
		inline-size: 100%;
		padding-block: var(--space-xs);
		padding-inline: var(--space-xs);
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		font-size: var(--text-body);
		font-family: inherit;
	}


	.editor-audio-preview {
		inline-size: 100%;
	}

	.font-mono {
		font-family: var(--font-mono);
	}

	:global(.checkbox-row) {
		cursor: pointer;
	}

	.sequence-label {
		font-size: var(--text-meta);
	}

	.add-page-title {
		font-size: var(--text-ui);
		font-weight: var(--weight-heavy);
		color: var(--highlight);
	}

	.preview-caption {
		font-size: var(--text-meta);
		letter-spacing: var(--tracking-wide);
	}

	/* Sleek Rectangular Navigation & Buttons (Zero 9999px Pills) */
	.btn-back-dashboard {
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

	.btn-back-dashboard:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
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

	.btn-action-highlight {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-compact);
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		border-radius: 6px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		text-decoration: none;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-action-highlight:hover {
		background: rgba(1, 255, 195, 0.24);
		color: var(--highlight);
	}

	.btn-action-support {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		border-radius: 6px;
		background: var(--support);
		color: #ffffff;
		border: 1px solid rgba(255, 42, 109, 0.5);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		text-decoration: none;
		box-shadow: 0 0 16px rgba(255, 42, 109, 0.3);
		transition: transform 0.15s ease;
	}

	.btn-action-support:hover {
		transform: translateY(-1px);
		color: #ffffff;
	}

	.btn-order-action {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-3xs);
		padding-inline: var(--space-xs);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.05);
		color: #e4e4e7;
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-order-action:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.btn-delete-action {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-3xs);
		padding-inline: var(--space-xs);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.04);
		color: #d4d4d8;
		border: 1px solid rgba(255, 255, 255, 0.1);
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.btn-delete-action:hover {
		background: rgba(255, 42, 109, 0.2);
		color: #ffffff;
		border-color: rgba(255, 42, 109, 0.45);
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
</style>
