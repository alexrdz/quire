<script lang="ts">
	import { Container, Box, Stack, Cluster, Grid } from '$lib/components/layout';

	let { data } = $props();
</script>

<svelte:head>
	<title>My Stubs & Collection | Quire</title>
</svelte:head>

<div class="stubs-page-root">
	<!-- Top Navigation -->
	<header class="app-topbar">
		<Container width="lg" padding="none">
			<Cluster justify="between" align="center" gap="md">
				<Cluster align="center" gap="sm">
					<a href="/" class="btn-back-link">← Quire Home</a>
					<span class="text-highlight font-mono eyebrow-tag">FAN COLLECTION</span>
				</Cluster>

				<Cluster align="center" gap="xs">
					<span class="text-muted user-status">Signed in as {data.viewer.name}</span>
					<form method="POST" action="/logout" class="signout-form">
						<button type="submit" class="btn-signout-link">Sign Out</button>
					</form>
				</Cluster>
			</Cluster>
		</Container>
	</header>

	<Container as="main" width="lg" padding="md" class="stubs-canvas">
		<Stack gap="xl">
			<Stack gap="xs">
				<h1 class="page-title">My Stubs</h1>
				<p class="text-muted page-subtitle">
					Your authenticated proof-of-attendance gig stubs and saved zine bookmarks.
				</p>
			</Stack>

			<!-- STAMPED STUBS (SPEC.md §5.6) -->
			<Stack as="section" gap="md">
				<Cluster justify="between" align="center">
					<h2 class="text-highlight section-heading">
						Stamped Gig Stubs ({data.stamped.length})
					</h2>
					<span class="meta-chip meta-highlight">Verified Attendance</span>
				</Cluster>

				{#if data.stamped.length === 0}
					<Box variant="raised" padding="xl" radius="md">
						<Stack gap="sm" align="center">
							<p class="text-muted">No attendance stubs claimed yet.</p>
							<p class="subtext-muted">
								Scan the physical QR sticker at a live gig during the 48-hour Stamp Window to claim your ticket stub!
							</p>
						</Stack>
					</Box>
				{:else}
					<Grid min="md" gap="md">
						{#each data.stamped as item}
							<Stack as="article" gap="sm" class="ticket-stub stub-card-padding">
								<Cluster justify="between" align="center">
									<span class="meta-chip meta-highlight">{item.issue.date}</span>
									<span class="text-muted font-mono admit-text">ADMIT ONE</span>
								</Cluster>

								<Stack gap="2xs">
									<a
										href="/a/{item.issue.artist.slug}"
										class="stub-artist-link"
									>
										{item.issue.artist.displayName} ↗
									</a>
									<h3 class="stub-city-title">{item.issue.city}</h3>
									<p class="stub-venue-text">{item.issue.venue}</p>
								</Stack>

								<div class="ticket-stub-perforation"></div>

								<Cluster justify="between" align="center">
									<a href="/i/{item.issue.slug}" class="btn-stub-open">
										Read Tour Zine →
									</a>
									<span class="text-highlight font-mono attended-text">✓ STAMPED</span>
								</Cluster>
							</Stack>
						{/each}
					</Grid>
				{/if}
			</Stack>

			<!-- SAVED BOOKMARKS (SPEC.md §5.6) -->
			<Stack as="section" gap="md">
				<Cluster justify="between" align="center">
					<h2 class="section-heading-white">
						Saved Issues ({data.saved.length})
					</h2>
					<span class="text-muted font-mono eyebrow-tag">BOOKMARKS</span>
				</Cluster>

				{#if data.saved.length === 0}
					<Box variant="raised" padding="lg" radius="md" class="empty-bookmarks-box">
						No saved issues yet. Tap "+ Save Issue to My Stubs" on any Issue’s Endpaper to bookmark it.
					</Box>
				{:else}
					<Grid min="sm" gap="md">
						{#each data.saved as item}
							<Box as="article" variant="raised" padding="none" radius="lg" class="saved-card-box">
								<div
									class="saved-cover-thumb"
									style="--thumb-art: {item.issue.artist.coverArtUrl
										? `linear-gradient(to bottom, rgba(9, 7, 16, 0.2), rgba(9, 7, 16, 0.92)), url('${item.issue.artist.coverArtUrl}')`
										: 'none'};"
								>
									<span class="meta-chip meta-highlight">{item.issue.date}</span>
								</div>

								<Box padding="md" border="none">
									<Stack gap="xs" align="start">
										<a
											href="/a/{item.issue.artist.slug}"
											class="saved-artist-link"
										>
											{item.issue.artist.displayName} ↗
										</a>
										<h4 class="saved-city-title">{item.issue.city}</h4>
										<p class="text-muted saved-venue-subtext">{item.issue.venue}</p>

										<a href="/i/{item.issue.slug}" class="btn-stub-open">
											Read Tour Zine →
										</a>
									</Stack>
								</Box>
							</Box>
						{/each}
					</Grid>
				{/if}
			</Stack>
		</Stack>
	</Container>
</div>

<style>
	.stubs-page-root {
		background-color: var(--bg-void);
	}

	:global(.stubs-canvas) {
		padding-block: var(--space-xl);
	}

	.eyebrow-tag {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
	}

	.user-status {
		font-size: var(--text-meta);
	}

	.page-title {
		font-size: var(--text-title);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.page-subtitle {
		font-size: var(--text-ui);
	}

	.section-heading {
		font-size: var(--text-lead);
		font-weight: var(--weight-bold);
	}

	.section-heading-white {
		font-size: var(--text-lead);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}

	.subtext-muted {
		font-size: var(--text-body);
		color: var(--ink-muted);
	}

	:global(.stub-card-padding) {
		padding-block: var(--space-m);
		padding-inline: var(--space-m);
	}

	.admit-text {
		font-size: var(--text-meta);
		letter-spacing: var(--tracking-wide);
	}

	.stub-artist-link {
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		color: var(--accent);
		text-decoration: none;
	}

	.stub-artist-link:hover {
		text-decoration: underline;
	}

	.stub-city-title {
		font-size: var(--text-heading-sm);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.stub-venue-text {
		color: #d4d2df;
		font-size: var(--text-ui);
	}

	.attended-text {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
	}

	:global(.empty-bookmarks-box) {
		color: var(--ink-muted);
		text-align: center;
	}

	:global(.saved-card-box) {
		border-color: var(--glass-border);
		overflow: hidden;
	}

	.saved-cover-thumb {
		block-size: 7.5rem;
		background-color: var(--bg-surface);
		background-image: var(--thumb-art, none);
		background-size: cover;
		background-position: center;
		padding-block: var(--space-xs);
		padding-inline: var(--space-xs);
		display: flex;
		align-items: flex-end;
	}

	.saved-artist-link {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		color: var(--accent);
		text-decoration: none;
	}

	.saved-artist-link:hover {
		text-decoration: underline;
	}

	.saved-city-title {
		font-size: var(--text-lead);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.saved-venue-subtext {
		font-size: var(--text-body);
	}

	/* Sleek Buttons and Badges (Zero 9999px Pills) */
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

	.btn-signout-link {
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

	.btn-signout-link:hover {
		background: rgba(255, 255, 255, 0.09);
		color: #ffffff;
	}

	.btn-stub-open {
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
		text-decoration: none;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-stub-open:hover {
		background: rgba(1, 255, 195, 0.24);
		border-color: rgba(1, 255, 195, 0.7);
		color: var(--highlight);
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
</style>
