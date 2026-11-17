<script lang="ts">
	import { enhance } from '$app/forms';
	import { Stack, Box, Cluster, Frame } from '$lib/components/layout';
	import PhotoPile from '$lib/components/zine/PhotoPile.svelte';
	import { resolvePhotoEntries } from '$domain/photo-pile';

	let { data, form } = $props();

	// Tip drawer state
	let tipDrawerOpen = $state(false);
	let selectedTipCents = $state(500);
	let customAmountStr = $state('');
	let fanCoveredFees = $state(false);
	let tipMessage = $state('');

	// Auth drawer state (ui-prototype bottom sheet)
	let authDrawerOpen = $state(false);
	let pendingAuthAction = $state<'note' | 'stamp' | 'save' | ''>('');

	// Audio & video player state
	let playingAudioId = $state<string | null>(null);
	let activatedVideos = $state<Record<string, boolean>>({});

	// Wall note state
	let noteBody = $state('');
	let wallMessage = $state('');

	// Restore pending draft from sessionStorage after returning from Google OAuth (SPEC.md §5.5)
	$effect(() => {
		if (typeof window !== 'undefined') {
			const savedDraft = sessionStorage.getItem(`quire_draft_${data.issue.id}`);
			if (savedDraft) {
				noteBody = savedDraft;
				if (data.session?.user) {
					sessionStorage.removeItem(`quire_draft_${data.issue.id}`);
				}
			}
		}
	});

	// Combine bespoke pages + master template recurring pages in sequence (SPEC.md §5.2)
	let contentPages = $derived.by(() => {
		const bespoke = (data.issuePages || []).map((p: { id: string; kind: string; contentJson: string }) => ({
			...p,
			source: 'bespoke' as const
		}));
		const template = (data.templatePages || []).map((p: { id: string; kind: string; contentJson: string }) => ({
			...p,
			source: 'template' as const
		}));
		const combined = [...bespoke, ...template];
		if (combined.length > 0) return combined;
		return [
			{
				id: 'fallback-page',
				kind: 'text',
				source: 'bespoke' as const,
				contentJson: JSON.stringify({
					title: `Tonight at ${data.issue.venue}`,
					body:
						data.issue.coverNote ||
						'Thank you for gathering with us tonight. Read the pages, leave your mark on the Wall, and claim your attendance stub.'
				})
			}
		];
	});

	function parseContent(jsonStr: string): {
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

	type VideoEmbedInfo =
		| { kind: 'youtube'; id: string; embedSrc: string; posterSrc: string; watchUrl: string }
		| { kind: 'vimeo'; id: string; embedSrc: string; watchUrl: string }
		| { kind: 'bandcamp-embed'; embedSrc: string; watchUrl: string }
		| { kind: 'bandcamp-link'; watchUrl: string }
		| { kind: 'video-file'; src: string }
		| { kind: 'external-link'; watchUrl: string }
		| { kind: 'none' };

	function resolveVideoEmbed(rawUrl?: string): VideoEmbedInfo {
		const urlStr = rawUrl?.trim();
		if (!urlStr) return { kind: 'none' };

		if (urlStr.startsWith('/uploads/')) {
			if (/\.(mp4|webm|ogg|mov)$/i.test(urlStr)) {
				return { kind: 'video-file', src: urlStr };
			}
			return { kind: 'external-link', watchUrl: urlStr };
		}

		let parsed: URL;
		try {
			parsed = new URL(urlStr);
		} catch {
			return { kind: 'none' };
		}

		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			return { kind: 'none' };
		}

		const host = parsed.hostname.toLowerCase();

		if (
			host === 'youtu.be' ||
			host === 'youtube.com' ||
			host === 'www.youtube.com' ||
			host === 'm.youtube.com' ||
			host === 'youtube-nocookie.com' ||
			host === 'www.youtube-nocookie.com'
		) {
			let ytId = '';
			if (host === 'youtu.be') {
				ytId = parsed.pathname.slice(1).split('/')[0] || '';
			} else if (parsed.pathname.startsWith('/watch')) {
				ytId = parsed.searchParams.get('v') || '';
			} else {
				const match = parsed.pathname.match(/^\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{6,20})/);
				ytId = match?.[1] || '';
			}
			if (/^[a-zA-Z0-9_-]{6,20}$/.test(ytId)) {
				return {
					kind: 'youtube',
					id: ytId,
					embedSrc: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`,
					posterSrc: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
					watchUrl: urlStr
				};
			}
		}

		if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
			const match = parsed.pathname.match(/^\/(?:video\/)?(\d{5,15})/);
			const vimeoId = match?.[1] || '';
			if (vimeoId) {
				return {
					kind: 'vimeo',
					id: vimeoId,
					embedSrc: `https://player.vimeo.com/video/${vimeoId}?autoplay=1`,
					watchUrl: urlStr
				};
			}
		}

		if (host === 'bandcamp.com' || host.endsWith('.bandcamp.com')) {
			if (parsed.pathname.startsWith('/EmbeddedPlayer')) {
				return { kind: 'bandcamp-embed', embedSrc: urlStr, watchUrl: urlStr };
			}
			return { kind: 'bandcamp-link', watchUrl: urlStr };
		}

		if (/\.(mp4|webm|ogg|mov)$/i.test(parsed.pathname)) {
			return { kind: 'video-file', src: urlStr };
		}

		return { kind: 'external-link', watchUrl: urlStr };
	}

	function handleTipPreset(amount: number) {
		selectedTipCents = amount * 100;
		customAmountStr = '';
	}

	function handleCustomAmountChange(val: string) {
		customAmountStr = val;
		const num = parseFloat(val);
		if (!isNaN(num) && num >= 2) {
			selectedTipCents = Math.round(num * 100);
		}
	}

	function scrollToTarget(id: string) {
		const el = document.getElementById(id);
		el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
	}

	function openAuthFor(action: 'note' | 'stamp' | 'save' | '') {
		pendingAuthAction = action;
		if (typeof window !== 'undefined' && action === 'note' && noteBody.trim().length > 0) {
			sessionStorage.setItem(`quire_draft_${data.issue.id}`, noteBody);
		}
		authDrawerOpen = true;
	}

	function toggleAudio(id: string) {
		playingAudioId = playingAudioId === id ? null : id;
	}
