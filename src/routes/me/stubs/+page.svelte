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
					<a href="/" class="btn-back-link">← Quire Portal</a>
					<span class="text-highlight font-mono eyebrow-tag">FAN COLLECTION</span>
				</Cluster>

				<Cluster align="center" gap="xs">
					<span class="text-muted user-status">Signed in as {data.user.name}</span>
					<a href="/logout" class="btn-signout-link">Sign Out</a>
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
										Open Issue Zine →
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
											Read Issue →
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
		min-block-size: 100vh;
	}

	:global(.stubs-canvas) {
		padding-block: var(--space-xl);
	}

	.eyebrow-tag {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.user-status {
		font-size: 0.8rem;
	}

	.page-title {
		font-size: clamp(2rem, 4vw, 2.75rem);
		font-weight: 800;
		color: #ffffff;
	}

	.page-subtitle {
		font-size: 0.95rem;
	}

	.section-heading {
		font-size: 1.25rem;
		font-weight: 700;
	}

	.section-heading-white {
		font-size: 1.25rem;
		font-weight: 700;
		color: #ffffff;
	}

	.subtext-muted {
		font-size: 0.85rem;
		color: var(--ink-muted);
	}

	:global(.stub-card-padding) {
		padding: 1.5rem;
	}

	.admit-text {
		font-size: 0.7rem;
		letter-spacing: 0.1em;
	}

	.stub-artist-link {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--accent);
		text-decoration: none;
	}

	.stub-artist-link:hover {
		text-decoration: underline;
	}

	.stub-city-title {
		font-size: 1.5rem;
		font-weight: 800;
		color: #ffffff;
	}

	.stub-venue-text {
		color: #d4d2df;
		font-size: 0.9rem;
	}

	.attended-text {
		font-size: 0.75rem;
		font-weight: 700;
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
		padding: 0.875rem;
		display: flex;
		align-items: flex-end;
	}

	.saved-artist-link {
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--accent);
		text-decoration: none;
	}

	.saved-artist-link:hover {
		text-decoration: underline;
	}

	.saved-city-title {
		font-size: 1.2rem;
		font-weight: 800;
		color: #ffffff;
	}

	.saved-venue-subtext {
		font-size: 0.85rem;
	}

	/* Sleek Buttons and Badges (Zero 9999px Pills) */
	.btn-back-link {
		display: inline-flex;
		align-items: center;
		padding-block: 0.4rem;
		padding-inline: 0.8rem;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.05);
		color: #e4e4e7;
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: 0.78rem;
		font-weight: 600;
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
		padding-block: 0.4rem;
		padding-inline: 0.75rem;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.04);
		color: #a1a1aa;
		border: 1px solid rgba(255, 255, 255, 0.08);
		font-size: 0.78rem;
		font-weight: 600;
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
		padding-block: 0.45rem;
		padding-inline: 0.95rem;
		border-radius: 6px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: 0.78rem;
		font-weight: 700;
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
		padding-block: 0.2rem;
		padding-inline: 0.55rem;
		border-radius: 4px;
		font-size: 0.72rem;
		font-weight: 700;
		font-family: var(--font-mono);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.meta-chip.meta-highlight {
		background: rgba(1, 255, 195, 0.12);
		border: 1px solid rgba(1, 255, 195, 0.35);
		color: var(--highlight);
	}
</style>
