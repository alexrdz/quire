<script lang="ts">
	import { enhance } from '$app/forms';

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
				<a href="/a/{data.artist.slug}" class="glass-pill text-highlight" style="text-decoration: none;">
					← {data.artist.displayName}
				</a>
				{#if data.isScanVerified}
					<span class="glass-pill tag-highlight">● Attended Stamp Eligible</span>
				{/if}
			</header>

			<div data-stack="md" style="margin-block-start: auto; margin-block-end: 2rem;">
				<div class="cover-meta">
					<span class="glass-pill tag-highlight">{data.issue.date}</span>
					<span class="glass-pill">{data.issue.city}</span>
					<span class="glass-pill text-muted">{data.issue.venue}</span>
				</div>

				<h1 class="cover-title">
					{data.issue.city}
				</h1>

				{#if data.issue.coverNote}
					<p class="text-muted" style="max-inline-size: 55ch; font-size: 1.1rem; line-height: 1.5;">
						"{data.issue.coverNote}"
					</p>
				{/if}
			</div>

			<div data-cluster="between" style="padding-block-start: 1rem; border-block-start: 1px solid var(--glass-border);">
				<button
					type="button"
					class="floating-tip-btn"
					style="position: static; box-shadow: none;"
					onclick={() => (tipDrawerOpen = true)}
				>
					Support Artist (${(selectedTipCents / 100).toFixed(2)})
				</button>

				<button
					type="button"
					class="glass-pill text-highlight"
					style="cursor: pointer; padding: 0.75rem 1.25rem; font-size: 0.9rem;"
					onclick={() => scrollToPage(1)}
				>
					Open Tonight's Zine →
				</button>
			</div>

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
				<div class="page-inner" data-stack="md">
					<header class="cover-header">
						<span class="glass-pill tag-accent">Bespoke Page</span>
						<span class="text-muted" style="font-size: 0.8rem;">Page {idx + 2}</span>
					</header>

					<div class="page-body" data-stack="md" style="margin-block: auto;">
						{#if page.kind === 'setlist'}
							<h2 style="font-size: 1.8rem; font-weight: 700; color: #FFFFFF;">Tonight's Setlist</h2>
							<div class="glass-panel" style="padding: 1.5rem;" data-stack="sm">
								{#each (JSON.parse(page.contentJson || '{}').songs || ['Opener', 'New Track', 'Crowd Favorite', 'Encore']) as song, sIdx}
									<div data-cluster="between" style="border-block-end: 1px solid var(--glass-border); padding-block: 0.5rem;">
										<span>{sIdx + 1}. {song}</span>
										<span class="text-muted">Live</span>
									</div>
								{/each}
							</div>
						{:else}
							<h2 style="font-size: 1.8rem; font-weight: 700; color: #FFFFFF;">From the Road</h2>
							<p style="font-size: 1.15rem; line-height: 1.7; color: var(--paper);">
								{JSON.parse(page.contentJson || '{}').body || 'Thank you for being here tonight with us in this room.'}
							</p>
						{/if}
					</div>

					<footer class="page-footer">
						<button type="button" class="glass-pill" onclick={() => scrollToPage(idx + 2)}>Next Page →</button>
						<span>{data.issue.city}</span>
					</footer>
				</div>
			</section>
		{/each}
	{:else}
		<!-- Fallback Bespoke Page -->
		<section id="page-1" class="page text-content">
			<div class="page-inner" data-stack="md">
				<header class="cover-header">
					<span class="glass-pill tag-accent">Gig Notes</span>
					<span class="text-muted" style="font-size: 0.8rem;">Page 2</span>
				</header>

				<div class="page-body" data-stack="md" style="margin-block: auto;">
					<h2 style="font-size: 1.8rem; font-weight: 700; color: #FFFFFF;">Tonight at {data.issue.venue}</h2>
					<p style="font-size: 1.15rem; line-height: 1.7; color: var(--paper);">
						{data.issue.coverNote || 'Thank you for gathering with us tonight. Read the pages, leave your mark on the Wall, and claim your attendance stub.'}
					</p>
				</div>

				<footer class="page-footer">
					<button type="button" class="glass-pill" onclick={() => scrollToPage(2)}>Next: The Wall →</button>
					<span>{data.issue.venue}</span>
				</footer>
			</div>
		</section>
	{/if}

	<!-- THE WALL (PAGE N-1) -->
	<section id="page-wall" class="page" style="background-color: #07050E;">
		<div class="page-inner" data-stack="md">
			<header class="cover-header">
				<span class="glass-pill tag-highlight">The Wall</span>
				<span class="text-muted" style="font-size: 0.8rem;">Public Guestbook</span>
			</header>

			<div data-stack="sm">
				<h2 style="font-size: 1.8rem; font-weight: 800; color: #FFFFFF;">Leave Your Note</h2>
				<p class="text-muted" style="font-size: 0.9rem;">
					Post a memory from tonight. No links, phone numbers, or emails.
				</p>
			</div>

			<!-- Note Submission Form -->
			<div class="glass-panel" style="padding: 1.25rem;">
				{#if data.session?.user}
					<form method="POST" action="?/submitNote" use:enhance data-stack="sm">
						<input type="hidden" name="artistId" value={data.artist.id} />
						<input type="hidden" name="issueId" value={data.issue.id} />
						<textarea
							name="body"
							bind:value={noteBody}
							placeholder="Write something to the band and fellow fans..."
							rows="3"
							maxlength="500"
							style="inline-size: 100%; background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem; font-family: var(--font-sans); font-size: 0.95rem; resize: vertical;"
						></textarea>
						<div data-cluster="between">
							<span class="text-muted" style="font-size: 0.75rem;">{500 - noteBody.length} characters left</span>
							<button type="submit" class="glass-pill tag-highlight" style="cursor: pointer; padding: 0.5rem 1rem;">
								Post Note
							</button>
						</div>
					</form>
				{:else}
					<div data-stack="sm">
						<textarea
							bind:value={noteBody}
							placeholder="Type your note first..."
							rows="3"
							maxlength="500"
							style="inline-size: 100%; background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem; font-family: var(--font-sans); font-size: 0.95rem;"
						></textarea>
						<div data-cluster="between">
							<span class="text-muted" style="font-size: 0.75rem;">Draft saved automatically</span>
							<a
								href="/login?redirect=/i/{data.issue.slug}#page-wall"
								class="glass-pill tag-highlight"
								style="text-decoration: none; padding: 0.5rem 1rem;"
								onclick={saveDraftForAuth}
							>
								Sign in with Google to Post
							</a>
						</div>
					</div>
				{/if}
			</div>

			<!-- Live Notes Stream -->
			<div class="page-body" data-stack="sm" style="overflow-y: auto; max-block-size: 40vh;">
				{#if data.notes.length === 0}
					<div class="text-muted" style="text-align: center; padding: 2rem;">
						No notes left yet tonight. Be the first to sign the Wall!
					</div>
				{:else}
					{#each data.notes as note}
						<div class="note-card">
							<div data-cluster="between">
								<div class="note-author">
									<div class="note-avatar" style="display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.75rem; color: var(--highlight);">
										{note.author?.name ? note.author.name[0] : 'F'}
									</div>
									<span>{note.author?.name || 'Fan'}</span>
								</div>

								<form method="POST" action="?/flagNote" use:enhance>
									<input type="hidden" name="noteId" value={note.id} />
									<button type="submit" class="glass-pill text-muted" style="background: none; border: none; cursor: pointer; font-size: 0.7rem;">
										⚑ Flag
									</button>
								</form>
							</div>

							<p style="font-size: 0.95rem; line-height: 1.5; color: var(--paper);">
								{note.body}
							</p>

							<!-- Single Tier Artist Reply -->
							{#if note.replies && note.replies.length > 0}
								<div class="artist-reply" data-stack="xs">
									<span class="text-highlight" style="font-weight: 700; font-size: 0.75rem;">
										{data.artist.displayName} (Artist Reply)
									</span>
									<p style="color: #FFFFFF; font-size: 0.85rem;">
										{note.replies[0].body}
									</p>
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>

			<footer class="page-footer">
				<button type="button" class="glass-pill" onclick={() => scrollToPage(3)}>Next: Endpaper →</button>
				<span>The Wall</span>
			</footer>
		</div>
	</section>

	<!-- ENDPAPER (FINAL PAGE) -->
	<section id="page-endpaper" class="page" style="background-color: var(--endpaper); color: #1A1A1A;">
		<div class="page-inner" data-stack="lg">
			<header class="cover-header">
				<span class="glass-pill" style="color: #1A1A1A; border-color: rgba(0,0,0,0.2);">Endpaper</span>
				<span style="font-family: var(--font-mono); font-size: 0.8rem;">Admit One</span>
			</header>

			<div data-stack="md" style="margin-block: auto;">
				<!-- Ticket Stub Frame -->
				<div class="ticket-stub" style="background: #1A1A1A; color: #FFFFFF; padding: 1.5rem;">
					<div data-cluster="between">
						<span class="tag-highlight glass-pill">{data.issue.date}</span>
						<span class="glass-pill" style="font-family: var(--font-mono);">STUB #{data.issue.id.slice(0, 8)}</span>
					</div>

					<div data-stack="xs" style="margin-block: 1rem;">
						<h3 style="font-size: 1.8rem; font-weight: 800; color: #FFFFFF;">{data.artist.displayName}</h3>
						<p style="color: var(--highlight); font-weight: 600;">{data.issue.venue} — {data.issue.city}</p>
					</div>

					<div class="ticket-stub-perforation"></div>

					<div data-cluster="between" style="align-items: center; margin-block-start: 0.5rem;">
						<div style="font-family: var(--font-mono); font-size: 0.75rem; color: #888;">
							VERIFIED ATTENDANCE PROOF
						</div>

						{#if data.collectionStatus === 'stamped'}
							<span class="tag-highlight glass-pill" style="font-weight: 700;">✓ STAMPED</span>
						{:else if data.collectionStatus === 'saved'}
							<span class="glass-pill">BOOKMARKED (SAVED)</span>
						{/if}
					</div>
				</div>

				<!-- Collection Actions -->
				<div data-stack="sm">
					{#if data.collectionStatus === 'stamped'}
						<div class="glass-panel" style="padding: 1rem; text-align: center; border-color: rgba(0,0,0,0.1); background: rgba(0,0,0,0.05); color: #1A1A1A;">
							✓ You've stamped this gig! View it in <a href="/me/stubs" style="color: var(--support); font-weight: 700;">My Stubs</a>.
						</div>
					{:else}
						<div data-cluster="center">
							{#if data.isScanVerified}
								<form method="POST" action="?/claimStamp" use:enhance>
									<input type="hidden" name="issueId" value={data.issue.id} />
									<button type="submit" class="floating-tip-btn" style="position: static; background: var(--ink); border: 2px solid var(--highlight); color: var(--highlight); box-shadow: none;">
										★ Claim Verified Stamp
									</button>
								</form>
							{:else}
								<form method="POST" action="?/saveIssue" use:enhance>
									<input type="hidden" name="issueId" value={data.issue.id} />
									<button type="submit" class="glass-pill" style="cursor: pointer; padding: 0.75rem 1.5rem; background: #1A1A1A; color: #FFFFFF; border: none;">
										Save to Collection
									</button>
								</form>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<footer class="page-footer" style="color: #555;">
				<a href="/a/{data.artist.slug}" style="color: #1A1A1A; font-weight: 700; text-decoration: none;">
					Visit {data.artist.displayName}'s Back Page →
				</a>
				<span>End of Zine</span>
			</footer>
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
	<div
		class="glass-drawer"
		style="position: fixed; inset-inline: 0; inset-block-end: 0; z-index: 100; padding: 1.5rem; border-radius: 24px 24px 0 0;"
		data-stack="md"
	>
		<div data-cluster="between">
			<div data-stack="xs">
				<h3 style="font-size: 1.25rem; font-weight: 700; color: #FFFFFF;">
					Tip {data.artist.displayName}
				</h3>
				<span class="text-muted" style="font-size: 0.8rem;">1-tap checkout. Anonymous. Bandcamp-style 5% platform cut.</span>
			</div>
			<button
				type="button"
				class="glass-pill"
				style="cursor: pointer;"
				onclick={() => (tipDrawerOpen = false)}
			>
				✕ Close
			</button>
		</div>

		<!-- Presets -->
		<div data-cluster>
			{#each data.tipPresets as preset}
				<button
					type="button"
					class="glass-pill"
					style="cursor: pointer; padding: 0.6rem 1.2rem; font-size: 1rem; {selectedTipCents === preset * 100 ? 'border-color: var(--support); color: var(--support); background: rgba(255, 42, 109, 0.15); font-weight: 700;' : ''}"
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
				style="inline-size: 100px; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 9999px; color: #FFFFFF; padding: 0.5rem 1rem; font-size: 0.9rem;"
			/>
		</div>

		<!-- Fan Covered Fees Toggle -->
		<label data-cluster style="cursor: pointer; font-size: 0.85rem; color: var(--paper);">
			<input type="checkbox" bind:checked={fanCoveredFees} />
			<span>Cover processing fee so {data.artist.displayName} gets 100% of the net</span>
		</label>

		<!-- Tip Action Form -->
		<form method="POST" action="?/tip" use:enhance data-stack="xs">
			<input type="hidden" name="artistId" value={data.artist.id} />
			<input type="hidden" name="issueId" value={data.issue.id} />
			<input type="hidden" name="amountGrossCents" value={selectedTipCents} />
			<input type="hidden" name="fanCoveredFees" value={String(fanCoveredFees)} />

			<button
				type="submit"
				class="floating-tip-btn"
				style="position: static; inline-size: 100%; justify-content: center; padding: 1rem; font-size: 1.1rem; box-shadow: none;"
			>
				Send ${(selectedTipCents / 100).toFixed(2)} Tip Now
			</button>
		</form>

		{#if form?.error}
			<div style="color: var(--support); font-size: 0.85rem; text-align: center;">
				{form.error}
			</div>
		{/if}

		{#if form?.success && form?.tipResult}
			<div class="glass-panel" style="padding: 1rem; text-align: center; border-color: var(--highlight);">
				<div class="text-highlight" style="font-weight: 700;">Tip Confirmed!</div>
				<p class="text-muted" style="font-size: 0.85rem;">
					Thank you for supporting live music. Recorded in artist recap.
				</p>
			</div>
		{/if}
	</div>
{/if}