</script>

<svelte:head>
	<title>{data.issue.city} @ {data.issue.venue} — {data.artist.displayName} | Quire</title>
</svelte:head>

<div
	class="book-container"
	style="--accent: {data.artist.accentColor || '#05D9E8'};"
>
	<!-- PAGE 1: The Cover -->
	<section
		id="page-cover"
		class="page cover"
		style="--cover-art: {data.artist.coverArtUrl
			? `linear-gradient(to bottom, rgba(9, 7, 16, 0.45), rgba(9, 7, 16, 0.96)), url('${data.artist.coverArtUrl}')`
			: 'none'};"
	>
		<div class="page-inner">
			<header class="cover-header">
				<a href="/a/{data.artist.slug}" class="btn-artist-link">
					← {data.artist.displayName}
				</a>
				<Cluster align="center" gap="xs">
					{#if data.isScanVerified}
						<span class="meta-chip meta-highlight">● Attended Stamp Eligible</span>
					{/if}
					{#if data.session?.user}
						<a href="/me/stubs" class="btn-nav-ghost">My Stubs</a>
					{:else}
						<button type="button" class="btn-nav-primary" onclick={() => openAuthFor('')}>
							Fan Sign In
						</button>
					{/if}
				</Cluster>
			</header>

			<Stack gap="md" class="cover-middle-stack">
				<Cluster align="center" gap="xs">
					<span class="meta-chip meta-highlight">{data.issue.date}</span>
					<span class="meta-chip">{data.issue.city}</span>
					<span class="text-muted meta-venue">@ {data.issue.venue}</span>
					{#if data.issue.status === 'cancelled'}
						<span class="meta-chip meta-support">Cancelled</span>
					{:else if data.issue.status === 'draft'}
						<span class="meta-chip meta-accent">Draft</span>
					{:else if data.issue.status === 'archived'}
						<span class="meta-chip">Archived</span>
					{/if}
				</Cluster>

				<h1 class="cover-title">{data.issue.city}</h1>

				{#if data.issue.coverNote}
					<p class="cover-note-text">"{data.issue.coverNote}"</p>
				{/if}

				{#if data.isArtistClosed}
					<Box variant="subtle" padding="sm" radius="md" class="closed-artist-notice">
						This artist has left Quire. This issue is preserved in read-only archive mode.
					</Box>
				{/if}
			</Stack>

			<Cluster justify="between" align="center" gap="sm" class="cover-actions-strip">
				{#if data.artist.payoutsEnabled && !data.isArtistClosed}
					<button
						type="button"
						class="btn-hero-tip"
						onclick={() => (tipDrawerOpen = true)}
					>
						Support Artist (${(selectedTipCents / 100).toFixed(2)})
					</button>
				{/if}

				<button
					type="button"
					class="btn-open-zine"
					onclick={() => scrollToTarget('page-content-0')}
				>
					Open Tonight's Zine →
				</button>
			</Cluster>

			<footer class="page-footer">
				<span>Swipe or tap to read ({contentPages.length + 3} pages)</span>
				<span class="font-mono">Issue #{data.issue.slug}</span>
			</footer>
		</div>
	</section>

	<!-- BESPOKE & MASTER TEMPLATE PAGES (SPEC.md §5.2) -->
	{#each contentPages as page, idx}
		{@const parsed = parseContent(page.contentJson)}
		{@const nextTarget =
			idx + 1 < contentPages.length ? `page-content-${idx + 1}` : 'page-wall'}
		{@const prevTarget = idx === 0 ? 'page-cover' : `page-content-${idx - 1}`}

		{@const photos = page.kind === 'photo' || page.kind === 'image' ? resolvePhotoEntries(parsed) : []}
		{@const isPhotoPage = photos.length > 0}
		{@const safePhotoCssUrl = photos[0] ? photos[0].url.replace(/'/g, '%27') : ''}

		<section
			id="page-content-{idx}"
			class="page content-page-canvas {isPhotoPage ? 'has-photo-bg' : ''}"
			style="--page-photo: {isPhotoPage
				? `linear-gradient(to bottom, rgba(9, 7, 16, 0.72), rgba(9, 7, 16, 0.96)), url('${safePhotoCssUrl}')`
				: 'none'};"
		>
			<div class="page-inner">
				<header class="cover-header">
					<Cluster align="center" gap="xs">
						<span class="meta-chip {page.source === 'bespoke' ? 'meta-accent' : 'meta-highlight'}">
							{page.source === 'bespoke' ? data.issue.city : 'Band Liner Note'}
						</span>
						<span class="meta-chip">{page.kind.toUpperCase()}</span>
					</Cluster>
					<span class="text-muted font-mono subtext-page">
						Page {idx + 2} of {contentPages.length + 3}
					</span>
				</header>

				<Stack gap="lg" class="page-body margin-auto">
					{#if page.kind === 'setlist'}
						<Stack gap="xs">
							<span class="text-highlight font-mono eyebrow-small">{data.issue.venue}</span>
							<h2 class="bespoke-heading">{parsed.title || "Tonight's Setlist"}</h2>
						</Stack>

						<Box variant="raised" padding="lg" radius="lg" class="setlist-card">
							<Stack gap="sm">
								{#each parsed.songs || ['Opener', 'New Track', 'Crowd Favorite', 'Encore'] as song, sIdx}
									<Cluster justify="between" align="center" class="song-row">
										<Cluster align="center" gap="sm">
											<span class="text-highlight font-mono song-num">
												{String(sIdx + 1).padStart(2, '0')}
											</span>
											<span class="song-title">{song}</span>
										</Cluster>
										<span class="text-muted font-mono song-tag">LIVE</span>
									</Cluster>
								{/each}
							</Stack>
						</Box>
					{:else if page.kind === 'photo' || page.kind === 'image'}
						<Stack gap="md">
							{#if photos.length > 1}
								<PhotoPile
									{photos}
									label={parsed.title || `${data.issue.city} photo pile`}
								/>
							{:else if photos.length === 1}
								<Frame ratio="4-3" class="photo-page-frame">
									<img
										src={photos[0].url}
										alt={photos[0].caption || parsed.title || `${data.issue.city} gig photo`}
										loading="lazy"
									/>
								</Frame>
							{/if}
							<h2 class="bespoke-heading">
								{parsed.title || 'From Tonight'}
							</h2>
							{#if parsed.body}
								<p class="bespoke-body-text">{parsed.body}</p>
							{/if}
							{#if photos.length === 1 && photos[0].caption}
								<p class="bespoke-body-text">{photos[0].caption}</p>
							{/if}
						</Stack>
					{:else if page.kind === 'audio'}
						<Stack gap="md">
							<Cluster justify="between" align="center">
								<span class="meta-chip meta-accent">
									{parsed.audioUrl ? 'AUDIO TRACK' : 'UNRELEASED DEMO'}
								</span>
								{#if parsed.audioUrl}
									{#if parsed.duration}
										<span class="text-accent font-mono">{parsed.duration}</span>
									{/if}
								{:else}
									<span class="text-accent font-mono">
										{playingAudioId === page.id ? '01:14' : '00:00'} / {parsed.duration || '03:42'}
									</span>
								{/if}
							</Cluster>

							<h2 class="bespoke-heading">{parsed.title || 'Studio Session Bounce'}</h2>

							<Box variant="raised" padding="lg" radius="lg" class="audio-card">
								{#if parsed.audioUrl}
									<Stack gap="sm">
										<audio controls preload="metadata" src={parsed.audioUrl} class="audio-native-player"></audio>
										<Cluster justify="between" align="center">
											<span class="audio-track-label">{parsed.title || 'Audio Track'}</span>
											{#if parsed.duration}
												<span class="text-muted font-mono audio-duration-label">{parsed.duration}</span>
											{/if}
										</Cluster>
									</Stack>
								{:else}
									<Cluster justify="between" align="center" gap="md">
										<button
											type="button"
											class="audio-play-btn {playingAudioId === page.id ? 'is-playing' : ''}"
											onclick={() => toggleAudio(page.id)}
											aria-label={playingAudioId === page.id ? 'Pause track' : 'Play track'}
										>
											{playingAudioId === page.id ? 'PAUSE' : 'PLAY'}
										</button>
										<Stack gap="3xs" class="audio-meta-stack">
											<span class="audio-track-label">
												{playingAudioId === page.id ? 'Playing 4-Track Tape Bounce...' : 'Tap to preview rough mix'}
											</span>
											<div class="audio-progress-track">
												<div
													class="audio-progress-fill"
													style="inline-size: {playingAudioId === page.id ? '38%' : '0%'};"
												></div>
											</div>
										</Stack>
									</Cluster>
								{/if}
							</Box>

							{#if parsed.body}
								<p class="bespoke-body-text">{parsed.body}</p>
							{/if}
						</Stack>
					{:else if page.kind === 'video'}
						{@const videoEmbed = resolveVideoEmbed(parsed.videoUrl || parsed.embedUrl)}
						<Stack gap="md">
							<h2 class="bespoke-heading">{parsed.title || 'Live Video'}</h2>

							{#if videoEmbed.kind === 'youtube'}
								<Stack gap="xs">
									<Frame ratio="16-9" class="video-frame">
										{#if activatedVideos[page.id]}
											<iframe
												src={videoEmbed.embedSrc}
												title={parsed.title || 'YouTube video player'}
												allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
												allowfullscreen
												loading="lazy"
											></iframe>
										{:else}
											<img
												src={videoEmbed.posterSrc}
												alt={parsed.title || 'Video thumbnail'}
												loading="lazy"
												class="video-poster-img"
											/>
											<button
												type="button"
												class="video-facade-play"
												onclick={() => (activatedVideos[page.id] = true)}
												aria-label="Play {parsed.title || 'video'}"
											>
												<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="video-play-icon">
													<path d="M8 5v14l11-7z" />
												</svg>
												<span>Play Video</span>
											</button>
										{/if}
									</Frame>
									<Cluster justify="end">
										<a
											href={videoEmbed.watchUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="video-external-link"
										>
											Watch on YouTube ↗
										</a>
									</Cluster>
								</Stack>
							{:else if videoEmbed.kind === 'vimeo'}
								<Stack gap="xs">
									<Frame ratio="16-9" class="video-frame">
										{#if activatedVideos[page.id]}
											<iframe
												src={videoEmbed.embedSrc}
												title={parsed.title || 'Vimeo video player'}
												allow="autoplay; fullscreen; picture-in-picture"
												allowfullscreen
												loading="lazy"
											></iframe>
										{:else}
											<div class="video-facade-backdrop">
												<button
													type="button"
													class="video-facade-play"
													onclick={() => (activatedVideos[page.id] = true)}
													aria-label="Play {parsed.title || 'Vimeo video'}"
												>
													<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="video-play-icon">
														<path d="M8 5v14l11-7z" />
													</svg>
													<span>Play Vimeo Video</span>
												</button>
											</div>
										{/if}
									</Frame>
									<Cluster justify="end">
										<a
											href={videoEmbed.watchUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="video-external-link"
										>
											Watch on Vimeo ↗
										</a>
									</Cluster>
								</Stack>
							{:else if videoEmbed.kind === 'bandcamp-embed'}
								<Box variant="raised" padding="sm" radius="md" class="bandcamp-card">
									<iframe
										src={videoEmbed.embedSrc}
										title={parsed.title || 'Bandcamp Player'}
										class="bandcamp-iframe"
										loading="lazy"
										seamless
									></iframe>
								</Box>
							{:else if videoEmbed.kind === 'video-file'}
								<Frame ratio="16-9" class="video-frame">
									<video controls preload="metadata" src={videoEmbed.src}>
										<track kind="captions" />
									</video>
								</Frame>
							{:else if videoEmbed.kind === 'bandcamp-link' || videoEmbed.kind === 'external-link'}
								<Box variant="raised" padding="lg" radius="lg" class="video-link-card">
									<Cluster justify="between" align="center" gap="sm">
										<Stack gap="3xs">
											<span class="meta-chip meta-accent">
												{videoEmbed.kind === 'bandcamp-link' ? 'BANDCAMP' : 'VIDEO / EMBED'}
											</span>
											<span class="video-link-title">{parsed.title || 'Open Media'}</span>
										</Stack>
										<a
											href={videoEmbed.watchUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="btn-action-highlight"
										>
											Open ↗
										</a>
									</Cluster>
								</Box>
							{/if}

							{#if parsed.body}
								<p class="bespoke-body-text">{parsed.body}</p>
							{/if}
						</Stack>
					{:else}
						<Stack gap="md">
							<h2 class="bespoke-heading">
								{parsed.title || (page.source === 'template' ? `About ${data.artist.displayName}` : 'From the Road')}
							</h2>
							<p class="bespoke-body-text">
								{parsed.body || 'Thank you for being here tonight with us in this room.'}
							</p>
						</Stack>
					{/if}
				</Stack>

				<footer class="page-footer">
					<button type="button" class="btn-page-nav" onclick={() => scrollToTarget(prevTarget)}>
						← Prev
					</button>
					<button
						type="button"
						class="btn-page-nav-primary"
						onclick={() => scrollToTarget(nextTarget)}
					>
						{idx + 1 < contentPages.length ? 'Next Page →' : 'Next: The Wall →'}
					</button>
				</footer>
			</div>
		</section>
	{/each}

	<!-- THE WALL (PUBLIC GUESTBOOK, SPEC.md §5.5) -->
	<section id="page-wall" class="page wall-canvas">
		<Stack gap="md" class="page-inner wall-full-stack">
			<header class="cover-header">
				<Cluster align="center" gap="xs">
					<span class="meta-chip meta-accent">COMMUNITY</span>
					<span class="meta-chip">THE WALL</span>
				</Cluster>
				<span class="text-muted font-mono subtext-page">
					Page {contentPages.length + 2} of {contentPages.length + 3}
				</span>
			</header>

			<Stack gap="2xs">
				<h2 class="wall-heading">Digital Guestbook</h2>
				<p class="text-muted wall-subtext">
					Leave your mark from tonight’s show. Public notes only—no links, emails, or phone numbers.
				</p>
			</Stack>

			<!-- Note Submission Box -->
			<Box variant="raised" padding="md" radius="md" class="wall-composer-box">
				{#if data.isReadOnly}
					<p class="text-muted">
						{data.isArtistClosed
							? 'This artist has left Quire. The Wall is preserved in read-only archive mode.'
							: 'This issue is archived and preserved in read-only mode.'}
					</p>
				{:else if data.session?.user}
					<form
						data-stack="gap:sm"
						method="POST"
						action="?/submitNote"
						use:enhance={() => {
							return async ({ result, update }) => {
								if (result.type === 'success') {
									noteBody = '';
									wallMessage =
										result.data?.status === 'pending'
											? 'Note submitted for artist approval!'
											: 'Your note is live on the Wall!';
								} else if (result.type === 'failure') {
									wallMessage = String(result.data?.error || 'Could not post note.');
								}
								await update();
							};
						}}
					>
						<input type="hidden" name="artistId" value={data.artist.id} />
						<input type="hidden" name="issueId" value={data.issue.id} />
						<textarea
							name="body"
							bind:value={noteBody}
							placeholder="Write a note to {data.artist.displayName}..."
							rows="2"
							maxlength="250"
							required
							class="wall-textarea"
						></textarea>
						<Cluster justify="between" align="center">
							<span class="text-muted char-count">{250 - noteBody.length} chars left</span>
							<button type="submit" class="btn-wall-post">
								Post Note →
							</button>
						</Cluster>
					</form>
				{:else}
					<Stack gap="sm">
						<textarea
							bind:value={noteBody}
							placeholder="Type your note to the band first..."
							rows="2"
							maxlength="250"
							class="wall-textarea"
						></textarea>
						<Cluster justify="between" align="center">
							<span class="text-muted char-count">{250 - noteBody.length} chars left</span>
							<button
								type="button"
								class="btn-wall-post"
								onclick={() => openAuthFor('note')}
							>
								Sign in with Google to Post →
							</button>
						</Cluster>
					</Stack>
				{/if}

				{#if wallMessage || form?.error}
					<p class="text-highlight wall-feedback-msg">
						{wallMessage || form?.error}
					</p>
				{/if}
			</Box>

			<!-- Live Notes Stream -->
			<Stack gap="sm" class="notes-scroll-body">
				{#if data.notes.length === 0}
					<Box variant="subtle" padding="lg" radius="md" class="empty-notes-box">
						<p class="text-muted">No notes left yet tonight. Be the first to sign the Wall!</p>
					</Box>
				{:else}
					{#each data.notes as note}
						<Stack as="article" gap="xs" class="note-card">
							<Cluster justify="between" align="center">
								<Cluster align="center" gap="xs">
									<div class="note-avatar">
										{note.author?.name ? note.author.name[0] : 'F'}
									</div>
									<span class="note-author">{note.author?.name || 'Fan'}</span>
									{#if note.wasThere}
										<span class="meta-chip meta-highlight">✓ Was There</span>
									{/if}
								</Cluster>

								{#if data.session?.user && !data.isReadOnly}
									<form method="POST" action="?/flagNote" use:enhance>
										<input type="hidden" name="noteId" value={note.id} />
										<button type="submit" class="btn-flag-note">
											Flag
										</button>
									</form>
								{/if}
							</Cluster>

							<p class="note-content-text">{note.body}</p>

							{#if note.replies && note.replies.length > 0}
								<Stack gap="3xs" class="artist-reply">
									<span class="text-accent reply-author-label">
										✓ {data.artist.displayName} (Artist)
									</span>
									<p class="reply-content-text">{note.replies[0].body}</p>
								</Stack>
							{/if}
						</Stack>
					{/each}
				{/if}
			</Stack>

			<footer class="page-footer">
				<button
					type="button"
					class="btn-page-nav"
					onclick={() => scrollToTarget(`page-content-${contentPages.length - 1}`)}
				>
					← Prev Page
				</button>
				<button
					type="button"
					class="btn-page-nav-primary"
					onclick={() => scrollToTarget('page-endpaper')}
				>
					Next: Endpaper →
				</button>
			</footer>
		</Stack>
	</section>

	<!-- ENDPAPER (FINAL PAGE — UNIFIED DARK GLASS HOUSE STYLE, SPEC.md §5.6 & §7) -->
	<section id="page-endpaper" class="page endpaper-canvas">
		<div class="page-inner">
			<header class="cover-header">
				<Cluster align="center" gap="xs">
					<span class="meta-chip meta-highlight">ENDPAPER</span>
					<span class="meta-chip">ADMIT ONE</span>
				</Cluster>
				<span class="text-muted font-mono subtext-page">
					Page {contentPages.length + 3} of {contentPages.length + 3}
				</span>
			</header>

			<Stack gap="lg" class="page-body margin-auto">
				<!-- Dark Glass Perforated Ticket Stub -->
				<Stack as="article" gap="sm" class="ticket-stub endpaper-stub">
					<Cluster justify="between" align="center">
						<span class="meta-chip meta-highlight">{data.issue.date}</span>
						<span class="font-mono text-muted stub-serial">
							#{data.issue.slug.slice(0, 14).toUpperCase()}
						</span>
					</Cluster>

					<Stack gap="2xs">
						<span class="text-accent font-mono eyebrow-small">{data.artist.displayName}</span>
						<h2 class="stub-city-heading">{data.issue.city}</h2>
						<p class="text-muted stub-venue-line">{data.issue.venue}</p>
					</Stack>

					<div class="ticket-stub-perforation"></div>

					<Stack gap="md">
						{#if data.collectionStatus === 'stamped' || form?.stamped}
							<Box variant="subtle" padding="md" radius="md" class="stamped-verified-box">
								<Cluster justify="between" align="center">
									<span class="text-highlight font-mono stamped-confirm-text">
										✓ OFFICIAL ATTENDANCE STAMPED
									</span>
									<a href="/me/stubs" class="btn-action-highlight">
										View My Stubs →
									</a>
								</Cluster>
							</Box>
						{:else if data.isScanVerified}
							<Stack gap="xs">
								<p class="text-highlight stub-status-note">
									● Venue QR Scan Verified! Claim your permanent attendance stub:
								</p>
								{#if data.session?.user}
									<form method="POST" action="?/claimStamp" use:enhance>
										<input type="hidden" name="issueId" value={data.issue.id} />
										<button type="submit" class="btn-claim-stamp">
											Claim Attendance Stamp
										</button>
									</form>
								{:else}
									<button
										type="button"
										class="btn-claim-stamp"
										onclick={() => openAuthFor('stamp')}
									>
										Sign in with Google to Claim Stamp
									</button>
								{/if}
							</Stack>
						{:else}
							<Stack gap="sm">
								<p class="text-muted stub-status-note">
									Browsing remotely. Physical venue QR scan during the 48-hour Stamp Window is required to stamp attendance, or bookmark this issue to your reading list:
								</p>

								{#if data.collectionStatus === 'saved' || form?.saved}
									<Cluster justify="between" align="center">
										<span class="text-highlight font-mono">✓ Saved to Bookmarks</span>
										<a href="/me/stubs" class="btn-action-highlight">
											Open My Stubs →
										</a>
									</Cluster>
								{:else if data.session?.user}
									<form method="POST" action="?/saveIssue" use:enhance>
										<input type="hidden" name="issueId" value={data.issue.id} />
										<button type="submit" class="btn-save-issue">
											+ Save Issue to My Stubs
										</button>
									</form>
								{:else}
									<button
										type="button"
										class="btn-save-issue"
										onclick={() => openAuthFor('save')}
									>
										+ Sign in with Google to Save Issue
									</button>
								{/if}
							</Stack>
						{/if}
					</Stack>
				</Stack>

				<Cluster justify="center" gap="sm">
					<a href="/a/{data.artist.slug}" class="btn-endpaper-link">
						{data.artist.displayName} Back Page ↗
					</a>
					<a href="/me/stubs" class="btn-endpaper-link">
						My Stubs Collection →
					</a>
				</Cluster>
			</Stack>

			<footer class="page-footer">
				<button type="button" class="btn-page-nav" onclick={() => scrollToTarget('page-wall')}>
					← Back to Wall
				</button>
				<button type="button" class="btn-page-nav" onclick={() => scrollToTarget('page-cover')}>
					↺ Back to Cover
				</button>
			</footer>
		</div>
	</section>
</div>

<!-- Persistent Floating Tip Trigger (Only when payoutsEnabled per SPEC.md §5.4) -->
{#if data.artist.payoutsEnabled && !data.isArtistClosed && !tipDrawerOpen && !authDrawerOpen}
	<button
		type="button"
		class="btn-floating-tip"
		onclick={() => (tipDrawerOpen = true)}
		aria-label="Support {data.artist.displayName}"
	>
		<span>Support</span>
	</button>
{/if}

<!-- BOTTOM-SHEET AUTH DRAWER (from ui-prototype/index.html) -->
{#if authDrawerOpen}
	<div class="drawer-backdrop">
		<Stack gap="md" class="glass-drawer bottom-sheet-modal" role="dialog" aria-modal="true" aria-label="Fan Authentication">
			<div class="drawer-handle"></div>
			<Cluster justify="between" align="center">
				<Stack gap="3xs">
					<span class="text-highlight font-mono eyebrow-small">FAN IDENTITY</span>
					<h3 class="drawer-title">Sign in with Google</h3>
				</Stack>
				<button
					type="button"
					class="btn-drawer-close"
					onclick={() => (authDrawerOpen = false)}
				>
					✕ Close
				</button>
			</Cluster>

			<p class="text-muted drawer-subtext">
				{#if pendingAuthAction === 'note'}
					Your Wall note draft is saved and will post automatically as soon as you sign in.
				{:else if pendingAuthAction === 'stamp'}
					Sign in to permanently bind this gig’s attendance stub to your collection.
				{:else}
					Identity is only required to sign a Wall or save to My Stubs.
				{/if}
			</p>

			<form method="POST" action="?/googleAuth" use:enhance>
				<input
					type="hidden"
					name="targetHash"
					value={pendingAuthAction === 'stamp' || pendingAuthAction === 'save'
						? '#page-endpaper'
						: '#page-wall'}
				/>

				<button type="submit" class="google-sheet-btn">
					<span>Continue with Google</span>
				</button>
			</form>
		</Stack>
	</div>
{/if}

<!-- 1-TAP TIP DRAWER -->
{#if tipDrawerOpen}
	<div class="drawer-backdrop">
		<Stack gap="md" class="glass-drawer bottom-sheet-modal" role="dialog" aria-modal="true" aria-label="Tip {data.artist.displayName}">
			<div class="drawer-handle"></div>
			<Cluster justify="between" align="center">
				<Stack gap="3xs">
					<span class="text-support font-mono eyebrow-small">1-TAP ANONYMOUS TIP</span>
					<h3 class="drawer-title">Tip {data.artist.displayName}</h3>
				</Stack>
				<button
					type="button"
					class="btn-drawer-close"
					onclick={() => {
						tipDrawerOpen = false;
						tipMessage = '';
					}}
				>
					✕ Close
				</button>
			</Cluster>

			<Cluster distributeEqually gap="xs">
				{#each data.tipPresets as preset}
					<button
						type="button"
						class="preset-btn {selectedTipCents === preset * 100 ? 'preset-active' : ''}"
						onclick={() => handleTipPreset(preset)}
					>
						${preset}
					</button>
				{/each}
			</Cluster>

			<Stack gap="xs">
				<label for="custom-tip" class="drawer-label">Custom Amount ($2 – $500 USD)</label>
				<input
					id="custom-tip"
					type="number"
					min="2"
					max="500"
					step="1"
					placeholder="Enter custom $..."
					value={customAmountStr}
					oninput={(e) => handleCustomAmountChange((e.currentTarget as HTMLInputElement).value)}
					class="drawer-input"
				/>
			</Stack>

			<Cluster as="label" align="center" gap="xs" class="fee-optin-label">
				<input type="checkbox" bind:checked={fanCoveredFees} />
				<span class="fee-optin-text">
					Cover transaction fees so {data.artist.displayName} receives the full ${(selectedTipCents / 100).toFixed(2)}
				</span>
			</Cluster>

			{#if tipMessage}
				<Box variant="subtle" padding="sm" radius="md" class="tip-confirm-box">
					{tipMessage}
				</Box>
			{/if}

			<form
				method="POST"
				action="?/tip"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							tipMessage = `✓ Tip Confirmed! $${(selectedTipCents / 100).toFixed(2)} sent to ${data.artist.displayName}.`;
						} else {
							tipMessage = "That didn't go through. Nothing was charged.";
						}
					};
				}}
			>
				<input type="hidden" name="artistId" value={data.artist.id} />
				<input type="hidden" name="issueId" value={data.issue.id} />
				<input type="hidden" name="amountGrossCents" value={selectedTipCents} />
				<input type="hidden" name="fanCoveredFees" value={String(fanCoveredFees)} />

				<button type="submit" class="btn-submit-tip">
					Send ${(selectedTipCents / 100).toFixed(2)} Tip Now
				</button>
			</form>
		</Stack>
	</div>
{/if}

<style>
	.cover {
		background-image: var(--cover-art, none);
		background-size: cover;
		background-position: center;
	}

	.has-photo-bg {
		background-image: var(--page-photo, none);
		background-size: cover;
		background-position: center;
	}

	.content-page-canvas,
	.wall-canvas,
	.endpaper-canvas {
		background-color: var(--bg-void);
		background-image: radial-gradient(circle at 50% 0%, rgba(21, 17, 36, 0.9), var(--bg-void) 75%);
	}

	:global(.cover-middle-stack) {
		margin-block: auto;
	}

	.meta-venue {
		font-size: var(--text-small);
	}

	.cover-note-text {
		font-size: var(--text-body);
		max-inline-size: 42ch;
		line-height: var(--leading-body);
		color: #e4e4e7;
	}

	:global(.cover-actions-strip) {
		margin-block-start: var(--space-l);
	}

	.btn-open-zine {
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		font-size: var(--text-small);
	}

	.subtext-page {
		font-size: var(--text-body);
	}

	.eyebrow-small {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}

	:global(.margin-auto) {
		margin-block: auto;
		inline-size: 100%;
	}

	.bespoke-heading {
		font-size: var(--text-heading);
		font-weight: var(--weight-heavy);
		color: #ffffff;
		letter-spacing: var(--tracking-snug);
	}

	.bespoke-body-text {
		font-size: var(--text-body);
		line-height: var(--leading-body);
		color: #d4d2df;
	}

	:global(.setlist-card),
	:global(.audio-card) {
		border-color: var(--glass-border);
	}

	:global(.song-row) {
		padding-block-end: var(--space-2xs);
		border-block-end: 1px solid rgba(255, 255, 255, 0.07);
	}

	.song-num {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
	}

	.song-title {
		font-weight: var(--weight-semibold);
		color: #ffffff;
	}

	.song-tag {
		font-size: var(--text-meta);
	}

	.audio-play-btn {
		inline-size: 3.5rem;
		block-size: 3.5rem;
		border-radius: 50%;
		border: 1px solid var(--accent);
		background: rgba(5, 217, 232, 0.14);
		color: #ffffff;
		font-family: var(--font-mono);
		font-size: var(--text-meta);
		font-weight: var(--weight-heavy);
		letter-spacing: var(--tracking-label);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: transform 0.15s ease, background-color 0.15s ease;
	}

	.audio-play-btn.is-playing {
		background: var(--accent);
		color: #090710;
	}

	:global(.audio-meta-stack) {
		flex: 1;
	}

	.audio-track-label {
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		color: #ffffff;
	}

	.audio-progress-track {
		inline-size: 100%;
		block-size: 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		overflow: hidden;
		margin-block-start: var(--space-3xs);
	}

	.audio-progress-fill {
		block-size: 100%;
		background: var(--accent);
		transition: inline-size 0.3s ease;
	}

	.audio-native-player {
		inline-size: 100%;
	}

	.audio-duration-label {
		font-size: var(--text-meta);
	}

	:global(.photo-page-frame) {
		border-radius: var(--radius-lg);
		border: 1px solid var(--glass-border);
		background: rgba(0, 0, 0, 0.35);
	}

	:global(.video-frame) {
		border-radius: var(--radius-lg);
		border: 1px solid var(--glass-border);
		background: rgba(9, 7, 16, 0.9);
	}

	.video-poster-img {
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
		display: block;
	}

	.video-facade-backdrop {
		inline-size: 100%;
		block-size: 100%;
		background: radial-gradient(circle at 50% 40%, rgba(5, 217, 232, 0.16), rgba(9, 7, 16, 0.95));
	}

	.video-facade-play {
		position: absolute;
		inset-block-start: 50%;
		inset-inline-start: 50%;
		transform: translate(-50%, -50%);
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		border-radius: 8px;
		background: rgba(9, 7, 16, 0.88);
		color: #ffffff;
		border: 1px solid var(--accent);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		cursor: pointer;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
		transition: background-color 0.15s ease, transform 0.15s ease;
	}

	.video-facade-play:hover {
		background: var(--accent);
		color: #090710;
	}

	.video-play-icon {
		inline-size: 1.15rem;
		block-size: 1.15rem;
		display: block;
	}

	.video-external-link {
		font-family: var(--font-mono);
		font-size: var(--text-meta);
		color: var(--accent);
		text-decoration: none;
	}

	.video-external-link:hover {
		text-decoration: underline;
	}

	:global(.bandcamp-card),
	:global(.video-link-card) {
		border-color: var(--glass-border);
	}

	.bandcamp-iframe {
		inline-size: 100%;
		block-size: 120px;
		border: none;
	}

	.video-link-title {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}

	:global(.wall-full-stack) {
		block-size: 100%;
	}

	.wall-heading {
		font-size: var(--text-heading);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.wall-subtext {
		font-size: var(--text-body);
	}

	:global(.wall-composer-box) {
		border-color: var(--glass-border);
	}

	:global(.closed-artist-notice) {
		border-color: rgba(255, 42, 109, 0.45);
		color: #ffffff;
		font-size: var(--text-small);
	}

	.wall-textarea {
		inline-size: 100%;
		background: rgba(0, 0, 0, 0.45);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		padding-block: var(--space-xs);
		padding-inline: var(--space-xs);
		font-family: inherit;
		font-size: var(--text-body);
		resize: none;
	}

	.char-count {
		font-size: var(--text-meta);
	}

	.wall-feedback-msg {
		font-size: var(--text-small);
		margin-block-start: var(--space-2xs);
	}

	:global(.notes-scroll-body) {
		flex: 1;
		overflow-y: auto;
		max-block-size: 38vh;
		padding-inline-end: var(--space-3xs);
	}

	.note-content-text {
		font-size: var(--text-ui);
		line-height: var(--leading-body);
		color: #f4f4f0;
	}

	.reply-author-label {
		font-weight: var(--weight-bold);
		font-size: var(--text-meta);
	}

	.reply-content-text {
		color: #ffffff;
		font-size: var(--text-small);
	}

	:global(.endpaper-stub) {
		padding-block: var(--space-m);
		padding-inline: var(--space-m);
	}

	.stub-serial {
		font-size: var(--text-meta);
	}

	.stub-city-heading {
		font-size: var(--text-title);
		font-weight: var(--weight-black);
		text-transform: uppercase;
		letter-spacing: var(--tracking-tight);
		color: #ffffff;
	}

	.stub-venue-line {
		font-size: var(--text-body);
	}

	:global(.stamped-verified-box) {
		border-color: rgba(1, 255, 195, 0.4);
		background: rgba(1, 255, 195, 0.08);
	}

	.stamped-confirm-text {
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
	}

	.stub-status-note {
		font-size: var(--text-small);
		line-height: var(--leading-body);
	}

	.btn-claim-stamp {
		inline-size: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 8px;
		background: var(--highlight);
		color: #090710;
		border: 1px solid rgba(1, 255, 195, 0.6);
		font-size: var(--text-ui);
		font-weight: var(--weight-heavy);
		cursor: pointer;
		box-shadow: 0 4px 20px rgba(1, 255, 195, 0.35);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-claim-stamp:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 24px rgba(1, 255, 195, 0.55);
	}

	.btn-save-issue {
		inline-size: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 8px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-save-issue:hover {
		background: rgba(1, 255, 195, 0.24);
		border-color: rgba(1, 255, 195, 0.7);
	}

	/* Bottom Sheet Drawers */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(4px);
		z-index: 100;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	:global(.bottom-sheet-modal) {
		inline-size: 100%;
		max-inline-size: 500px;
		padding-block: var(--space-m);
		padding-inline: var(--space-m);
		border-radius: 24px 24px 0 0;
	}

	.drawer-handle {
		inline-size: 2.5rem;
		block-size: 0.25rem;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		margin-inline: auto;
	}

	.drawer-title {
		font-size: var(--text-lead);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.drawer-subtext {
		font-size: var(--text-body);
		line-height: var(--leading-body);
	}

	.drawer-label {
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		color: #d4d2df;
	}

	.drawer-input {
		inline-size: 100%;
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		font-size: var(--text-body);
	}

	.google-sheet-btn {
		inline-size: 100%;
		block-size: 2.9rem;
		background: #ffffff;
		color: #090710;
		font-weight: var(--weight-bold);
		font-size: var(--text-ui);
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.preset-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-xs);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.05);
		color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.12);
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.preset-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.24);
	}

	.preset-active {
		background: rgba(1, 255, 195, 0.16);
		color: var(--highlight);
		border-color: var(--highlight);
	}

	:global(.fee-optin-label) {
		cursor: pointer;
	}

	.fee-optin-text {
		font-size: var(--text-small);
		color: #d4d2df;
	}

	:global(.tip-confirm-box) {
		color: var(--highlight);
		border-color: var(--highlight);
		font-size: var(--text-small);
	}

	.btn-submit-tip {
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
		box-shadow: 0 0 20px rgba(255, 42, 109, 0.35);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-submit-tip:hover {
		transform: translateY(-1px);
		box-shadow: 0 0 26px rgba(255, 42, 109, 0.6);
	}

	/* Sleek Rectangular Buttons & Metadata Badges (Zero 9999px Pills) */
	.btn-artist-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-compact);
		padding-block: var(--space-compact);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(1, 255, 195, 0.12);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.35);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		text-decoration: none;
		transition: background-color 0.15s ease;
	}

	.btn-artist-link:hover {
		background: rgba(1, 255, 195, 0.22);
		color: var(--highlight);
	}

	.btn-nav-ghost {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-compact);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.04);
		color: #a1a1aa;
		border: 1px solid rgba(255, 255, 255, 0.08);
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		text-decoration: none;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.btn-nav-ghost:hover {
		background: rgba(255, 255, 255, 0.09);
		color: #ffffff;
	}

	.btn-nav-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-compact);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-nav-primary:hover {
		background: rgba(1, 255, 195, 0.24);
	}

	.btn-hero-tip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 8px;
		background: var(--support);
		color: #ffffff;
		border: 1px solid rgba(255, 42, 109, 0.5);
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		cursor: pointer;
		box-shadow: 0 0 20px rgba(255, 42, 109, 0.35);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-hero-tip:hover {
		transform: translateY(-1px);
		box-shadow: 0 0 26px rgba(255, 42, 109, 0.6);
	}

	.btn-open-zine {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 8px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-open-zine:hover {
		background: rgba(1, 255, 195, 0.24);
		border-color: rgba(1, 255, 195, 0.7);
	}

	.btn-page-nav {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.05);
		color: #e4e4e7;
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-page-nav:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
	}

	.btn-page-nav-primary {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		border-radius: 6px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-page-nav-primary:hover {
		background: rgba(1, 255, 195, 0.24);
	}

	.btn-wall-post {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		border-radius: 6px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-wall-post:hover {
		background: rgba(1, 255, 195, 0.24);
	}

	.btn-flag-note {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-3xs);
		padding-inline: var(--space-2xs);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.04);
		color: #a1a1aa;
		border: 1px solid rgba(255, 255, 255, 0.08);
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.btn-flag-note:hover {
		background: rgba(255, 42, 109, 0.15);
		color: #ff6b9b;
	}

	.btn-action-highlight {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-compact);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		text-decoration: none;
		transition: background-color 0.15s ease;
	}

	.btn-action-highlight:hover {
		background: rgba(1, 255, 195, 0.24);
		color: var(--highlight);
	}

	.btn-endpaper-link {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-2xs);
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

	.btn-endpaper-link:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
	}

	.btn-floating-tip {
		position: fixed;
		inset-block-end: 1.5rem;
		inset-inline-end: 1.5rem;
		z-index: 50;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2xs);
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 12px;
		background: var(--support);
		color: #ffffff;
		border: 1px solid rgba(255, 42, 109, 0.5);
		font-size: var(--text-ui);
		font-weight: var(--weight-heavy);
		cursor: pointer;
		box-shadow: 0 4px 20px rgba(255, 42, 109, 0.4);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-floating-tip:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 28px rgba(255, 42, 109, 0.65);
	}

	.btn-drawer-close {
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
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-drawer-close:hover {
		background: rgba(255, 255, 255, 0.1);
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
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #e4e4e7;
	}

	.meta-chip.meta-highlight {
		background: rgba(1, 255, 195, 0.12);
		border-color: rgba(1, 255, 195, 0.35);
		color: var(--highlight);
	}

	.meta-chip.meta-accent {
		background: rgba(5, 217, 232, 0.12);
		border-color: rgba(5, 217, 232, 0.35);
		color: var(--accent);
	}

	.meta-chip.meta-support {
		background: rgba(255, 42, 109, 0.14);
		border-color: rgba(255, 42, 109, 0.4);
		color: #ff6b9b;
	}
</style>
