<script lang="ts">
	import { enhance } from '$app/forms';
	import { Container, Box, Stack, Cluster, Grid } from '$lib/components/layout';
	import ArtistTopNav from '$lib/components/dashboard/ArtistTopNav.svelte';
	import QrCaseDisplay from '$lib/components/dashboard/QrCaseDisplay.svelte';
	import { formatUsdCents, isTipReversed, TipStatus } from '$domain/tipping';

	let { data } = $props();

	let replyingToNoteId = $state<string | null>(null);
	let replyText = $state('');
	let showArtistQrModal = $state(false);
	let showCaseDisplay = $state(false);
	let tipFilter = $state<'all' | 'issues' | 'general' | 'reversals'>('all');

	const filteredTipLedger = $derived(
		(data.tipLedger ?? []).filter((tip) => {
			if (tipFilter === 'issues') return tip.issueId !== null;
			if (tipFilter === 'general') return tip.issueId === null;
			if (tipFilter === 'reversals') return isTipReversed(tip.status);
			return true;
		})
	);

	function formatTipTimestamp(value: Date | string): string {
		const dateObj = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(dateObj.getTime())) return '';
		return dateObj.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{data.artist.displayName} — Artist Dashboard | Quire</title>
</svelte:head>

<div class="dashboard-root" style="--accent: {data.artist.accentColor || '#05D9E8'};">
	<ArtistTopNav artist={data.artist} activeTab="overview" />

	<Container as="main" width="lg" padding="md" class="dashboard-canvas">
		<Stack gap="xl">
			<!-- Artist Studio Header Strip -->
			<Cluster justify="between" align="center" gap="md">
				<Stack gap="3xs">
					<Cluster align="center" gap="xs">
						<span class="text-highlight font-mono eyebrow-small">ARTIST STUDIO</span>
						{#if data.artist.verified}
							<span class="meta-chip meta-highlight">✓ Verified Artist</span>
						{/if}
					</Cluster>
					<h1 class="studio-heading">{data.artist.displayName}</h1>
				</Stack>

				<Cluster align="center" gap="xs">
					<button
						type="button"
						class="btn-action-accent"
						onclick={() => (showArtistQrModal = !showArtistQrModal)}
					>
						Artist Back Page QR
					</button>
					<form method="POST" action="?/createDraft" use:enhance>
						<button type="submit" class="btn-action-ghost">
							New Draft in Bookbinder
						</button>
					</form>
					<a href="/dashboard/issues/quick" class="btn-action-primary">
						+ Publish Quick Issue →
					</a>
				</Cluster>
			</Cluster>

			<!-- Permanent Artist QR Card (SPEC.md §4) -->
			{#if showArtistQrModal && data.artistQrSvg}
				<Box as="section" variant="raised" padding="xl" radius="lg" class="qr-showcase-box">
					<Cluster justify="between" align="center" gap="lg">
						<Stack gap="sm">
							<span class="text-highlight font-mono eyebrow-small">PERMANENT ARTIST QR</span>
							<h2 class="section-heading">Back Page Sticker & Case Display</h2>
							<p class="text-muted subtext-small">
								This permanent QR opens <strong>/a/{data.artist.slug}</strong> (your Back Page with 1-tap General tipping, links, every Issue, and your General Wall). Prop it up next to your guitar case or print it on merch stickers.
							</p>
							<Cluster gap="xs">
								<button
									type="button"
									class="btn-action-primary"
									onclick={() => (showCaseDisplay = true)}
								>
									Full-Screen Case Display
								</button>
								<a
									href="data:image/svg+xml;utf8,{encodeURIComponent(data.artistQrSvg)}"
									download="quire-artist-{data.artist.slug}.svg"
									class="btn-action-support"
								>
									Download Artist QR SVG
								</a>
								<button
									type="button"
									class="btn-action-ghost"
									onclick={() => (showArtistQrModal = false)}
								>
									Hide QR
								</button>
							</Cluster>
						</Stack>

						<div class="sticker-badge">
							<div class="sticker-caption">SCAN FOR ZINES & TIPS</div>
							<div class="sticker-qr-svg">
								{@html data.artistQrSvg}
							</div>
							<div class="sticker-caption">{data.artist.displayName}</div>
						</div>
					</Cluster>
				</Box>
			{/if}

			{#if data.issues.length === 0}
				<!-- FIRST-TIME 3-STEP STUDIO LAUNCHPAD (Stage 3) -->
				<Box as="section" variant="raised" padding="xl" radius="lg" class="launchpad-box">
					<Stack gap="lg">
						<Stack gap="2xs">
							<span class="text-highlight font-mono eyebrow-small">
								{data.onboarding ? 'WELCOME TO QUIRE · STUDIO LAUNCHPAD' : 'FIRST-TIME STUDIO LAUNCHPAD'}
							</span>
							<h2 class="launchpad-heading">Launch Your Band Zine in 3 Steps</h2>
							<p class="text-muted subtext-small">
								Set your Master Template once, publish a gig zine in under a minute, and turn on Stripe Express payouts whenever you are ready.
							</p>
						</Stack>

						<Grid min="sm" gap="md">
							<Box as="article" variant="subtle" padding="lg" radius="md" class="launchpad-step-card">
								<Stack gap="md" class="launchpad-step-stack">
									<Cluster justify="between" align="center" gap="xs">
										<span class="font-mono text-muted step-number">STEP 01 · ~2 MIN</span>
										<span class="meta-chip {data.hasCustomizedTemplate ? 'meta-highlight' : 'meta-accent'}">
											{data.hasCustomizedTemplate ? '[COMPLETED]' : '[NEXT]'}
										</span>
									</Cluster>
									<Stack gap="2xs">
										<h3 class="step-title">Customize Master Template</h3>
										<p class="text-muted step-desc">
											Upload cover art, pick a contrast-checked accent color, choose type pairing, tip presets, Back Page links, and recurring pages.
										</p>
									</Stack>
									<Cluster gap="xs" class="step-actions">
										<a href="/dashboard/template" class="btn-action-accent">
											{data.hasCustomizedTemplate ? 'Edit Master Template →' : 'Customize Master Template →'}
										</a>
									</Cluster>
								</Stack>
							</Box>

							<Box as="article" variant="subtle" padding="lg" radius="md" class="launchpad-step-card">
								<Stack gap="md" class="launchpad-step-stack">
									<Cluster justify="between" align="center" gap="xs">
										<span class="font-mono text-muted step-number">STEP 02 · &lt;60 SEC</span>
										<span class="meta-chip {data.hasCustomizedTemplate ? 'meta-accent' : ''}">
											{data.hasCustomizedTemplate ? '[NEXT]' : '[OPTIONAL]'}
										</span>
									</Cluster>
									<Stack gap="2xs">
										<h3 class="step-title">Publish Your First Issue</h3>
										<p class="text-muted step-desc">
											Use Quick Issue on your phone right before soundcheck, or start a draft in the desktop split-screen Bookbinder.
										</p>
									</Stack>
									<Cluster gap="xs" class="step-actions">
										<a href="/dashboard/issues/quick" class="btn-action-primary">
											Quick Issue →
										</a>
										<form method="POST" action="?/createDraft" use:enhance>
											<button type="submit" class="btn-action-ghost">
												New Draft in Bookbinder
											</button>
										</form>
									</Cluster>
								</Stack>
							</Box>

							<Box as="article" variant="subtle" padding="lg" radius="md" class="launchpad-step-card">
								<Stack gap="md" class="launchpad-step-stack">
									<Cluster justify="between" align="center" gap="xs">
										<span class="font-mono text-muted step-number">STEP 03 · ON-DEMAND</span>
										<span class="meta-chip {data.artist.payoutsEnabled ? 'meta-highlight' : 'meta-support'}">
											{data.artist.payoutsEnabled ? 'Payouts Active' : 'Connect When Ready'}
										</span>
									</Cluster>
									<Stack gap="2xs">
										<h3 class="step-title">Connect Stripe Express</h3>
										<p class="text-muted step-desc">
											Tip buttons stay hidden until payouts are enabled. Connect Stripe Express whenever you are ready to accept 1-tap tips.
										</p>
									</Stack>
									<Cluster gap="xs" class="step-actions">
										<a href="/dashboard/settings" class="btn-action-support">
											{data.artist.payoutsEnabled ? 'Manage Payouts →' : 'Connect When Ready →'}
										</a>
									</Cluster>
								</Stack>
							</Box>
						</Grid>

						<Box as="article" variant="muted" padding="lg" radius="md" class="busker-fasttrack-box">
							<Cluster justify="between" align="center" gap="md">
								<Stack gap="2xs">
									<span class="text-highlight font-mono eyebrow-small">
										BUSKER FAST-TRACK · PERMANENT BACK PAGE QR
									</span>
									<h3 class="step-title">Playing Tonight Without Creating an Issue?</h3>
									<p class="text-muted step-desc">
										Your Permanent Artist Back Page (<strong>/a/{data.artist.slug}</strong>) is already live. Open your Artist QR sticker or launch Full-Screen Case Display to prop your phone beside your guitar case or merch table.
									</p>
								</Stack>
								<Cluster gap="xs">
									<button
										type="button"
										class="btn-action-primary"
										onclick={() => (showCaseDisplay = true)}
									>
										Full-Screen Case Display
									</button>
									<button
										type="button"
										class="btn-action-accent"
										onclick={() => (showArtistQrModal = !showArtistQrModal)}
									>
										{showArtistQrModal ? 'Hide Artist QR' : 'Open Artist QR'}
									</button>
									{#if data.artistQrSvg}
										<a
											href="data:image/svg+xml;utf8,{encodeURIComponent(data.artistQrSvg)}"
											download="quire-artist-{data.artist.slug}.svg"
											class="btn-action-ghost"
										>
											Download QR SVG
										</a>
									{/if}
								</Cluster>
							</Cluster>
						</Box>
					</Stack>
				</Box>
			{:else}
				<!-- Stripe Callout if Payouts Not Enabled -->
				{#if !data.artist.payoutsEnabled}
					<Box as="section" variant="raised" padding="md" radius="lg" class="stripe-warning-box">
						<Cluster justify="between" align="center" gap="md">
							<Stack gap="xs">
								<span class="text-support stripe-callout-title">
									● Stripe Connect Onboarding Pending
								</span>
								<p class="text-muted stripe-callout-text">
									Tip buttons remain hidden on your Cover, Issue pages, and Back Page until payouts are enabled.
								</p>
							</Stack>
							<a href="/dashboard/settings" class="btn-action-support">
								Enable Payouts →
							</a>
						</Cluster>
					</Box>
				{/if}

				<!-- MORNING-AFTER GIG RECAP CARD (SPEC.md §6.5) -->
				{#if data.latestRecap}
					<Box as="section" variant="raised" padding="xl" radius="lg" class="recap-card-box">
						<Stack gap="lg">
							<Cluster justify="between" align="center" gap="md">
								<Stack gap="2xs">
									<Cluster align="center" gap="xs">
										<span class="meta-chip meta-accent">Morning-After Gig Recap</span>
										<span class="text-muted font-mono recap-date">{data.latestRecap.issue.date}</span>
									</Cluster>
									<h2 class="recap-title">
										{data.latestRecap.issue.city} @ {data.latestRecap.issue.venue}
									</h2>
								</Stack>

								<Cluster gap="xs">
									<a
										href="/dashboard/bookbinder/{data.latestRecap.issue.id}"
										class="btn-action-ghost"
									>
										Edit in Bookbinder
									</a>
									<a
										href="/i/{data.latestRecap.issue.slug}"
										class="btn-action-primary"
									>
										Open Zine ↗
									</a>
								</Cluster>
							</Cluster>

							<Grid min="xs" gap="md">
								<Box variant="subtle" padding="md" radius="md">
									<Stack gap="2xs">
										<span class="text-muted metric-label">Gross Tips</span>
										<span class="text-support metric-value">
											{formatUsdCents(data.latestRecap.totalGrossCents)}
										</span>
										<span class="text-muted metric-sub">
											{data.latestRecap.tipCount} tippers · {formatUsdCents(data.latestRecap.totalFeesCents)} fees
										</span>
									</Stack>
								</Box>

								<Box variant="subtle" padding="md" radius="md">
									<Stack gap="2xs">
										<span class="text-muted metric-label">Net Artist Payout</span>
										<span class="metric-value metric-white">
											{formatUsdCents(data.latestRecap.totalNetCents)}
										</span>
										{#if data.latestRecap.reversalsCents > 0}
											<span class="text-support metric-sub">
												Refunds & chargebacks: -{formatUsdCents(data.latestRecap.reversalsCents)} ({data.latestRecap.refundCount + data.latestRecap.disputeCount})
											</span>
										{:else}
											<span class="text-muted metric-sub">After Stripe & 5% platform cut</span>
										{/if}
									</Stack>
								</Box>

								<Box variant="subtle" padding="md" radius="md">
									<Stack gap="2xs">
										<span class="text-muted metric-label">Attended Stamps</span>
										<span class="text-highlight metric-value">
											{data.latestRecap.stampedCount}
										</span>
										<span class="text-muted metric-sub">Verified physical QR scans</span>
									</Stack>
								</Box>

								<Box variant="subtle" padding="md" radius="md">
									<Stack gap="2xs">
										<span class="text-muted metric-label">Saves & Wall Notes</span>
										<span class="text-accent metric-value">
											{data.latestRecap.savedCount} / {data.latestRecap.noteCount}
										</span>
										<span class="text-muted metric-sub">
											{data.latestRecap.savedCount} saved · {data.latestRecap.noteCount} notes
										</span>
									</Stack>
								</Box>
							</Grid>
						</Stack>
					</Box>
				{/if}

				<!-- ALL GIGS & GENERAL TABLE (SPEC.md §6.5) -->
				<Stack as="section" gap="md">
					<Cluster justify="between" align="center">
						<Stack gap="3xs">
							<h2 class="section-heading">All Gigs & Issues</h2>
							<p class="text-muted subtext-small">
								Money and people across every stop, plus General Back Page activity. Issues are archived, never deleted.
							</p>
						</Stack>
						<Cluster gap="xs">
							<form method="POST" action="?/createDraft" use:enhance>
								<button type="submit" class="btn-action-ghost">
									New Draft in Bookbinder
								</button>
							</form>
							<a href="/dashboard/issues/quick" class="btn-action-primary">
								+ Publish Show
							</a>
						</Cluster>
					</Cluster>

					<Box variant="raised" padding="none" class="table-container-shell">
						<table class="gigs-table">
							<thead>
								<tr class="table-header-row">
									<th class="table-cell">Date</th>
									<th class="table-cell">City & Venue</th>
									<th class="table-cell">Status</th>
									<th class="table-cell">Gross / Fees / Net</th>
									<th class="table-cell">Stamps</th>
									<th class="table-cell">Notes</th>
									<th class="table-cell align-end">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each data.issues as issue}
									{@const summary = issue.tipSummary}
									{@const stamps = ((issue.collections as Array<{ kind: string }> | undefined) || []).filter((c) => c.kind === 'stamped').length}
									{@const noteCount = ((issue.notes as Array<unknown> | undefined) || []).length}
									<tr class="table-body-row">
										<td class="table-cell font-mono">{issue.date}</td>
										<td class="table-cell">
											<div class="cell-primary-text">{issue.city}</div>
											<div class="text-muted cell-subtext">{issue.venue}</div>
										</td>
										<td class="table-cell">
											<span class="status-badge status-{issue.status}">
												{issue.status}
											</span>
										</td>
										<td class="table-cell font-mono">
											<div class="cell-primary-text">{formatUsdCents(summary.grossCents)} gross</div>
											<div class="text-muted cell-subtext">
												-{formatUsdCents(summary.feesCents)} fees
												{#if summary.reversalsCents > 0}
													· <span class="text-support">-{formatUsdCents(summary.reversalsCents)} reversals</span>
												{/if}
												→ <strong class="text-highlight">{formatUsdCents(summary.netCents)} net</strong>
											</div>
										</td>
										<td class="table-cell font-semibold">{stamps}</td>
										<td class="table-cell">{noteCount}</td>
										<td class="table-cell align-end">
											<Cluster justify="end" gap="xs">
												<a
													href="/dashboard/bookbinder/{issue.id}"
													class="btn-table-action"
												>
													Edit Zine
												</a>
												<a
													href="/i/{issue.slug}"
													class="btn-table-action-highlight"
												>
													View ↗
												</a>
											</Cluster>
										</td>
									</tr>
								{/each}

								<!-- General Row for Back Page Activity (SPEC.md §6.5) -->
								{#if data.generalRow}
									<tr class="table-body-row general-row">
										<td class="table-cell font-mono text-accent">PERMANENT</td>
										<td class="table-cell">
											<div class="cell-primary-text">General (Back Page)</div>
											<div class="text-muted cell-subtext">Tips & notes not tied to a single gig</div>
										</td>
										<td class="table-cell">
											<span class="meta-chip meta-accent">Always Live</span>
										</td>
										<td class="table-cell font-mono">
											<div class="cell-primary-text">{formatUsdCents(data.generalRow.grossCents)} gross</div>
											<div class="text-muted cell-subtext">
												-{formatUsdCents(data.generalRow.feesCents)} fees
												{#if data.generalRow.reversalsCents > 0}
													· <span class="text-support">-{formatUsdCents(data.generalRow.reversalsCents)} reversals</span>
												{/if}
												→ <strong class="text-highlight">{formatUsdCents(data.generalRow.netCents)} net</strong>
											</div>
										</td>
										<td class="table-cell text-muted">—</td>
										<td class="table-cell">{data.generalRow.noteCount}</td>
										<td class="table-cell align-end">
											<Cluster justify="end" gap="xs">
												<a href="/dashboard/template" class="btn-table-action">
													Edit Links
												</a>
												<a href="/a/{data.artist.slug}" class="btn-table-action-highlight">
													Back Page ↗
												</a>
											</Cluster>
										</td>
									</tr>
								{/if}
							</tbody>
						</table>
					</Box>
				</Stack>
			{/if}

			<!-- PER-TIP BREAKDOWN LEDGER (SPEC.md §5.4 & §6.5) -->
			{#if data.tipLedger && data.tipLedger.length > 0}
				<Stack as="section" gap="md">
					<Cluster justify="between" align="center" gap="md">
						<Stack gap="3xs">
							<h2 class="section-heading">Tip Breakdown Ledger</h2>
							<p class="text-muted subtext-small">
								Individual gross amount, Stripe &amp; 5% platform fees, absorbed refunds or chargebacks, and net artist payout.
							</p>
						</Stack>

						<Cluster gap="xs" role="tablist" aria-label="Filter tips">
							<button
								type="button"
								class="btn-filter-tab {tipFilter === 'all' ? 'is-active' : ''}"
								onclick={() => (tipFilter = 'all')}
							>
								All ({data.tipLedger.length})
							</button>
							<button
								type="button"
								class="btn-filter-tab {tipFilter === 'issues' ? 'is-active' : ''}"
								onclick={() => (tipFilter = 'issues')}
							>
								Issues
							</button>
							<button
								type="button"
								class="btn-filter-tab {tipFilter === 'general' ? 'is-active' : ''}"
								onclick={() => (tipFilter = 'general')}
							>
								General
							</button>
							<button
								type="button"
								class="btn-filter-tab {tipFilter === 'reversals' ? 'is-active' : ''}"
								onclick={() => (tipFilter = 'reversals')}
							>
								Refunds &amp; Disputes
							</button>
						</Cluster>
					</Cluster>

					<Box variant="raised" padding="none" class="table-container-shell">
						<table class="gigs-table">
							<thead>
								<tr class="table-header-row">
									<th class="table-cell">Date</th>
									<th class="table-cell">Source</th>
									<th class="table-cell">Status</th>
									<th class="table-cell">Gross</th>
									<th class="table-cell">Fees &amp; Reversals</th>
									<th class="table-cell align-end">Net Payout</th>
								</tr>
							</thead>
							<tbody>
								{#if filteredTipLedger.length === 0}
									<tr class="table-body-row">
										<td class="table-cell text-muted" colspan="6">
											No tips match this filter yet.
										</td>
									</tr>
								{:else}
									{#each filteredTipLedger as tip (tip.id)}
										<tr class="table-body-row">
											<td class="table-cell font-mono">{formatTipTimestamp(tip.createdAt)}</td>
											<td class="table-cell">
												<div class="cell-primary-text">{tip.sourceLabel}</div>
												{#if tip.fanCoveredFees}
													<span class="meta-chip meta-highlight">Fan covered Stripe fee</span>
												{/if}
											</td>
											<td class="table-cell">
												<span
													class="status-badge {tip.status === TipStatus.Succeeded
														? ''
														: 'status-cancelled'}"
												>
													{tip.status}
												</span>
											</td>
											<td class="table-cell font-mono cell-primary-text">
												{formatUsdCents(tip.amountGross)}
											</td>
											<td class="table-cell font-mono">
												<div class="text-muted cell-subtext">
													Stripe {formatUsdCents(tip.feeStripe)} · Quire 5% {formatUsdCents(tip.feePlatform)}
												</div>
												{#if tip.reversalCents > 0}
													<div class="text-support cell-subtext">
														{tip.status === TipStatus.Disputed ? 'Chargeback' : 'Refund'} absorbed: -{formatUsdCents(tip.reversalCents)}
													</div>
												{/if}
											</td>
											<td class="table-cell align-end font-mono">
												<strong class={tip.amountNet < 0 ? 'text-support' : 'text-highlight'}>
													{formatUsdCents(tip.amountNet)}
												</strong>
											</td>
										</tr>
									{/each}
								{/if}
							</tbody>
						</table>
					</Box>
				</Stack>
			{/if}

			<!-- MODERATION & GUESTBOOK QUEUE -->
			{#if data.issues.length > 0 || data.pendingNotes.length > 0}
			<Box as="section" variant="raised" padding="lg" radius="lg" class="moderation-box">
				<Stack gap="md">
					<Cluster justify="between" align="center">
						<Stack gap="3xs">
							<h2 class="section-heading">Wall Guestbook & Moderation</h2>
							<p class="text-muted subtext-small">
								Reply to fans (one level deep), restore flagged notes (making them flag-immune), hide notes, or block spammers across all Walls.
							</p>
						</Stack>
						<span class="meta-chip">{data.pendingNotes.length} notes</span>
					</Cluster>

					<Stack gap="sm">
						{#each data.pendingNotes as note}
							<Box as="article" variant="subtle" padding="md" radius="md" class="note-card-box">
								<Stack gap="sm" align="start">
									<Cluster justify="between" align="center" gap="sm" class="w-full">
										<Cluster align="center" gap="xs">
											<div class="note-avatar">
												{note.author?.name ? note.author.name[0] : 'F'}
											</div>
											<span class="note-author-name">{note.author?.name || 'Fan'}</span>
											<span class="meta-chip">
												{note.issue ? `${note.issue.city} (${note.issue.venue})` : 'General Wall'}
											</span>
											{#if note.status !== 'live'}
												<span class="meta-chip meta-support">{note.status.toUpperCase()}</span>
											{/if}
											{#if note.flagCount > 0}
												<span class="meta-chip meta-support">{note.flagCount} flags</span>
											{/if}
											{#if note.flagImmune}
												<span class="meta-chip meta-highlight">✓ Flag-Immune</span>
											{/if}
										</Cluster>

										<Cluster gap="xs">
											{#if note.status === 'hidden' || note.status === 'pending'}
												<form method="POST" action="?/restore" use:enhance>
													<input type="hidden" name="noteId" value={note.id} />
													<button type="submit" class="btn-mod-approve">
														✓ Approve / Restore
													</button>
												</form>
											{/if}

											<form method="POST" action="?/delete" use:enhance>
												<input type="hidden" name="noteId" value={note.id} />
												<button type="submit" class="btn-mod-delete">
													✕ Delete Note
												</button>
											</form>

											<form method="POST" action="?/blockFan" use:enhance>
												<input type="hidden" name="fanUserId" value={note.fanUserId} />
												<button type="submit" class="btn-mod-block">
													Block Fan
												</button>
											</form>
										</Cluster>
									</Cluster>

									<p class="note-body-text">{note.body}</p>

									{#if note.replies && note.replies.length > 0}
										<Stack gap="3xs" class="artist-reply w-full">
											<span class="text-accent reply-label">Your Reply:</span>
											<p class="reply-text">{note.replies[0].body}</p>
										</Stack>
									{:else if replyingToNoteId === note.id}
										<form
											data-stack="gap:xs"
											method="POST"
											action="?/reply"
											use:enhance={() => {
												return async ({ update }) => {
													replyingToNoteId = null;
													replyText = '';
													await update();
												};
											}}
											class="reply-form w-full"
										>
											<input type="hidden" name="noteId" value={note.id} />
											<input
												type="text"
												name="body"
												bind:value={replyText}
												placeholder="Write your official artist reply..."
												required
												class="reply-input"
											/>
											<Cluster justify="end" gap="xs">
												<button
													type="button"
													class="btn-table-action"
													onclick={() => (replyingToNoteId = null)}
												>
													Cancel
												</button>
												<button type="submit" class="btn-table-action-highlight">
													Post Reply →
												</button>
											</Cluster>
										</form>
									{:else}
										<button
											type="button"
											class="btn-reply-trigger"
											onclick={() => {
												replyingToNoteId = note.id;
												replyText = '';
											}}
										>
											Reply as {data.artist.displayName} →
										</button>
									{/if}
								</Stack>
							</Box>
						{/each}
					</Stack>
				</Stack>
			</Box>
			{/if}
		</Stack>
	</Container>

	{#if data.artistQrSvg}
		<QrCaseDisplay
			open={showCaseDisplay}
			onClose={() => (showCaseDisplay = false)}
			qrSvg={data.artistQrSvg}
			title={data.artist.displayName}
			subtitle="Permanent Artist Back Page — Tips, Links & All Issues"
			urlLabel={data.artistBackPageUrl}
			accentColor={data.artist.accentColor || '#05D9E8'}
		/>
	{/if}
</div>

<style>
	.dashboard-root {
		background-color: var(--bg-void);
		min-block-size: 100vh;
	}

	:global(.dashboard-canvas) {
		padding-block: var(--space-xl);
	}

	.eyebrow-small {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.studio-heading {
		font-size: clamp(1.85rem, 3.5vw, 2.5rem);
		font-weight: 800;
		color: #ffffff;
		letter-spacing: -0.02em;
	}

	:global(.qr-showcase-box) {
		border-color: var(--accent);
	}

	:global(.launchpad-box) {
		border-color: rgba(5, 217, 232, 0.35);
	}

	.launchpad-heading {
		font-size: clamp(1.45rem, 2.8vw, 1.95rem);
		font-weight: 800;
		color: #ffffff;
		letter-spacing: -0.02em;
	}

	:global(.launchpad-step-card) {
		border-color: rgba(255, 255, 255, 0.12);
	}

	:global(.launchpad-step-stack) {
		block-size: 100%;
	}

	.step-number {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.step-title {
		font-size: 1.1rem;
		font-weight: 800;
		color: #ffffff;
	}

	.step-desc {
		font-size: 0.85rem;
		line-height: 1.5;
	}

	:global(.step-actions) {
		margin-block-start: auto;
	}

	:global(.busker-fasttrack-box) {
		border-color: rgba(1, 255, 195, 0.3);
	}

	:global(.stripe-warning-box) {
		border-color: var(--support);
	}

	.stripe-callout-title {
		font-weight: 700;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.stripe-callout-text {
		font-size: 0.85rem;
	}

	:global(.recap-card-box),
	:global(.moderation-box) {
		border-color: var(--glass-border);
	}

	.recap-date {
		font-size: 0.8rem;
	}

	.recap-title {
		font-size: 1.65rem;
		font-weight: 800;
		color: #ffffff;
	}

	.metric-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.metric-value {
		font-size: 2rem;
		font-weight: 800;
	}

	.metric-white {
		color: #ffffff;
	}

	.metric-sub {
		font-size: 0.78rem;
	}

	.section-heading {
		font-size: 1.35rem;
		font-weight: 800;
		color: #ffffff;
	}

	:global(.table-container-shell) {
		overflow-x: auto;
		border-color: var(--glass-border);
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
		font-size: 0.74rem;
		letter-spacing: 0.04em;
	}

	.table-body-row {
		border-block-end: 1px solid rgba(255, 255, 255, 0.06);
	}

	.general-row {
		background: rgba(5, 217, 232, 0.04);
	}

	.table-cell {
		padding: 1rem;
		vertical-align: middle;
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
		font-size: 0.78rem;
	}

	.subtext-small {
		font-size: 0.85rem;
	}

	:global(.note-card-box) {
		border-color: rgba(255, 255, 255, 0.1);
	}

	.note-author-name {
		font-weight: 700;
		color: #ffffff;
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

	:global(.reply-form) {
		margin-block-start: 0.5rem;
	}

	.reply-input {
		inline-size: 100%;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		padding-block: 0.6rem;
		padding-inline: 0.85rem;
		font-size: 0.88rem;
	}

	/* Sleek Rectangular Buttons (Zero 9999px Pills) */
	.btn-action-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding-block: 0.5rem;
		padding-inline: 0.95rem;
		border-radius: 8px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: 0.8rem;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
	}

	.btn-action-primary:hover {
		background: rgba(1, 255, 195, 0.22);
		border-color: rgba(1, 255, 195, 0.7);
		transform: translateY(-1px);
		color: var(--highlight);
	}

	.btn-action-accent {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding-block: 0.5rem;
		padding-inline: 0.95rem;
		border-radius: 8px;
		background: rgba(5, 217, 232, 0.12);
		color: var(--accent);
		border: 1px solid rgba(5, 217, 232, 0.4);
		font-size: 0.8rem;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-action-accent:hover {
		background: rgba(5, 217, 232, 0.22);
		border-color: rgba(5, 217, 232, 0.7);
	}

	.btn-action-support {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding-block: 0.5rem;
		padding-inline: 0.95rem;
		border-radius: 8px;
		background: rgba(255, 42, 109, 0.16);
		color: #ff6b9b;
		border: 1px solid rgba(255, 42, 109, 0.45);
		font-size: 0.8rem;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-action-support:hover {
		background: rgba(255, 42, 109, 0.26);
		color: #ffffff;
		border-color: rgba(255, 42, 109, 0.7);
	}

	.btn-action-ghost {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: 0.5rem;
		padding-inline: 0.95rem;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.05);
		color: #d4d4d8;
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: 0.8rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
	}

	.btn-action-ghost:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.2);
	}

	.btn-table-action {
		display: inline-flex;
		align-items: center;
		padding-block: 0.35rem;
		padding-inline: 0.75rem;
		border-radius: 6px;
		font-size: 0.78rem;
		font-weight: 600;
		background: rgba(255, 255, 255, 0.05);
		color: #e4e4e7;
		border: 1px solid rgba(255, 255, 255, 0.12);
		text-decoration: none;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-table-action:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.22);
		color: #ffffff;
	}

	.btn-table-action-highlight {
		display: inline-flex;
		align-items: center;
		padding-block: 0.35rem;
		padding-inline: 0.75rem;
		border-radius: 6px;
		font-size: 0.78rem;
		font-weight: 700;
		background: rgba(1, 255, 195, 0.12);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.35);
		text-decoration: none;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-table-action-highlight:hover {
		background: rgba(1, 255, 195, 0.22);
		border-color: rgba(1, 255, 195, 0.6);
		color: var(--highlight);
	}

	/* Metadata Chips & Badges */
	.meta-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding-block: 0.2rem;
		padding-inline: 0.55rem;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #e4e4e7;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.03em;
	}

	.meta-chip.meta-highlight {
		background: rgba(1, 255, 195, 0.12);
		border-color: rgba(1, 255, 195, 0.3);
		color: var(--highlight);
	}

	.meta-chip.meta-accent {
		background: rgba(5, 217, 232, 0.12);
		border-color: rgba(5, 217, 232, 0.3);
		color: var(--accent);
	}

	.meta-chip.meta-support {
		background: rgba(255, 42, 109, 0.14);
		border-color: rgba(255, 42, 109, 0.35);
		color: #ff6b9b;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		padding-block: 0.2rem;
		padding-inline: 0.55rem;
		border-radius: 4px;
		font-size: 0.72rem;
		font-weight: 700;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		background: rgba(1, 255, 195, 0.12);
		border: 1px solid rgba(1, 255, 195, 0.35);
		color: var(--highlight);
	}

	.status-badge.status-cancelled {
		background: rgba(255, 42, 109, 0.14);
		border-color: rgba(255, 42, 109, 0.4);
		color: #ff6b9b;
	}

	/* Moderation Queue Buttons */
	.btn-mod-approve {
		display: inline-flex;
		align-items: center;
		padding-block: 0.35rem;
		padding-inline: 0.75rem;
		border-radius: 6px;
		background: rgba(1, 255, 195, 0.12);
		border: 1px solid rgba(1, 255, 195, 0.35);
		color: var(--highlight);
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-mod-approve:hover {
		background: rgba(1, 255, 195, 0.22);
	}

	.btn-mod-delete {
		display: inline-flex;
		align-items: center;
		padding-block: 0.35rem;
		padding-inline: 0.75rem;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #d4d4d8;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.btn-mod-delete:hover {
		background: rgba(255, 255, 255, 0.09);
		color: #ffffff;
	}

	.btn-mod-block {
		display: inline-flex;
		align-items: center;
		padding-block: 0.35rem;
		padding-inline: 0.75rem;
		border-radius: 6px;
		background: rgba(255, 42, 109, 0.12);
		border: 1px solid rgba(255, 42, 109, 0.35);
		color: #ff6b9b;
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-mod-block:hover {
		background: rgba(255, 42, 109, 0.22);
	}

	.btn-reply-trigger {
		display: inline-flex;
		align-items: center;
		padding-block: 0.4rem;
		padding-inline: 0.85rem;
		border-radius: 6px;
		background: rgba(5, 217, 232, 0.12);
		border: 1px solid rgba(5, 217, 232, 0.35);
		color: var(--accent);
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-reply-trigger:hover {
		background: rgba(5, 217, 232, 0.22);
		border-color: rgba(5, 217, 232, 0.6);
	}

	.btn-filter-tab {
		display: inline-flex;
		align-items: center;
		padding-block: 0.35rem;
		padding-inline: 0.75rem;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: var(--ink-muted);
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
	}

	.btn-filter-tab:hover {
		background: rgba(255, 255, 255, 0.09);
		color: #ffffff;
	}

	.btn-filter-tab.is-active {
		background: rgba(5, 217, 232, 0.14);
		border-color: rgba(5, 217, 232, 0.45);
		color: var(--accent);
	}
</style>
