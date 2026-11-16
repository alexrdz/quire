<script lang="ts">
	import { Center, Box, Stack, Cluster, Grid } from '$lib/components/layout';

	let { data } = $props();
</script>

<svelte:head>
	<title>My Stubs & Collection | Quire</title>
</svelte:head>

<div class="stubs-page-root">
	<Center max="lg" padding="md" class="stubs-canvas">
		<Stack gap="xl">
			<header class="cover-header">
				<a href="/" class="glass-pill text-highlight link-clean">← Quire Home</a>
				<Cluster align="center" gap="xs">
					<span class="text-muted user-status">Signed in as {data.user.name}</span>
				</Cluster>
			</header>

			<Stack gap="xs">
				<h1 class="page-title">My Stubs</h1>
				<p class="text-muted page-subtitle">
					Your authenticated proof-of-attendance gig stubs and saved zines.
				</p>
			</Stack>

			<!-- STAMPED STUBS -->
			<Stack gap="md" as="section">
				<Cluster justify="between" align="center">
					<h2 class="text-highlight section-heading">
						Attended Gig Stubs ({data.stamped.length})
					</h2>
					<span class="glass-pill tag-highlight">Verified Attendance</span>
				</Cluster>

				{#if data.stamped.length === 0}
					<Box variant="raised" padding="xl" radius="md">
						<Stack gap="sm" align="center">
							<p class="text-muted">No attendance stubs yet.</p>
							<p class="subtext-muted">
								Scan the physical QR sticker at a live gig during the show to claim your stub!
							</p>
						</Stack>
					</Box>
				{:else}
					<Grid min="md" gap="md">
						{#each data.stamped as item}
							<div class="ticket-stub stub-card-padding">
								<Cluster justify="between" align="center">
									<span class="tag-highlight glass-pill">{item.issue.date}</span>
									<span class="glass-pill admit-badge">
										ADMIT ONE
									</span>
								</Cluster>

								<Stack gap="xs" class="stub-middle-content">
									<h3 class="stub-artist-title">
										{item.issue.artist.displayName}
									</h3>
									<p class="stub-venue-text">
										{item.issue.venue} — {item.issue.city}
									</p>
								</Stack>

								<div class="ticket-stub-perforation"></div>

								<Cluster justify="between" align="center" class="stub-footer-strip">
									<a
										href="/i/{item.issue.slug}"
										class="open-issue-link"
									>
										Open Issue Zine →
									</a>
									<span class="tag-highlight glass-pill attended-pill">✓ ATTENDED</span>
								</Cluster>
							</div>
						{/each}
					</Grid>
				{/if}
			</Stack>

			<!-- SAVED BOOKMARKS -->
			<Stack gap="md" as="section">
				<Cluster justify="between" align="center">
					<h2 class="section-heading-white">
						Saved Bookmarks ({data.saved.length})
					</h2>
					<span class="glass-pill">Reading List</span>
				</Cluster>

				{#if data.saved.length === 0}
					<Box variant="raised" padding="lg" radius="md" class="empty-bookmarks-box">
						No saved issues. Tap "Save to Collection" on any issue's Endpaper to bookmark it.
					</Box>
				{:else}
					<Grid min="sm" gap="md">
						{#each data.saved as item}
							<a
								href="/i/{item.issue.slug}"
								class="saved-card-link"
							>
								<Box variant="raised" padding="md" radius="md" class="saved-card-box">
									<Stack gap="xs">
										<span class="text-muted date-small">{item.issue.date}</span>
										<h4 class="saved-artist-title">
											{item.issue.artist.displayName}
										</h4>
										<p class="text-muted saved-venue-subtext">
											{item.issue.city} @ {item.issue.venue}
										</p>
									</Stack>
									<div class="read-zine-cue">
										Read Zine →
									</div>
								</Box>
							</a>
						{/each}
					</Grid>
				{/if}
			</Stack>
		</Stack>
	</Center>
</div>

<style>
	.stubs-page-root {
		background-color: var(--ink);
		min-block-size: 100vh;
	}

	:global(.stubs-canvas) {
		padding-block: var(--space-xl);
	}

	.link-clean {
		text-decoration: none;
	}

	.user-status {
		font-size: 0.85rem;
	}

	.page-title {
		font-size: 2.5rem;
		font-weight: 800;
		color: #ffffff;
	}

	.page-subtitle {
		font-size: 1.05rem;
	}

	.section-heading {
		font-size: 1.4rem;
		font-weight: 700;
	}

	.section-heading-white {
		font-size: 1.4rem;
		font-weight: 700;
		color: #ffffff;
	}

	.subtext-muted {
		font-size: 0.85rem;
		color: var(--ink-muted);
	}

	.stub-card-padding {
		padding: var(--space-m);
	}

	.admit-badge {
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	:global(.stub-middle-content) {
		margin-block: var(--space-s);
	}

	.stub-artist-title {
		font-size: 1.5rem;
		font-weight: 800;
		color: #ffffff;
	}

	.stub-venue-text {
		color: var(--highlight);
		font-weight: 600;
	}

	:global(.stub-footer-strip) {
		margin-block-start: var(--space-2xs);
	}

	.open-issue-link {
		color: var(--highlight);
		font-size: 0.85rem;
		font-weight: 600;
		text-decoration: none;
	}

	.attended-pill {
		font-size: 0.7rem;
	}

	:global(.empty-bookmarks-box) {
		text-align: center;
		color: var(--ink-muted);
	}

	.saved-card-link {
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
	}

	:global(.saved-card-box) {
		inline-size: 100%;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-block-size: 100%;
		transition: transform 0.15s ease;
	}

	:global(.saved-card-box:hover) {
		transform: translateY(-2px);
	}

	.date-small {
		font-size: 0.75rem;
	}

	.saved-artist-title {
		font-size: 1.2rem;
		font-weight: 700;
		color: #ffffff;
	}

	.saved-venue-subtext {
		font-size: 0.85rem;
	}

	.read-zine-cue {
		margin-block-start: var(--space-s);
		color: var(--paper);
		font-size: 0.85rem;
	}
</style>
