<script lang="ts">
	import { enhance } from '$app/forms';
	import { Container, Box, Stack, Cluster, Grid } from '$lib/components/layout';

	import FeatureNotice from '$lib/components/site/FeatureNotice.svelte';

	let { data, form } = $props();

	let tipDrawerOpen = $state(false);
	let authDrawerOpen = $state(false);
	let selectedTipCents = $state(500);
	let customAmountStr = $state('');
	let fanCoveredFees = $state(false);
	let tipMessage = $state('');
	let noteBody = $state('');
	let wallMessage = $state('');

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
	<!-- Top Navigation -->
	<header class="app-topbar">
		<Container width="lg" padding="none">
			<Cluster justify="between" align="center" gap="md">
				<Cluster align="center" gap="sm">
					<a href="/" class="btn-back-link">← Quire Portal</a>
					<span class="text-highlight font-mono eyebrow-tag">ARTIST BACK PAGE</span>
				</Cluster>

				<Cluster align="center" gap="xs">
					<a href="/me/stubs" class="btn-nav-ghost">My Stubs</a>
					{#if data.session?.user}
						<form method="POST" action="/logout" class="signout-form">
							<input type="hidden" name="redirectTo" value="/a/{data.artist.slug}" />
							<button type="submit" class="btn-nav-ghost">
								Sign Out ({data.session.user.name})
							</button>
						</form>
					{:else}
						<button type="button" class="btn-nav-primary" onclick={() => (authDrawerOpen = true)}>
							Fan Sign In
						</button>
					{/if}
				</Cluster>
			</Cluster>
		</Container>
	</header>

	<Container as="main" width="lg" padding="md" class="artist-page-canvas">
		<Stack gap="xl">
			<!-- Artist Hero Card -->
			<Stack
				as="section"
				gap="md"
				class="artist-hero-banner"
				style="--cover-art: {data.artist.coverArtUrl
					? `linear-gradient(to bottom, rgba(9, 7, 16, 0.55), rgba(9, 7, 16, 0.96)), url('${data.artist.coverArtUrl}')`
					: 'none'};"
			>
				<Cluster justify="between" align="center" gap="sm">
					<Cluster align="center" gap="xs">
						<span class="meta-chip meta-accent">PERMANENT ARTIST HUB</span>
						{#if data.artist.verified}
							<span class="meta-chip meta-highlight">✓ Verified Artist</span>
						{/if}
					</Cluster>

					{#if data.artist.payoutsEnabled && !data.isArtistClosed}
						{#if data.features.payments}
							<button
								type="button"
								class="btn-hero-support"
								onclick={() => (tipDrawerOpen = true)}
							>
								Support {data.artist.displayName} (${(selectedTipCents / 100).toFixed(2)})
							</button>
						{:else}
							<FeatureNotice feature="payments" mode={data.features.mode} />
						{/if}
					{/if}
				</Cluster>

				{#if data.isArtistClosed}
					<Box variant="subtle" padding="md" radius="md" class="closed-artist-banner">
						<Stack gap="3xs">
							<span class="meta-chip meta-support">ACCOUNT CLOSED</span>
							<p class="artist-closed-copy">
								This artist has left Quire. Past issues remain archived in read-only mode for fans who collected Stubs.
							</p>
						</Stack>
					</Box>
				{/if}

				<Stack gap="xs">
					<h1 class="artist-name-title">{data.artist.displayName}</h1>
					{#if data.artist.bio}
						<p class="artist-bio-text">{data.artist.bio}</p>
					{/if}
				</Stack>

				{#if data.links.length > 0}
					<Cluster gap="xs" class="links-cluster">
						{#each data.links as link}
							<a
								href={link.url}
								target="_blank"
								rel="noopener noreferrer"
								class="btn-artist-link"
							>
								↗ {link.label}
							</a>
						{/each}
					</Cluster>
				{/if}
			</Stack>

			<!-- All Issues Grouped by Month -->
			<Stack as="section" gap="md">
				<Cluster justify="between" align="center">
					<h2 class="section-title">All Gig Issues</h2>
					<span class="text-muted subtext-small">City-specific tour zines</span>
				</Cluster>

				{#if data.isArtistClosed}
					<Box variant="raised" padding="xl" radius="md" class="empty-issues-box">
						This artist has left Quire.
					</Box>
				{:else if data.groupedIssues.length === 0}
					<Box variant="raised" padding="xl" radius="md" class="empty-issues-box">
						No published issues yet.
					</Box>
				{:else}
					<Stack gap="lg">
						{#each data.groupedIssues as group, idx (group.key)}
							<details open={idx === 0} class="month-accordion">
								<summary class="month-accordion-summary">
									<span class="text-highlight group-month-heading">{group.month}</span>
									<span class="month-count-badge">
										{group.issues.length} {group.issues.length === 1 ? 'show' : 'shows'}
									</span>
								</summary>

								<div class="month-accordion-body">
									<Grid min="sm" gap="md">
										{#each group.issues as issue (issue.id)}
											<Box
												as="a"
												href="/i/{issue.slug}"
												variant="raised"
												padding="lg"
												radius="lg"
												class="issue-card-box"
											>
												<Stack gap="sm">
													<Cluster justify="between" align="center">
														<span class="meta-chip meta-highlight">{issue.date}</span>
														{#if issue.status === 'cancelled'}
															<span class="meta-chip meta-support">Cancelled</span>
														{:else}
															<span class="text-muted font-mono zine-num">{issue.venue}</span>
														{/if}
													</Cluster>

													<h4 class="issue-city-title">{issue.city}</h4>

													{#if issue.coverNote}
														<p class="text-muted issue-note-snippet">"{issue.coverNote}"</p>
													{/if}

													<span class="text-highlight open-zine-cue">Open Issue Zine →</span>
												</Stack>
											</Box>
										{/each}
									</Grid>
								</div>
							</details>
						{/each}
					</Stack>
				{/if}
			</Stack>

			<!-- GENERAL WALL (SPEC.md §5.3 & §5.5) -->
			<Stack as="section" gap="md" id="general-wall">
				<Stack gap="2xs">
					<h2 class="section-title">General Wall</h2>
					<p class="text-muted subtext-small">
						Public guestbook for {data.artist.displayName}. Notes go live immediately—no links, emails, or phone numbers.
					</p>
				</Stack>

				<Box variant="raised" padding="lg" radius="lg" class="wall-card-box">
					{#if data.isArtistClosed}
						<p class="text-muted subtext-small">
							This artist has left Quire. The General Wall is preserved in read-only mode.
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
												: 'Your note is live on the General Wall!';
									} else if (result.type === 'failure') {
										wallMessage = String(result.data?.error || 'Could not post note.');
									}
									await update();
								};
							}}
						>
							<input type="hidden" name="artistId" value={data.artist.id} />
							<textarea
								name="body"
								bind:value={noteBody}
								placeholder="Leave a message on {data.artist.displayName}'s General Wall..."
								rows="2"
								maxlength="250"
								required
								class="wall-textarea"
							></textarea>
							<Cluster justify="between" align="center">
								<span class="text-muted subtext-xs">{250 - noteBody.length} characters left</span>
								<button type="submit" class="btn-wall-post">
									Post Note →
								</button>
							</Cluster>
						</form>
					{:else}
						<Stack gap="sm">
							<textarea
								bind:value={noteBody}
								placeholder="Type your note to {data.artist.displayName}..."
								rows="2"
								maxlength="250"
								class="wall-textarea"
							></textarea>
							<Cluster justify="between" align="center">
								<span class="text-muted subtext-xs">{250 - noteBody.length} characters left</span>
								<button
									type="button"
									class="btn-wall-post"
									onclick={() => (authDrawerOpen = true)}
								>
									Sign in with Google to Post →
								</button>
							</Cluster>
						</Stack>
					{/if}

					{#if wallMessage || form?.error}
						<p class="text-highlight feedback-msg">{wallMessage || form?.error}</p>
					{/if}
				</Box>

				<Stack gap="sm">
					{#if data.generalNotes.length === 0}
						<Box variant="subtle" padding="lg" radius="md">
							<p class="text-muted">No notes on the General Wall yet. Leave the first one!</p>
						</Box>
					{:else}
						{#each data.generalNotes as note}
							<Stack as="article" gap="xs" class="note-card">
								<Cluster justify="between" align="center">
									<Cluster align="center" gap="xs">
										<div class="note-avatar">
											{note.author?.name ? note.author.name[0] : 'F'}
										</div>
										<span class="note-author">{note.author?.name || 'Fan'}</span>
									</Cluster>

									{#if data.session?.user && !data.isArtistClosed}
										<form method="POST" action="?/flagNote" use:enhance>
											<input type="hidden" name="noteId" value={note.id} />
											<button type="submit" class="btn-flag-note">
												Flag
											</button>
										</form>
									{/if}
								</Cluster>

								<p class="note-body-copy">{note.body}</p>

								{#if note.replies && note.replies.length > 0}
									<Stack gap="3xs" class="artist-reply">
										<span class="text-accent reply-label">
											✓ {data.artist.displayName} (Artist)
										</span>
										<p class="reply-copy">{note.replies[0].body}</p>
									</Stack>
								{/if}
							</Stack>
						{/each}
					{/if}
				</Stack>
			</Stack>
		</Stack>
	</Container>
</div>

<!-- BOTTOM-SHEET AUTH DRAWER -->
{#if authDrawerOpen}
	<div class="drawer-backdrop">
		<Stack gap="md" class="glass-drawer bottom-sheet-modal" role="dialog" aria-modal="true" aria-label="Fan Sign In">
			<div class="drawer-handle"></div>
			<Cluster justify="between" align="center">
				<Stack gap="3xs">
					<span class="text-highlight font-mono eyebrow-tag">FAN IDENTITY</span>
					<h3 class="drawer-title">Sign in with Google</h3>
				</Stack>
				<button type="button" class="btn-drawer-close" onclick={() => (authDrawerOpen = false)}>
					✕ Close
				</button>
			</Cluster>

			<p class="text-muted subtext-small">
				Sign in to post on {data.artist.displayName}’s Wall and access your collected gig stubs.
			</p>

			{#if form?.fanSignInError}
				<p class="feature-notice" role="alert">{form.fanSignInError}</p>
			{/if}
			{#if data.features.fanSignIn}
				<form method="POST" action="?/googleAuth" use:enhance>
					<button type="submit" class="google-sheet-btn">
						Continue with Google
					</button>
				</form>
			{:else}
				<FeatureNotice feature="fanSignIn" mode={data.features.mode} />
			{/if}
		</Stack>
	</div>
{/if}

<!-- GENERAL TIP DRAWER -->
{#if tipDrawerOpen}
	<div class="drawer-backdrop">
		<Stack gap="md" class="glass-drawer bottom-sheet-modal" role="dialog" aria-modal="true" aria-label="Support {data.artist.displayName}">
			<div class="drawer-handle"></div>
			<Cluster justify="between" align="center">
				<Stack gap="3xs">
					<span class="text-support font-mono eyebrow-tag">GENERAL TIP</span>
					<h3 class="drawer-title">Support {data.artist.displayName}</h3>
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
				<label for="bp-custom-tip" class="drawer-label">Custom Amount ($2 – $500 USD)</label>
				<input
					id="bp-custom-tip"
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
				<span class="subtext-small">
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
							tipMessage = `✓ General Tip Confirmed! $${(selectedTipCents / 100).toFixed(2)} sent to ${data.artist.displayName}.`;
						} else if (result.type === 'failure' && result.status === 429) {
							tipMessage = `${String(result.data?.error ?? 'Too many tips right now.')} Nothing was charged.`;
						} else {
							tipMessage = "That didn't go through. Nothing was charged.";
						}
					};
				}}
			>
				<input type="hidden" name="artistId" value={data.artist.id} />
				<input type="hidden" name="amountGrossCents" value={selectedTipCents} />
				<input type="hidden" name="fanCoveredFees" value={String(fanCoveredFees)} />

				<button type="submit" class="btn-submit-tip">
					Send ${(selectedTipCents / 100).toFixed(2)} General Tip
				</button>
			</form>
		</Stack>
	</div>
{/if}

<style>
	.artist-page-root {
		background-color: var(--bg-void);
	}

	:global(.artist-page-canvas) {
		padding-block: var(--space-xl);
	}

	.eyebrow-tag {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
	}

	:global(.artist-hero-banner) {
		background-color: var(--bg-surface);
		background-image: var(--cover-art, none);
		background-size: cover;
		background-position: center;
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-lg);
		padding-block: var(--space-m-xl);
		padding-inline: var(--space-m-xl);
	}

	.artist-name-title {
		font-size: var(--text-display);
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-tight);
		color: #ffffff;
	}

	.artist-bio-text {
		font-size: var(--text-body);
		line-height: var(--leading-body);
		max-inline-size: 62ch;
		color: #d4d2df;
	}

	:global(.links-cluster) {
		padding-block-start: var(--space-2xs);
	}

	.section-title {
		font-size: var(--text-heading-sm);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.subtext-small {
		font-size: var(--text-body);
	}

	.subtext-xs {
		font-size: var(--text-body);
	}

	.month-accordion {
		border-block-end: 1px solid var(--glass-border);
		padding-block-end: var(--space-md);
	}

	.month-accordion-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		padding-block: var(--space-2xs);
		cursor: pointer;
		list-style: none;
	}

	.month-accordion-summary::-webkit-details-marker {
		display: none;
	}

	.month-accordion-summary::after {
		content: '+';
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		color: var(--text-muted);
	}

	.month-accordion[open] > .month-accordion-summary::after {
		content: '-';
		color: var(--highlight);
	}

	.month-count-badge {
		margin-inline-start: auto;
		font-family: var(--font-mono);
		font-size: var(--text-meta);
		color: var(--text-muted);
	}

	.month-accordion-body {
		padding-block-start: var(--space-sm);
	}

	.group-month-heading {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}

	:global(.issue-card-box) {
		border-color: var(--glass-border);
		text-decoration: none;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}

	:global(.issue-card-box:hover) {
		border-color: var(--highlight);
		transform: translateY(-2px);
	}

	.zine-num {
		font-size: var(--text-meta);
	}

	.issue-city-title {
		font-size: var(--text-lead);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.issue-note-snippet {
		font-size: var(--text-small);
		line-height: var(--leading-snug);
	}

	.open-zine-cue {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
	}

	:global(.wall-card-box) {
		border-color: var(--glass-border);
	}

	.wall-textarea {
		inline-size: 100%;
		background: rgba(0, 0, 0, 0.45);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		padding-block: var(--space-xs);
		padding-inline: var(--space-xs);
		font-size: var(--text-body);
		resize: none;
	}

	.feedback-msg {
		font-size: var(--text-small);
		margin-block-start: var(--space-2xs);
	}

	.note-body-copy {
		font-size: var(--text-body);
		line-height: var(--leading-body);
		color: #f4f4f0;
	}

	.reply-label {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
	}

	.reply-copy {
		font-size: var(--text-small);
		color: #ffffff;
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

	/* Sleek Rectangular Buttons & Badges (Zero 9999px Pills) */
	.btn-back-link {
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

	.btn-back-link:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
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

	.btn-hero-support {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		border-radius: 8px;
		background: var(--support);
		color: #ffffff;
		border: 1px solid rgba(255, 42, 109, 0.5);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		cursor: pointer;
		box-shadow: 0 0 20px rgba(255, 42, 109, 0.35);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-hero-support:hover {
		transform: translateY(-1px);
		box-shadow: 0 0 26px rgba(255, 42, 109, 0.6);
	}

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
		font-weight: var(--weight-semibold);
		text-decoration: none;
		transition: background-color 0.15s ease;
	}

	.btn-artist-link:hover {
		background: rgba(1, 255, 195, 0.22);
		color: var(--highlight);
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

	.meta-chip.meta-support {
		background: rgba(255, 42, 109, 0.14);
		border: 1px solid rgba(255, 42, 109, 0.4);
		color: #ff6b9b;
	}

	:global(.closed-artist-banner) {
		border-color: rgba(255, 42, 109, 0.45);
	}

	.artist-closed-copy {
		margin: 0;
		color: #ffffff;
		font-size: var(--text-ui);
		line-height: var(--leading-body);
	}
</style>
