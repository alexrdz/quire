<script lang="ts">
	import { enhance } from '$app/forms';
	import { Center, Box, Stack, Cluster, Grid } from '$lib/components/layout';

	let { data, form } = $props();

	let replyingToNoteId = $state<string | null>(null);
	let replyText = $state('');
</script>

<svelte:head>
	<title>{data.artist.displayName} — Artist Dashboard | Quire</title>
</svelte:head>

<div class="dashboard-root" style="--accent: {data.artist.accentColor || '#05D9E8'};">
	<Center max="lg" padding="md" class="dashboard-canvas">
		<Stack gap="xl">
			<!-- Navigation Bar -->
			<header class="cover-header">
				<Cluster align="center" gap="sm">
					<span class="glass-pill text-highlight brand-tag">QUIRE</span>
					<h1 class="artist-heading">
						{data.artist.displayName}
					</h1>
				</Cluster>

				<Cluster align="center" gap="xs">
					<a href="/dashboard/issues/quick" class="floating-tip-btn btn-nav-action">
						+ Quick Issue (Phone)
					</a>
					<a href="/dashboard/template" class="glass-pill nav-pill-link">
						Master Template
					</a>
					<a href="/dashboard/settings" class="glass-pill nav-pill-link">
						Settings & Payouts
					</a>
					<a href="/a/{data.artist.slug}" class="glass-pill text-highlight nav-pill-link">
						View Back Page ↗
					</a>
				</Cluster>
			</header>

			<!-- Stripe Callout if Payouts Not Enabled -->
			{#if !data.artist.payoutsEnabled}
				<Box variant="raised" padding="md" class="stripe-warning-box">
					<Cluster justify="between" align="center" gap="md">
						<Stack gap="xs">
							<span class="text-support stripe-callout-title">
								● Stripe Connect Onboarding Pending
							</span>
							<p class="text-muted stripe-callout-text">
								Tip buttons remain hidden on your live zines until payouts are connected (in demo mode, test tipping is simulated).
							</p>
						</Stack>
						<a href="/dashboard/settings" class="glass-pill tag-support action-pill-btn">
							Connect Stripe →
						</a>
					</Cluster>
				</Box>
			{/if}

			<!-- MORNING-AFTER GIG RECAP CARD -->
			{#if data.latestRecap}
				<Box variant="raised" padding="lg">
					<Stack gap="md">
						<Cluster justify="between" align="center">
							<Cluster align="center" gap="xs">
								<span class="glass-pill tag-highlight">Morning-After Gig Recap</span>
								<span class="text-muted recap-date-label">{data.latestRecap.issue.date}</span>
							</Cluster>
							<a href="/i/{data.latestRecap.issue.slug}" class="glass-pill text-highlight open-zine-link">
								Open Zine ↗
							</a>
						</Cluster>

						<Stack gap="xs">
							<h2 class="recap-headline">
								{data.latestRecap.issue.city} @ {data.latestRecap.issue.venue}
							</h2>
							<p class="text-muted recap-subtitle">
								Only money and people. No vanity metrics.
							</p>
						</Stack>

						<!-- Metric Tiles -->
						<Grid min="xs" gap="md">
							<Box variant="subtle" padding="md">
								<Stack gap="xs">
									<span class="text-muted metric-label">Gross Tips</span>
									<span class="metric-number">
										${(data.latestRecap.grossTipsCents / 100).toFixed(2)}
									</span>
									<span class="text-muted metric-hint">From {data.latestRecap.tipperCount} supporters</span>
								</Stack>
							</Box>

							<Box variant="subtle" padding="md">
								<Stack gap="xs">
									<span class="text-muted metric-label">Net to Band</span>
									<span class="metric-number metric-highlight">
										${(data.latestRecap.netTipsCents / 100).toFixed(2)}
									</span>
									<span class="text-muted metric-hint">After processing & fees</span>
								</Stack>
							</Box>

							<Box variant="subtle" padding="md">
								<Stack gap="xs">
									<span class="text-muted metric-label">Attended Stamps</span>
									<span class="metric-number">
										{data.latestRecap.stampsCount}
									</span>
									<span class="text-muted metric-hint">Physical venue QR scans</span>
								</Stack>
							</Box>

							<Box variant="subtle" padding="md">
								<Stack gap="xs">
									<span class="text-muted metric-label">Bookmarked</span>
									<span class="metric-number">
										{data.latestRecap.savesCount}
									</span>
									<span class="text-muted metric-hint">Saved to Fan collections</span>
								</Stack>
							</Box>
						</Grid>
					</Stack>
				</Box>
			{/if}

			<!-- ALL GIGS TABLE -->
			<Stack gap="md">
				<Cluster justify="between" align="center">
					<h2 class="section-heading">All Gigs & Issues</h2>
					<a href="/dashboard/issues/quick" class="glass-pill text-highlight publish-link">+ Publish Show</a>
				</Cluster>

				<Box variant="raised" padding="none" class="table-container-shell">
					<div class="table-scroll-wrap">
						<table class="gigs-table">
							<thead>
								<tr class="table-header-row">
									<th class="table-cell">Date</th>
									<th class="table-cell">City & Venue</th>
									<th class="table-cell">Status</th>
									<th class="table-cell">Tips Gross</th>
									<th class="table-cell">Stamps</th>
									<th class="table-cell align-end">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each data.issues as issue}
									<tr class="table-body-row">
										<td class="table-cell font-mono">{issue.date}</td>
										<td class="table-cell">
											<div class="cell-primary-text">{issue.city}</div>
											<div class="text-muted cell-subtext">{issue.venue}</div>
										</td>
										<td class="table-cell">
											<span class="glass-pill status-pill {issue.status === 'published' ? 'tag-highlight' : ''}">
												{issue.status}
											</span>
										</td>
										<td class="table-cell font-semibold">
											${(((issue.tips as Array<{ amountGross: number }> | undefined)?.reduce((s: number, t: { amountGross: number }) => s + t.amountGross, 0) || 0) / 100).toFixed(2)}
										</td>
										<td class="table-cell">
											{(issue.collections as Array<{ kind: string }> | undefined)?.filter((c: { kind: string }) => c.kind === 'stamped').length || 0}
										</td>
										<td class="table-cell align-end">
											<Cluster justify="end" gap="xs">
												<a href="/dashboard/bookbinder/{issue.id}" class="glass-pill action-pill">
													Edit Zine
												</a>
												<a href="/i/{issue.slug}" class="glass-pill text-highlight action-pill">
													View ↗
												</a>
											</Cluster>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</Box>
			</Stack>

			<!-- MODERATION & GUESTBOOK QUEUE -->
			<Box variant="raised" padding="lg">
				<Stack gap="md">
					<Cluster justify="between" align="center">
						<Stack gap="3xs">
							<h2 class="section-heading">Wall Guestbook & Replies</h2>
							<p class="text-muted subtext-small">Reply to fans or moderate flagged posts.</p>
						</Stack>
						<span class="glass-pill">{data.pendingNotes.length} notes</span>
					</Cluster>

					<Stack gap="sm">
						{#each data.pendingNotes as note}
							<Box variant="subtle" padding="md" class="note-card-box">
								<Stack gap="sm">
									<Cluster justify="between" align="center">
										<Cluster align="center" gap="xs">
											<div class="note-avatar">
												{note.author?.name ? note.author.name[0] : 'F'}
											</div>
											<span class="note-author-name">{note.author?.name || 'Fan'}</span>
											{#if note.issue}
												<span class="glass-pill note-badge">{note.issue.city}</span>
											{:else}
												<span class="glass-pill note-badge">General Wall</span>
											{/if}
											{#if note.status === 'hidden'}
												<span class="tag-support glass-pill note-badge">Hidden (Flagged)</span>
											{/if}
										</Cluster>

										<Cluster align="center" gap="xs">
											{#if note.status === 'hidden'}
												<form method="POST" action="?/restoreNote" use:enhance>
													<input type="hidden" name="noteId" value={note.id} />
													<button type="submit" class="glass-pill tag-highlight note-action-btn">
														Restore Note
													</button>
												</form>
											{/if}

											<form method="POST" action="?/deleteNote" use:enhance>
												<input type="hidden" name="noteId" value={note.id} />
												<button type="submit" class="glass-pill text-muted note-action-btn">
													Delete
												</button>
											</form>
										</Cluster>
									</Cluster>

									<p class="note-body-text">
										"{note.body}"
									</p>

									<!-- Existing Reply -->
									{#if note.replies && note.replies.length > 0}
										<div class="artist-reply">
											<span class="text-highlight reply-label">Your Reply:</span>
											<p class="reply-text">{note.replies[0].body}</p>
										</div>
									{:else}
										<!-- Reply Action Form -->
										{#if replyingToNoteId === note.id}
											<form method="POST" action="?/reply" use:enhance class="reply-form">
												<Stack gap="xs">
													<input type="hidden" name="noteId" value={note.id} />
													<input
														type="text"
														name="body"
														bind:value={replyText}
														placeholder="Type your single-tier artist reply..."
														required
														maxlength="300"
														class="reply-input"
													/>
													<Cluster justify="between" align="center">
														<button type="button" class="glass-pill" onclick={() => (replyingToNoteId = null)}>
															Cancel
														</button>
														<button type="submit" class="glass-pill tag-highlight post-reply-btn">
															Post Reply
														</button>
													</Cluster>
												</Stack>
											</form>
										{:else}
											<div>
												<button
													type="button"
													class="glass-pill text-highlight reply-prompt-btn"
													onclick={() => { replyingToNoteId = note.id; replyText = ''; }}
												>
													+ Reply as Artist
												</button>
											</div>
										{/if}
									{/if}
								</Stack>
							</Box>
						{/each}
					</Stack>
				</Stack>
			</Box>
		</Stack>
	</Center>
</div>

<style>
	.dashboard-root {
		background-color: var(--ink);
		min-block-size: 100vh;
	}

	:global(.dashboard-canvas) {
		padding-block: var(--space-xl);
	}

	.brand-tag {
		font-weight: 800;
	}

	.artist-heading {
		font-size: 1.25rem;
		font-weight: 700;
		color: #ffffff;
	}

	.btn-nav-action {
		position: static;
		padding: 0.5rem 1rem;
		font-size: 0.85rem;
		box-shadow: none;
	}

	.nav-pill-link {
		text-decoration: none;
	}

	:global(.stripe-warning-box) {
		border-color: var(--support);
		background: rgba(255, 42, 109, 0.05);
	}

	.stripe-callout-title {
		font-weight: 700;
		font-size: 0.95rem;
	}

	.stripe-callout-text {
		font-size: 0.85rem;
	}

	.action-pill-btn {
		text-decoration: none;
		padding: 0.5rem 1rem;
	}

	.recap-date-label {
		font-size: 0.85rem;
	}

	.open-zine-link {
		text-decoration: none;
		font-size: 0.8rem;
	}

	.recap-headline {
		font-size: 2rem;
		font-weight: 800;
		color: #ffffff;
	}

	.recap-subtitle {
		font-size: 0.95rem;
	}

	.metric-label {
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.metric-number {
		font-size: 1.8rem;
		font-weight: 800;
		color: #ffffff;
	}

	.metric-highlight {
		color: var(--highlight);
	}

	.metric-hint {
		font-size: 0.75rem;
	}

	.section-heading {
		font-size: 1.4rem;
		font-weight: 700;
		color: #ffffff;
	}

	.publish-link {
		text-decoration: none;
	}

	:global(.table-container-shell) {
		overflow-x: auto;
	}

	.table-scroll-wrap {
		inline-size: 100%;
		overflow-x: auto;
	}

	.gigs-table {
		inline-size: 100%;
		border-collapse: collapse;
		text-align: start;
		font-size: 0.9rem;
	}

	.table-header-row {
		border-block-end: 1px solid var(--glass-border);
		color: var(--ink-muted);
		text-transform: uppercase;
		font-size: 0.75rem;
	}

	.table-body-row {
		border-block-end: 1px solid rgba(255, 255, 255, 0.05);
	}

	.table-cell {
		padding: 1rem;
	}

	.align-end {
		text-align: end;
	}

	.font-mono {
		font-family: var(--font-mono);
	}

	.font-semibold {
		font-weight: 600;
	}

	.cell-primary-text {
		font-weight: 700;
		color: #ffffff;
	}

	.cell-subtext {
		font-size: 0.8rem;
	}

	.status-pill {
		font-size: 0.7rem;
	}

	.action-pill {
		text-decoration: none;
		font-size: 0.75rem;
	}

	.subtext-small {
		font-size: 0.85rem;
	}

	:global(.note-card-box) {
		border-color: rgba(255, 255, 255, 0.08);
	}

	.note-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		inline-size: 28px;
		block-size: 28px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.06);
		font-size: 0.75rem;
		color: var(--highlight);
	}

	.note-author-name {
		font-weight: 600;
	}

	.note-badge {
		font-size: 0.7rem;
	}

	.note-action-btn {
		cursor: pointer;
		font-size: 0.75rem;
	}

	.note-body-text {
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--paper);
	}

	.reply-label {
		font-weight: 700;
		font-size: 0.75rem;
	}

	.reply-text {
		color: #ffffff;
		font-size: 0.85rem;
	}

	.reply-form {
		margin-block-start: 0.5rem;
	}

	.reply-input {
		inline-size: 100%;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		padding: 0.5rem 0.75rem;
		font-size: 0.85rem;
	}

	.post-reply-btn {
		cursor: pointer;
	}

	.reply-prompt-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0;
	}
</style>
