<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>My Stubs & Collection | Quire</title>
</svelte:head>

<div style="background-color: var(--ink); min-block-size: 100vh;">
	<div data-center style="padding-block: 2rem;" data-stack="xl">
		<header class="cover-header">
			<a href="/" class="glass-pill text-highlight" style="text-decoration: none;">← Quire Home</a>
			<div data-cluster>
				<span class="text-muted" style="font-size: 0.85rem;">Signed in as {data.user.name}</span>
			</div>
		</header>

		<div data-stack="xs">
			<h1 style="font-size: 2.5rem; font-weight: 800; color: #FFFFFF;">My Stubs</h1>
			<p class="text-muted" style="font-size: 1.05rem;">
				Your authenticated proof-of-attendance gig stubs and saved zines.
			</p>
		</div>

		<!-- STAMPED STUBS -->
		<section data-stack="md">
			<div data-cluster="between">
				<h2 class="text-highlight" style="font-size: 1.4rem; font-weight: 700;">
					Attended Gig Stubs ({data.stamped.length})
				</h2>
				<span class="glass-pill tag-highlight">Verified Attendance</span>
			</div>

			{#if data.stamped.length === 0}
				<div class="glass-panel" style="padding: 2.5rem; text-align: center;" data-stack="sm">
					<p class="text-muted">No attendance stubs yet.</p>
					<p style="font-size: 0.85rem; color: #666;">
						Scan the physical QR sticker at a live gig during the show to claim your stub!
					</p>
				</div>
			{:else}
				<div data-grid style="--grid-min: 320px;">
					{#each data.stamped as item}
						<div class="ticket-stub" style="padding: 1.5rem;">
							<div data-cluster="between">
								<span class="tag-highlight glass-pill">{item.issue.date}</span>
								<span class="glass-pill" style="font-family: var(--font-mono); font-size: 0.75rem;">
									ADMIT ONE
								</span>
							</div>

							<div data-stack="xs" style="margin-block: 1.25rem;">
								<h3 style="font-size: 1.5rem; font-weight: 800; color: #FFFFFF;">
									{item.issue.artist.displayName}
								</h3>
								<p style="color: var(--highlight); font-weight: 600;">
									{item.issue.venue} — {item.issue.city}
								</p>
							</div>

							<div class="ticket-stub-perforation"></div>

							<div data-cluster="between" style="align-items: center; margin-block-start: 0.5rem;">
								<a
									href="/i/{item.issue.slug}"
									style="color: var(--highlight); font-size: 0.85rem; font-weight: 600; text-decoration: none;"
								>
									Open Issue Zine →
								</a>
								<span class="tag-highlight glass-pill" style="font-size: 0.7rem;">✓ ATTENDED</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- SAVED BOOKMARKS -->
		<section data-stack="md">
			<div data-cluster="between">
				<h2 style="font-size: 1.4rem; font-weight: 700; color: #FFFFFF;">
					Saved Bookmarks ({data.saved.length})
				</h2>
				<span class="glass-pill">Reading List</span>
			</div>

			{#if data.saved.length === 0}
				<div class="glass-panel" style="padding: 2rem; text-align: center; color: var(--ink-muted);">
					No saved issues. Tap "Save to Collection" on any issue's Endpaper to bookmark it.
				</div>
			{:else}
				<div data-grid style="--grid-min: 280px;">
					{#each data.saved as item}
						<a
							href="/i/{item.issue.slug}"
							class="glass-panel"
							style="padding: 1.25rem; text-decoration: none; color: inherit; display: flex; flex-direction: column; justify-content: space-between;"
						>
							<div data-stack="xs">
								<span class="text-muted" style="font-size: 0.75rem;">{item.issue.date}</span>
								<h4 style="font-size: 1.2rem; font-weight: 700; color: #FFFFFF;">
									{item.issue.artist.displayName}
								</h4>
								<p class="text-muted" style="font-size: 0.85rem;">
									{item.issue.city} @ {item.issue.venue}
								</p>
							</div>
							<div style="margin-block-start: 1rem; color: var(--paper); font-size: 0.85rem;">
								Read Zine →
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>
