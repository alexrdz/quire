<script lang="ts">
	import { enhance } from '$app/forms';
	import { Stack, Box, Cluster } from '$lib/components/layout';

	let { data, form } = $props();

	// Svelte 5 Runes state
	let tipDrawerOpen = $state(false);
	let selectedTipCents = $state(500); // Default $5.00
	let customAmountStr = $state('');
	let fanCoveredFees = $state(false);
	let tipMessage = $state('');

	// Wall note state
	let noteBody = $state('');
	let wallMessage = $state('');

	// Load pending note draft from sessionStorage if returning from Google Auth
	$effect(() => {
		if (typeof window !== 'undefined') {
			const savedDraft = sessionStorage.getItem(`quire_draft_${data.issue.id}`);
			if (savedDraft) {
				noteBody = savedDraft;
				// Auto-submit if user just authenticated
				if (data.session?.user) {
					sessionStorage.removeItem(`quire_draft_${data.issue.id}`);
				}
			}
		}
	});

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

	function scrollToPage(index: number) {
		const el = document.getElementById(`page-${index}`);
		el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
	}

	function saveDraftForAuth() {
		if (typeof window !== 'undefined' && noteBody.trim().length > 0) {
			sessionStorage.setItem(`quire_draft_${data.issue.id}`, noteBody);
		}
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
	<section id="page-0" class="page cover" style="background-image: {data.artist.coverArtUrl ? `linear-gradient(to bottom, rgba(9, 7, 16, 0.4), rgba(9, 7, 16, 0.95)), url('${data.artist.coverArtUrl}')` : 'none'}; background-size: cover; background-position: center;">
		<div class="page-inner">
			<header class="cover-header">
				<a href="/a/{data.artist.slug}" class="glass-pill text-highlight link-clean">
					← {data.artist.displayName}
				</a>
				{#if data.isScanVerified}
					<span class="glass-pill tag-highlight">● Attended Stamp Eligible</span>
				{/if}
			</header>

			<Stack gap="md" class="cover-middle-stack">
				<Cluster align="center" gap="xs">
					<span class="glass-pill tag-highlight">{data.issue.date}</span>
					<span class="glass-pill">{data.issue.city}</span>
					<span class="glass-pill text-muted">{data.issue.venue}</span>
				</Cluster>

				<h1 class="cover-title">
					{data.issue.city}
				</h1>

				{#if data.issue.coverNote}
					<p class="text-muted cover-note-text">
						"{data.issue.coverNote}"
					</p>
				{/if}
			</Stack>

			<Cluster justify="between" align="center" class="cover-actions-strip">
				<button
					type="button"
					class="floating-tip-btn btn-static"
					onclick={() => (tipDrawerOpen = true)}
				>
					Support Artist (${(selectedTipCents / 100).toFixed(2)})
				</button>

				<button
					type="button"
					class="glass-pill text-highlight btn-open-zine"
					onclick={() => scrollToPage(1)}
				>
					Open Tonight's Zine →
				</button>
			</Cluster>

			<footer class="page-footer">
				<span>Swipe right to read</span>
				<span>Quire Issue #{data.issue.slug}</span>
			</footer>
		</div>
	</section>

	<!-- BESPOKE & TEMPLATE PAGES -->
	{#if data.issuePages.length > 0}
		{#each data.issuePages as page, idx}
			<section id="page-{idx + 1}" class="page text-content">
				<div class="page-inner">
					<Stack gap="md">
						<header class="cover-header">
							<span class="glass-pill tag-accent">Bespoke Page</span>
							<span class="text-muted subtext-page">Page {idx + 2}</span>
						</header>

						<div class="page-body margin-auto">
							<Stack gap="md">
								{#if page.kind === 'setlist'}
									<h2 class="bespoke-heading">Tonight's Setlist</h2>
									<Box variant="raised" padding="md" radius="md">
										<Stack gap="sm">
											{#each (JSON.parse(page.contentJson || '{}').songs || ['Opener', 'New Track', 'Crowd Favorite', 'Encore']) as song, sIdx}
												<Cluster justify="between" align="center" class="song-row">
													<span>{sIdx + 1}. {song}</span>
													<span class="text-muted">Live</span>
												</Cluster>
											{/each}
										</Stack>
									</Box>
								{:else}
									<h2 class="bespoke-heading">From the Road</h2>
									<p class="bespoke-body-text">
										{JSON.parse(page.contentJson || '{}').body || 'Thank you for being here tonight with us in this room.'}
									</p>
								{/if}
							</Stack>
						</div>

						<footer class="page-footer">
							<button type="button" class="glass-pill" onclick={() => scrollToPage(idx + 2)}>Next Page →</button>
							<span>{data.issue.city}</span>
						</footer>
					</Stack>
				</div>
			</section>
		{/each}
	{:else}
		<!-- Fallback Bespoke Page -->
		<section id="page-1" class="page text-content">
			<div class="page-inner">
				<Stack gap="md">
					<header class="cover-header">
						<span class="glass-pill tag-accent">Gig Notes</span>
						<span class="text-muted subtext-page">Page 2</span>
					</header>

					<div class="page-body margin-auto">
						<Stack gap="md">
							<h2 class="bespoke-heading">Tonight at {data.issue.venue}</h2>
							<p class="bespoke-body-text">
								{data.issue.coverNote || 'Thank you for gathering with us tonight. Read the pages, leave your mark on the Wall, and claim your attendance stub.'}
							</p>
						</Stack>
					</div>

					<footer class="page-footer">
						<button type="button" class="glass-pill" onclick={() => scrollToPage(2)}>Next: The Wall →</button>
						<span>{data.issue.venue}</span>
					</footer>
				</Stack>
			</div>
		</section>
	{/if}

	<!-- THE WALL (PAGE N-1) -->
	<section id="page-wall" class="page wall-canvas">
		<div class="page-inner">
			<Stack gap="md">
				<header class="cover-header">
					<span class="glass-pill tag-highlight">The Wall</span>
					<span class="text-muted subtext-page">Public Guestbook</span>
				</header>

				<Stack gap="xs">
					<h2 class="wall-heading">Leave Your Note</h2>
					<p class="text-muted wall-subtext">
						Post a memory from tonight. No links, phone numbers, or emails.
					</p>
				</Stack>

				<!-- Note Submission Form -->
				<Box variant="raised" padding="md" radius="md">
					{#if data.session?.user}
						<form method="POST" action="?/submitNote" use:enhance>
							<Stack gap="sm">
								<input type="hidden" name="artistId" value={data.artist.id} />
								<input type="hidden" name="issueId" value={data.issue.id} />
								<textarea
									name="body"
									bind:value={noteBody}
									placeholder="Write something to the band and fellow fans..."
									rows="3"
									maxlength="500"
									class="wall-textarea"
								></textarea>
								<Cluster justify="between" align="center">
									<span class="text-muted char-count">{500 - noteBody.length} characters left</span>
									<button type="submit" class="glass-pill tag-highlight post-note-btn">
										Post Note
									</button>
								</Cluster>
							</Stack>
						</form>
					{:else}
						<Stack gap="sm">
							<textarea
								bind:value={noteBody}
								placeholder="Type your note first..."
								rows="3"
								maxlength="500"
								class="wall-textarea"
							></textarea>
							<Cluster justify="between" align="center">
								<span class="text-muted char-count">Draft saved automatically</span>
								<a
									href="/login?redirect=/i/{data.issue.slug}#page-wall"
									class="glass-pill tag-highlight auth-btn"
									onclick={saveDraftForAuth}
								>
									Sign in with Google to Post
								</a>
							</Cluster>
						</Stack>
					{/if}
				</Box>

				<!-- Live Notes Stream -->
				<div class="page-body notes-scroll-body">
					<Stack gap="sm">
						{#if data.notes.length === 0}
							<div class="text-muted empty-notes-text">
								No notes left yet tonight. Be the first to sign the Wall!
							</div>
						{:else}
							{#each data.notes as note}
								<Box variant="subtle" padding="md" radius="md">
									<Stack gap="sm">
										<Cluster justify="between" align="center">
											<Cluster align="center" gap="xs">
												<div class="note-avatar">
													{note.author?.name ? note.author.name[0] : 'F'}
												</div>
												<span class="note-author">{note.author?.name || 'Fan'}</span>
											</Cluster>

											<form method="POST" action="?/flagNote" use:enhance>
												<input type="hidden" name="noteId" value={note.id} />
												<button type="submit" class="glass-pill text-muted flag-btn">
													⚑ Flag
												</button>
											</form>
										</Cluster>

										<p class="note-content-text">
											{note.body}
										</p>

										<!-- Single Tier Artist Reply -->
										{#if note.replies && note.replies.length > 0}
											<div class="artist-reply">
												<Stack gap="3xs">
													<span class="text-highlight reply-author-label">
														{data.artist.displayName} (Artist Reply)
													</span>
													<p class="reply-content-text">
														{note.replies[0].body}
													</p>
												</Stack>
											</div>
										{/if}
									</Stack>
								</Box>
							{/each}
						{/if}
					</Stack>
				</div>

				<footer class="page-footer">
					<button type="button" class="glass-pill" onclick={() => scrollToPage(3)}>Next: Endpaper →</button>
					<span>The Wall</span>
				</footer>
			</Stack>
		</div>
	</section>

	<!-- ENDPAPER (FINAL PAGE) -->
	<section id="page-endpaper" class="page endpaper-canvas">
		<div class="page-inner">
			<Stack gap="lg">
				<header class="cover-header">
					<span class="glass-pill endpaper-pill">Endpaper</span>
					<span class="endpaper-admit">Admit One</span>
				</header>

				<div class="margin-auto">
					<Stack gap="md">
						<!-- Ticket Stub Frame -->
						<div class="ticket-stub endpaper-stub">
							<Cluster justify="between" align="center">
								<span class="tag-highlight glass-pill">{data.issue.date}</span>
								<span class="glass-pill font-mono">STUB #{data.issue.id.slice(0, 8)}</span>
							</Cluster>

							<Stack gap="xs" class="stub-main-content">
								<h3 class="stub-heading">{data.artist.displayName}</h3>
								<p class="stub-venue">{data.issue.venue} — {data.issue.city}</p>
							</Stack>

							<div class="ticket-stub-perforation"></div>

							<Cluster justify="between" align="center" class="stub-footer-strip">
								<div class="stub-proof-label">
									VERIFIED ATTENDANCE PROOF
								</div>

								{#if data.collectionStatus === 'stamped'}
									<span class="tag-highlight glass-pill stub-status-pill">✓ STAMPED</span>
								{:else if data.collectionStatus === 'saved'}
									<span class="glass-pill">BOOKMARKED (SAVED)</span>
								{/if}
							</Cluster>
						</div>

						<!-- Collection Actions -->
						<Stack gap="sm">
							{#if data.collectionStatus === 'stamped'}
								<Box variant="raised" padding="md" radius="md" class="stamped-congrats-box">
									✓ You've stamped this gig! View it in <a href="/me/stubs" class="my-stubs-link">My Stubs</a>.
								</Box>
							{:else}
								<Cluster justify="center" align="center">
									{#if data.isScanVerified}
										<form method="POST" action="?/claimStamp" use:enhance>
											<input type="hidden" name="issueId" value={data.issue.id} />
											<button type="submit" class="floating-tip-btn btn-claim-stamp">
												★ Claim Verified Stamp
											</button>
										</form>
									{:else}
										<form method="POST" action="?/saveIssue" use:enhance>
											<input type="hidden" name="issueId" value={data.issue.id} />
											<button type="submit" class="glass-pill btn-save-issue">
												Save to Collection
											</button>
										</form>
									{/if}
								</Cluster>
							{/if}
						</Stack>
					</Stack>
				</div>

				<footer class="page-footer footer-endpaper">
					<a href="/a/{data.artist.slug}" class="artist-back-page-link">
						Visit {data.artist.displayName}'s Back Page →
					</a>
					<span>End of Zine</span>
				</footer>
			</Stack>
		</div>
	</section>
</div>

<!-- FLOATING TIP BUTTON (TRIGGER) -->
{#if !tipDrawerOpen}
	<button
		type="button"
		class="floating-tip-btn"
		onclick={() => (tipDrawerOpen = true)}
		aria-label="Tip Artist"
	>
		★ Tip ${(selectedTipCents / 100).toFixed(2)}
	</button>
{/if}

<!-- SLIDE-UP 1-TAP TIP DRAWER -->
{#if tipDrawerOpen}
	<div class="glass-drawer tip-drawer">
		<Stack gap="md">
			<Cluster justify="between" align="center">
				<Stack gap="3xs">
					<h3 class="tip-drawer-heading">
						Tip {data.artist.displayName}
					</h3>
					<span class="text-muted tip-drawer-sub">1-tap checkout. Anonymous. Bandcamp-style 5% platform cut.</span>
				</Stack>
				<button
					type="button"
					class="glass-pill btn-pointer"
					onclick={() => (tipDrawerOpen = false)}
				>
					✕ Close
				</button>
			</Cluster>

			<!-- Presets -->
			<Cluster align="center" gap="sm">
				{#each data.tipPresets as preset}
					<button
						type="button"
						class="glass-pill btn-pointer preset-btn {selectedTipCents === preset * 100 ? 'preset-active' : ''}"
						onclick={() => handleTipPreset(preset)}
					>
						${preset}
					</button>
				{/each}

				<input
					type="number"
					placeholder="Custom $"
					value={customAmountStr}
					oninput={(e) => handleCustomAmountChange((e.target as HTMLInputElement).value)}
					min="2"
					max="500"
					class="custom-amount-field"
				/>
			</Cluster>

			<!-- Fan Covered Fees Toggle -->
			<label class="btn-pointer">
				<Cluster align="center" gap="xs">
					<input type="checkbox" bind:checked={fanCoveredFees} />
					<span class="fee-toggle-label">Cover processing fee so {data.artist.displayName} gets 100% of the net</span>
				</Cluster>
			</label>

			<!-- Tip Action Form -->
			<form method="POST" action="?/tip" use:enhance>
				<Stack gap="xs">
					<input type="hidden" name="artistId" value={data.artist.id} />
					<input type="hidden" name="issueId" value={data.issue.id} />
					<input type="hidden" name="amountGrossCents" value={selectedTipCents} />
					<input type="hidden" name="fanCoveredFees" value={String(fanCoveredFees)} />

					<button
						type="submit"
						class="floating-tip-btn btn-send-tip"
					>
						Send ${(selectedTipCents / 100).toFixed(2)} Tip Now
					</button>
				</Stack>
			</form>

			{#if form?.error}
				<div class="tip-error-text">
					{form.error}
				</div>
			{/if}

			{#if form?.success && form?.tipResult}
				<Box variant="raised" padding="md" radius="md" class="tip-success-box">
					<div class="text-highlight tip-confirm-title">Tip Confirmed!</div>
					<p class="text-muted subtext-page">
						Thank you for supporting live music. Recorded in artist recap.
					</p>
				</Box>
			{/if}
		</Stack>
	</div>
{/if}

<style>
	.link-clean {
		text-decoration: none;
	}

	:global(.cover-middle-stack) {
		margin-block-start: auto;
		margin-block-end: var(--space-l);
	}

	.cover-note-text {
		max-inline-size: 55ch;
		font-size: 1.1rem;
		line-height: 1.5;
	}

	:global(.cover-actions-strip) {
		padding-block-start: var(--space-s);
		border-block-start: 1px solid var(--glass-border);
	}

	.btn-static {
		position: static;
		box-shadow: none;
	}

	.btn-open-zine {
		cursor: pointer;
		padding: 0.75rem 1.25rem;
		font-size: 0.9rem;
	}

	.subtext-page {
		font-size: 0.8rem;
	}

	.margin-auto {
		margin-block: auto;
	}

	.bespoke-heading {
		font-size: 1.8rem;
		font-weight: 700;
		color: #ffffff;
	}

	.bespoke-body-text {
		font-size: 1.15rem;
		line-height: 1.7;
		color: var(--paper);
	}

	:global(.song-row) {
		border-block-end: 1px solid var(--glass-border);
		padding-block: var(--space-2xs);
	}

	.wall-canvas {
		background-color: #07050e;
	}

	.wall-heading {
		font-size: 1.8rem;
		font-weight: 800;
		color: #ffffff;
	}

	.wall-subtext {
		font-size: 0.9rem;
	}

	.wall-textarea {
		inline-size: 100%;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		padding: 0.75rem;
		font-family: var(--font-sans);
		font-size: 0.95rem;
		resize: vertical;
	}

	.char-count {
		font-size: 0.75rem;
	}

	.post-note-btn {
		cursor: pointer;
		padding: 0.5rem 1rem;
	}

	.auth-btn {
		text-decoration: none;
		padding: 0.5rem 1rem;
	}

	.notes-scroll-body {
		overflow-y: auto;
		max-block-size: 40vh;
	}

	.empty-notes-text {
		text-align: center;
		padding: var(--space-l);
	}

	.note-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		inline-size: 28px;
		block-size: 28px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.06);
		font-weight: bold;
		font-size: 0.75rem;
		color: var(--highlight);
	}

	.note-author {
		font-weight: 600;
	}

	.flag-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.7rem;
	}

	.note-content-text {
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--paper);
	}

	.reply-author-label {
		font-weight: 700;
		font-size: 0.75rem;
	}

	.reply-content-text {
		color: #ffffff;
		font-size: 0.85rem;
	}

	.endpaper-canvas {
		background-color: var(--endpaper);
		color: #1a1a1a;
	}

	.endpaper-pill {
		color: #1a1a1a;
		border-color: rgba(0, 0, 0, 0.2);
	}

	.endpaper-admit {
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	.endpaper-stub {
		background: #1a1a1a;
		color: #ffffff;
		padding: var(--space-m);
	}

	.font-mono {
		font-family: var(--font-mono);
	}

	:global(.stub-main-content) {
		margin-block: var(--space-s);
	}

	.stub-heading {
		font-size: 1.8rem;
		font-weight: 800;
		color: #ffffff;
	}

	.stub-venue {
		color: var(--highlight);
		font-weight: 600;
	}

	:global(.stub-footer-strip) {
		margin-block-start: var(--space-2xs);
	}

	.stub-proof-label {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: #888888;
	}

	.stub-status-pill {
		font-weight: 700;
	}

	:global(.stamped-congrats-box) {
		text-align: center;
		border-color: rgba(0, 0, 0, 0.1);
		background: rgba(0, 0, 0, 0.05);
		color: #1a1a1a;
	}

	.my-stubs-link {
		color: var(--support);
		font-weight: 700;
	}

	.btn-claim-stamp {
		position: static;
		background: var(--ink);
		border: 2px solid var(--highlight);
		color: var(--highlight);
		box-shadow: none;
	}

	.btn-save-issue {
		cursor: pointer;
		padding: 0.75rem 1.5rem;
		background: #1a1a1a;
		color: #ffffff;
		border: none;
	}

	.footer-endpaper {
		color: #555555;
	}

	.artist-back-page-link {
		color: #1a1a1a;
		font-weight: 700;
		text-decoration: none;
	}

	.tip-drawer {
		position: fixed;
		inset-inline: 0;
		inset-block-end: 0;
		z-index: 100;
		padding: var(--space-m);
		border-radius: 24px 24px 0 0;
	}

	.tip-drawer-heading {
		font-size: 1.25rem;
		font-weight: 700;
		color: #ffffff;
	}

	.tip-drawer-sub {
		font-size: 0.8rem;
	}

	.btn-pointer {
		cursor: pointer;
	}

	.preset-btn {
		padding: 0.6rem 1.2rem;
		font-size: 1rem;
	}

	.preset-active {
		border-color: var(--support);
		color: var(--support);
		background: rgba(255, 42, 109, 0.15);
		font-weight: 700;
	}

	.custom-amount-field {
		inline-size: 100px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-full);
		color: #ffffff;
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
	}

	.fee-toggle-label {
		font-size: 0.85rem;
		color: var(--paper);
	}

	.btn-send-tip {
		position: static;
		inline-size: 100%;
		justify-content: center;
		padding: 1rem;
		font-size: 1.1rem;
		box-shadow: none;
	}

	.tip-error-text {
		color: var(--support);
		font-size: 0.85rem;
		text-align: center;
	}

	:global(.tip-success-box) {
		text-align: center;
		border-color: var(--highlight);
	}

	.tip-confirm-title {
		font-weight: 700;
	}
</style>
