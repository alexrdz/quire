<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let replyingToNoteId = $state<string | null>(null);
	let replyText = $state('');
</script>

<svelte:head>
	<title>{data.artist.displayName} — Artist Dashboard | Quire</title>
</svelte:head>

<div style="background-color: var(--ink); min-block-size: 100vh; --accent: {data.artist.accentColor || '#05D9E8'};">
	<div data-center style="padding-block: 2rem;" data-stack="xl">
		<!-- Navigation Bar -->
		<header class="cover-header">
			<div data-cluster>
				<span class="glass-pill text-highlight" style="font-weight: 800;">QUIRE</span>
				<h1 style="font-size: 1.25rem; font-weight: 700; color: #FFFFFF;">
					{data.artist.displayName}
				</h1>
			</div>

			<div data-cluster>
				<a href="/dashboard/issues/quick" class="floating-tip-btn" style="position: static; padding: 0.5rem 1rem; font-size: 0.85rem; box-shadow: none;">
					+ Quick Issue (Phone)
				</a>
				<a href="/dashboard/template" class="glass-pill" style="text-decoration: none;">
					Master Template
				</a>
				<a href="/dashboard/settings" class="glass-pill" style="text-decoration: none;">
					Settings & Payouts
				</a>
				<a href="/a/{data.artist.slug}" class="glass-pill text-highlight" style="text-decoration: none;">
					View Back Page ↗
				</a>
			</div>
		</header>

		<!-- Stripe Callout if Payouts Not Enabled -->
		{#if !data.artist.payoutsEnabled}
			<div class="glass-panel" style="padding: 1.25rem; border-color: var(--support); background: rgba(255, 42, 109, 0.05);" data-cluster="between">
				<div data-stack="xs">
					<span class="text-support" style="font-weight: 700; font-size: 0.95rem;">
						● Stripe Connect Onboarding Pending
					</span>
					<p class="text-muted" style="font-size: 0.85rem;">
						Tip buttons remain hidden on your live zines until payouts are connected (in demo mode, test tipping is simulated).
					</p>
				</div>
				<a href="/dashboard/settings" class="glass-pill tag-support" style="text-decoration: none; padding: 0.5rem 1rem;">
					Connect Stripe →
				</a>
			</div>
		{/if}

		<!-- MORNING-AFTER GIG RECAP CARD -->
		{#if data.latestRecap}
			<section class="glass-panel" style="padding: 2rem;" data-stack="md">
				<div data-cluster="between">
					<div data-cluster>
						<span class="glass-pill tag-highlight">Morning-After Gig Recap</span>
						<span class="text-muted" style="font-size: 0.85rem;">{data.latestRecap.issue.date}</span>
					</div>
					<a href="/i/{data.latestRecap.issue.slug}" class="glass-pill text-highlight" style="text-decoration: none; font-size: 0.8rem;">
						Open Zine ↗
					</a>
				</div>

				<div data-stack="xs">
					<h2 style="font-size: 2rem; font-weight: 800; color: #FFFFFF;">
						{data.latestRecap.issue.city} @ {data.latestRecap.issue.venue}
					</h2>
					<p class="text-muted" style="font-size: 0.95rem;">
						Only money and people. No vanity metrics.
					</p>
				</div>

				<!-- Metric Tiles -->
				<div data-grid style="--grid-min: 160px; margin-block-start: 1rem;">
					<div class="glass-panel" style="padding: 1.25rem;" data-stack="xs">
						<span class="text-muted" style="font-size: 0.75rem; text-transform: uppercase;">Gross Tips</span>
						<span style="font-size: 1.8rem; font-weight: 800; color: #FFFFFF;">
							${(data.latestRecap.grossTipsCents / 100).toFixed(2)}
						</span>
						<span class="text-muted" style="font-size: 0.75rem;">From {data.latestRecap.tipperCount} supporters</span>
					</div>

					<div class="glass-panel" style="padding: 1.25rem;" data-stack="xs">
						<span class="text-muted" style="font-size: 0.75rem; text-transform: uppercase;">Net to Band</span>
						<span style="font-size: 1.8rem; font-weight: 800; color: var(--highlight);">
							${(data.latestRecap.netTipsCents / 100).toFixed(2)}
						</span>
						<span class="text-muted" style="font-size: 0.75rem;">After processing & fees</span>
					</div>

					<div class="glass-panel" style="padding: 1.25rem;" data-stack="xs">
						<span class="text-muted" style="font-size: 0.75rem; text-transform: uppercase;">Attended Stamps</span>
						<span style="font-size: 1.8rem; font-weight: 800; color: #FFFFFF;">
							{data.latestRecap.stampsCount}
						</span>
						<span class="text-muted" style="font-size: 0.75rem;">Physical venue QR scans</span>
					</div>

					<div class="glass-panel" style="padding: 1.25rem;" data-stack="xs">
						<span class="text-muted" style="font-size: 0.75rem; text-transform: uppercase;">Bookmarked</span>
						<span style="font-size: 1.8rem; font-weight: 800; color: #FFFFFF;">
							{data.latestRecap.savesCount}
						</span>
						<span class="text-muted" style="font-size: 0.75rem;">Saved to Fan collections</span>
					</div>
				</div>
			</section>
		{/if}

		<!-- ALL GIGS TABLE -->
		<section data-stack="md">
			<div data-cluster="between">
				<h2 style="font-size: 1.4rem; font-weight: 700; color: #FFFFFF;">All Gigs & Issues</h2>
				<a href="/dashboard/issues/quick" class="glass-pill text-highlight" style="text-decoration: none;">+ Publish Show</a>
			</div>

			<div class="glass-panel" style="overflow-x: auto;">
				<table style="inline-size: 100%; border-collapse: collapse; text-align: start; font-size: 0.9rem;">
					<thead>
						<tr style="border-block-end: 1px solid var(--glass-border); color: var(--ink-muted); text-transform: uppercase; font-size: 0.75rem;">
							<th style="padding: 1rem;">Date</th>
							<th style="padding: 1rem;">City & Venue</th>
							<th style="padding: 1rem;">Status</th>
							<th style="padding: 1rem;">Tips Gross</th>
							<th style="padding: 1rem;">Stamps</th>
							<th style="padding: 1rem; text-align: end;">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.issues as issue}
							<tr style="border-block-end: 1px solid rgba(255,255,255,0.05);">
								<td style="padding: 1rem; font-family: var(--font-mono);">{issue.date}</td>
								<td style="padding: 1rem;">
									<div style="font-weight: 700; color: #FFFFFF;">{issue.city}</div>
									<div class="text-muted" style="font-size: 0.8rem;">{issue.venue}</div>
								</td>
								<td style="padding: 1rem;">
									<span class="glass-pill {issue.status === 'published' ? 'tag-highlight' : ''}" style="font-size: 0.7rem;">
										{issue.status}
									</span>
								</td>
								<td style="padding: 1rem; font-weight: 600;">
									${(((issue.tips as Array<{ amountGross: number }> | undefined)?.reduce((s: number, t: { amountGross: number }) => s + t.amountGross, 0) || 0) / 100).toFixed(2)}
								</td>
								<td style="padding: 1rem;">
									{(issue.collections as Array<{ kind: string }> | undefined)?.filter((c: { kind: string }) => c.kind === 'stamped').length || 0}
								</td>
								<td style="padding: 1rem; text-align: end;">
									<div data-cluster="center" style="justify-content: flex-end;">
										<a href="/dashboard/bookbinder/{issue.id}" class="glass-pill" style="text-decoration: none; font-size: 0.75rem;">
											Edit Zine
										</a>
										<a href="/i/{issue.slug}" class="glass-pill text-highlight" style="text-decoration: none; font-size: 0.75rem;">
											View ↗
										</a>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<!-- MODERATION & GUESTBOOK QUEUE -->
		<section class="glass-panel" style="padding: 2rem;" data-stack="md">
			<div data-cluster="between">
				<div>
					<h2 style="font-size: 1.4rem; font-weight: 700; color: #FFFFFF;">Wall Guestbook & Replies</h2>
					<p class="text-muted" style="font-size: 0.85rem;">Reply to fans or moderate flagged posts.</p>
				</div>
				<span class="glass-pill">{data.pendingNotes.length} notes</span>
			</div>

			<div data-stack="sm">
				{#each data.pendingNotes as note}
					<div class="note-card">
						<div data-cluster="between">
							<div data-cluster>
								<div class="note-avatar" style="display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: var(--highlight);">
									{note.author?.name ? note.author.name[0] : 'F'}
								</div>
								<span style="font-weight: 600;">{note.author?.name || 'Fan'}</span>
								{#if note.issue}
									<span class="glass-pill" style="font-size: 0.7rem;">{note.issue.city}</span>
								{:else}
									<span class="glass-pill" style="font-size: 0.7rem;">General Wall</span>
								{/if}
								{#if note.status === 'hidden'}
									<span class="tag-support glass-pill" style="font-size: 0.7rem;">Hidden (Flagged)</span>
								{/if}
							</div>

							<div data-cluster>
								{#if note.status === 'hidden'}
									<form method="POST" action="?/restoreNote" use:enhance>
										<input type="hidden" name="noteId" value={note.id} />
										<button type="submit" class="glass-pill tag-highlight" style="cursor: pointer; font-size: 0.75rem;">
											Restore Note
										</button>
									</form>
								{/if}

								<form method="POST" action="?/deleteNote" use:enhance>
									<input type="hidden" name="noteId" value={note.id} />
									<button type="submit" class="glass-pill text-muted" style="cursor: pointer; font-size: 0.75rem;">
										Delete
									</button>
								</form>
							</div>
						</div>

						<p style="font-size: 0.95rem; line-height: 1.5; color: var(--paper);">
							"{note.body}"
						</p>

						<!-- Existing Reply -->
						{#if note.replies && note.replies.length > 0}
							<div class="artist-reply">
								<span class="text-highlight" style="font-weight: 700; font-size: 0.75rem;">Your Reply:</span>
								<p style="color: #FFFFFF; font-size: 0.85rem;">{note.replies[0].body}</p>
							</div>
						{:else}
							<!-- Reply Action Form -->
							{#if replyingToNoteId === note.id}
								<form method="POST" action="?/reply" use:enhance data-stack="xs" style="margin-block-start: 0.5rem;">
									<input type="hidden" name="noteId" value={note.id} />
									<input
										type="text"
										name="body"
										bind:value={replyText}
										placeholder="Type your single-tier artist reply..."
										required
										maxlength="300"
										style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.85rem;"
									/>
									<div data-cluster="between">
										<button type="button" class="glass-pill" onclick={() => (replyingToNoteId = null)}>
											Cancel
										</button>
										<button type="submit" class="glass-pill tag-highlight" style="cursor: pointer;">
											Post Reply
										</button>
									</div>
								</form>
							{:else}
								<div>
									<button
										type="button"
										class="glass-pill text-highlight"
										style="background: none; border: none; cursor: pointer; font-size: 0.8rem; padding: 0;"
										onclick={() => { replyingToNoteId = note.id; replyText = ''; }}
									>
										+ Reply as Artist
									</button>
								</div>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		</section>
	</div>
</div>
