<script lang="ts">
	import { enhance } from '$app/forms';
	import { Center, Box, Stack, Cluster, Grid } from '$lib/components/layout';

	let { data, form } = $props();

	let tipDrawerOpen = $state(false);
	let selectedTipCents = $state(500);
	let customAmountStr = $state('');
	let fanCoveredFees = $state(false);
	let noteBody = $state('');

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
</script>

<svelte:head>
	<title>{data.artist.displayName} — Quire Back Page</title>
</svelte:head>

<div class="artist-page-root" style="--accent: {data.artist.accentColor || '#05D9E8'};">
	<Center max="lg" padding="md" class="artist-page-canvas">
		<Stack gap="xl">
			<!-- Header / Bio -->
			<header>
				<Box variant="raised" padding="xl" radius="lg" class="header-card">
					<Stack gap="md">
						<Cluster justify="between" align="center">
							<Cluster align="center" gap="xs">
								<span class="glass-pill text-highlight">Artist Back Page</span>
								{#if data.artist.verified}
									<span class="glass-pill tag-highlight">✓ Verified Artist</span>
								{/if}
							</Cluster>

							<button
								type="button"
								class="floating-tip-btn btn-support-static"
								onclick={() => (tipDrawerOpen = true)}
							>
								Support (${(selectedTipCents / 100).toFixed(2)})
							</button>
						</Cluster>

						<Stack gap="xs" class="bio-section">
							<h1 class="artist-name-title">
								{data.artist.displayName}
							</h1>
							{#if data.artist.bio}
								<p class="text-muted artist-bio-text">
									{data.artist.bio}
								</p>
							{/if}
						</Stack>

						<!-- External Links (Bandcamp, Tickets, Merch) -->
						{#if data.links.length > 0}
							<div class="links-strip">
								<Cluster gap="xs">
									{#each data.links as link}
										<a
											href={link.url}
											target="_blank"
											rel="noopener noreferrer"
											class="glass-pill link-external"
										>
											↗ {link.label}
										</a>
									{/each}
								</Cluster>
							</div>
						{/if}
					</Stack>
				</Box>
			</header>

			<!-- All Issues Grouped by Month -->
			<Stack gap="md" as="section">
				<Cluster justify="between" align="center">
					<h2 class="section-title">All Gig Issues</h2>
					<span class="text-muted subtext-small">Permanent archive</span>
				</Cluster>

				{#if data.groupedIssues.length === 0}
					<Box variant="raised" padding="xl" radius="md" class="empty-issues-box">
						No published issues yet.
					</Box>
				{:else}
					<Stack gap="lg">
						{#each data.groupedIssues as group}
							<Stack gap="sm">
								<h3 class="text-highlight group-month-heading">
									{group.month}
								</h3>

								<Grid min="sm" gap="md">
									{#each group.issues as issue}
										<a
											href="/i/{issue.slug}"
											class="issue-card-link"
										>
											<Box variant="raised" padding="md" radius="md" class="issue-card-box">
												<Stack gap="xs">
													<Cluster justify="between" align="center">
														<span class="glass-pill tag-highlight date-badge">{issue.date}</span>
														<span class="text-muted zine-num">Zine #{issue.slug}</span>
													</Cluster>
													<h4 class="issue-city-title">
														{issue.city}
													</h4>
													<p class="text-muted issue-venue-text">
														{issue.venue}
													</p>
												</Stack>

												<div class="open-zine-cue">
													Open Zine →
												</div>
											</Box>
										</a>
									{/each}
								</Grid>
							</Stack>
						{/each}
					</Stack>
				{/if}
			</Stack>

			<!-- General Wall -->
			<Box variant="raised" padding="xl" radius="lg" as="section">
				<Stack gap="md">
					<Cluster justify="between" align="center">
						<div>
							<h2 class="section-title">General Wall</h2>
							<p class="text-muted subtext-small">Open guestbook for {data.artist.displayName}.</p>
						</div>
						<span class="glass-pill">Public Notes</span>
					</Cluster>

					<!-- Note Submission Form -->
					{#if data.session?.user}
						<form method="POST" action="?/submitNote" use:enhance>
							<Stack gap="sm">
								<input type="hidden" name="artistId" value={data.artist.id} />
								<textarea
									name="body"
									bind:value={noteBody}
									placeholder="Say hello to the band..."
									rows="3"
									maxlength="500"
									class="note-textarea"
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
								placeholder="Type a note..."
								rows="3"
								maxlength="500"
								class="note-textarea"
							></textarea>
							<Cluster justify="between" align="center">
								<span class="text-muted char-count">Draft saved</span>
								<a
									href="/login?redirect=/a/{data.artist.slug}"
									class="glass-pill tag-highlight auth-cta-link"
								>
									Sign in with Google to Post
								</a>
							</Cluster>
						</Stack>
					{/if}

					<!-- Notes Stream -->
					<Stack gap="sm" class="notes-stream">
						{#if data.generalNotes.length === 0}
							<div class="text-muted empty-wall-text">
								No notes yet on the General Wall.
							</div>
						{:else}
							{#each data.generalNotes as note}
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

										<p class="note-text">
											{note.body}
										</p>

										{#if note.replies && note.replies.length > 0}
											<div class="artist-reply">
												<Stack gap="3xs">
													<span class="text-highlight reply-header">
														{data.artist.displayName} (Artist Reply)
													</span>
													<p class="reply-text">
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
				</Stack>
			</Box>

			<footer class="page-footer">
				<span>Quire Artist Back Page</span>
				<a href="/" class="powered-by-link">Powered by Quire</a>
			</footer>
		</Stack>
	</Center>
</div>

<!-- SLIDE-UP TIP DRAWER -->
{#if tipDrawerOpen}
	<div class="glass-drawer tip-drawer">
		<Stack gap="md">
			<Cluster justify="between" align="center">
				<Stack gap="3xs">
					<h3 class="drawer-heading">
						Tip {data.artist.displayName}
					</h3>
					<span class="text-muted drawer-subtitle">1-tap general tip. Anonymous.</span>
				</Stack>
				<button
					type="button"
					class="glass-pill close-btn"
					onclick={() => (tipDrawerOpen = false)}
				>
					✕ Close
				</button>
			</Cluster>

			<Cluster align="center" gap="sm">
				{#each data.tipPresets as preset}
					<button
						type="button"
						class="glass-pill preset-btn {selectedTipCents === preset * 100 ? 'preset-active' : ''}"
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
					class="custom-amount-input"
				/>
			</Cluster>

			<form method="POST" action="?/tip" use:enhance>
				<Stack gap="xs">
					<input type="hidden" name="artistId" value={data.artist.id} />
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

			{#if form?.success && form?.tipResult}
				<Box variant="raised" padding="md" radius="md" class="tip-success-box">
					<div class="text-highlight tip-confirm-title">Tip Confirmed!</div>
					<p class="text-muted subtext-small">
						Thank you for supporting {data.artist.displayName}.
					</p>
				</Box>
			{/if}
		</Stack>
	</div>
{/if}

<style>
	.artist-page-root {
		background-color: var(--ink);
		min-block-size: 100vh;
	}

	:global(.artist-page-canvas) {
		padding-block: var(--space-xl);
	}

	:global(.header-card) {
		position: relative;
		overflow: hidden;
	}

	.btn-support-static {
		position: static;
		box-shadow: none;
	}

	:global(.bio-section) {
		margin-block-start: var(--space-s);
	}

	.artist-name-title {
		font-size: clamp(2rem, 5vw, 3.5rem);
		font-weight: 800;
		color: #ffffff;
	}

	.artist-bio-text {
		max-inline-size: 60ch;
		font-size: 1.1rem;
		line-height: 1.6;
	}

	.links-strip {
		padding-block-start: var(--space-s);
		border-block-start: 1px solid var(--glass-border);
	}

	.link-external {
		text-decoration: none;
		color: var(--paper);
	}

	.section-title {
		font-size: 1.6rem;
		font-weight: 700;
		color: #ffffff;
	}

	.subtext-small {
		font-size: 0.85rem;
	}

	:global(.empty-issues-box) {
		text-align: center;
		color: var(--ink-muted);
	}

	.group-month-heading {
		font-size: 1.1rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.issue-card-link {
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
	}

	:global(.issue-card-box) {
		inline-size: 100%;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-block-size: 100%;
		transition: transform 0.15s ease;
	}

	:global(.issue-card-box:hover) {
		transform: translateY(-2px);
	}

	.date-badge {
		font-size: 0.7rem;
	}

	.zine-num {
		font-size: 0.75rem;
	}

	.issue-city-title {
		font-size: 1.3rem;
		font-weight: 700;
		color: #ffffff;
		margin-block-start: var(--space-2xs);
	}

	.issue-venue-text {
		font-size: 0.9rem;
	}

	.open-zine-cue {
		margin-block-start: var(--space-s);
		color: var(--highlight);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.note-textarea {
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

	.auth-cta-link {
		text-decoration: none;
		padding: 0.5rem 1rem;
	}

	:global(.notes-stream) {
		margin-block-start: var(--space-s);
	}

	.empty-wall-text {
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

	.note-text {
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--paper);
	}

	.reply-header {
		font-weight: 700;
		font-size: 0.75rem;
	}

	.reply-text {
		color: #ffffff;
		font-size: 0.85rem;
	}

	.powered-by-link {
		color: var(--highlight);
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

	.drawer-heading {
		font-size: 1.25rem;
		font-weight: 700;
		color: #ffffff;
	}

	.drawer-subtitle {
		font-size: 0.8rem;
	}

	.close-btn {
		cursor: pointer;
	}

	.preset-btn {
		cursor: pointer;
		padding: 0.6rem 1.2rem;
		font-size: 1rem;
	}

	.preset-active {
		border-color: var(--support);
		color: var(--support);
		background: rgba(255, 42, 109, 0.15);
		font-weight: 700;
	}

	.custom-amount-input {
		inline-size: 100px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-full);
		color: #ffffff;
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
	}

	.btn-send-tip {
		position: static;
		inline-size: 100%;
		justify-content: center;
		padding: 1rem;
		font-size: 1.1rem;
		box-shadow: none;
	}

	:global(.tip-success-box) {
		text-align: center;
		border-color: var(--highlight);
	}

	.tip-confirm-title {
		font-weight: 700;
	}
</style>
