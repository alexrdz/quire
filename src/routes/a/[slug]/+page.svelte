<script lang="ts">
	import { enhance } from '$app/forms';

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

<div style="background-color: var(--ink); min-block-size: 100vh; --accent: {data.artist.accentColor || '#05D9E8'};">
	<div data-center style="padding-block: 2rem;" data-stack="xl">
		<!-- Header / Bio -->
		<header class="glass-panel" style="padding: 2rem; position: relative; overflow: hidden;" data-stack="md">
			<div data-cluster="between">
				<div data-cluster>
					<span class="glass-pill text-highlight">Artist Back Page</span>
					{#if data.artist.verified}
						<span class="glass-pill tag-highlight">✓ Verified Artist</span>
					{/if}
				</div>

				<button
					type="button"
					class="floating-tip-btn"
					style="position: static; box-shadow: none;"
					onclick={() => (tipDrawerOpen = true)}
				>
					Support (${(selectedTipCents / 100).toFixed(2)})
				</button>
			</div>

			<div data-stack="xs" style="margin-block-start: 1rem;">
				<h1 style="font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; color: #FFFFFF;">
					{data.artist.displayName}
				</h1>
				{#if data.artist.bio}
					<p class="text-muted" style="max-inline-size: 60ch; font-size: 1.1rem; line-height: 1.6;">
						{data.artist.bio}
					</p>
				{/if}
			</div>

			<!-- External Links (Bandcamp, Tickets, Merch) -->
			{#if data.links.length > 0}
				<div data-cluster style="padding-block-start: 1rem; border-block-start: 1px solid var(--glass-border);">
					{#each data.links as link}
						<a
							href={link.url}
							target="_blank"
							rel="noopener noreferrer"
							class="glass-pill"
							style="text-decoration: none; color: var(--paper);"
						>
							↗ {link.label}
						</a>
					{/each}
				</div>
			{/if}
		</header>

		<!-- All Issues Grouped by Month -->
		<section data-stack="md">
			<div data-cluster="between">
				<h2 style="font-size: 1.6rem; font-weight: 700; color: #FFFFFF;">All Gig Issues</h2>
				<span class="text-muted" style="font-size: 0.85rem;">Permanent archive</span>
			</div>

			{#if data.groupedIssues.length === 0}
				<div class="glass-panel" style="padding: 2rem; text-align: center; color: var(--ink-muted);">
					No published issues yet.
				</div>
			{:else}
				<div data-stack="lg">
					{#each data.groupedIssues as group}
						<div data-stack="sm">
							<h3 class="text-highlight" style="font-size: 1.1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
								{group.month}
							</h3>

							<div data-grid style="--grid-min: 280px;">
								{#each group.issues as issue}
									<a
										href="/i/{issue.slug}"
										class="glass-panel"
										style="padding: 1.25rem; text-decoration: none; color: inherit; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.15s ease;"
									>
										<div data-stack="xs">
											<div data-cluster="between">
												<span class="glass-pill tag-highlight" style="font-size: 0.7rem;">{issue.date}</span>
												<span class="text-muted" style="font-size: 0.75rem;">Zine #{issue.slug}</span>
											</div>
											<h4 style="font-size: 1.3rem; font-weight: 700; color: #FFFFFF; margin-block-start: 0.5rem;">
												{issue.city}
											</h4>
											<p class="text-muted" style="font-size: 0.9rem;">
												{issue.venue}
											</p>
										</div>

										<div style="margin-block-start: 1rem; color: var(--highlight); font-size: 0.85rem; font-weight: 600;">
											Open Zine →
										</div>
									</a>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- General Wall -->
		<section class="glass-panel" style="padding: 2rem;" data-stack="md">
			<div data-cluster="between">
				<div>
					<h2 style="font-size: 1.6rem; font-weight: 700; color: #FFFFFF;">General Wall</h2>
					<p class="text-muted" style="font-size: 0.9rem;">Open guestbook for {data.artist.displayName}.</p>
				</div>
				<span class="glass-pill">Public Notes</span>
			</div>

			<!-- Note Submission Form -->
			{#if data.session?.user}
				<form method="POST" action="?/submitNote" use:enhance data-stack="sm">
					<input type="hidden" name="artistId" value={data.artist.id} />
					<textarea
						name="body"
						bind:value={noteBody}
						placeholder="Say hello to the band..."
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
						placeholder="Type a note..."
						rows="3"
						maxlength="500"
						style="inline-size: 100%; background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.75rem; font-family: var(--font-sans); font-size: 0.95rem;"
					></textarea>
					<div data-cluster="between">
						<span class="text-muted" style="font-size: 0.75rem;">Draft saved</span>
						<a
							href="/login?redirect=/a/{data.artist.slug}"
							class="glass-pill tag-highlight"
							style="text-decoration: none; padding: 0.5rem 1rem;"
						>
							Sign in with Google to Post
						</a>
					</div>
				</div>
			{/if}

			<!-- Notes Stream -->
			<div data-stack="sm" style="margin-block-start: 1rem;">
				{#if data.generalNotes.length === 0}
					<div class="text-muted" style="text-align: center; padding: 2rem;">
						No notes yet on the General Wall.
					</div>
				{:else}
					{#each data.generalNotes as note}
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
		</section>

		<footer class="page-footer">
			<span>Quire Artist Back Page</span>
			<a href="/" style="color: var(--highlight); text-decoration: none;">Powered by Quire</a>
		</footer>
	</div>
</div>

<!-- SLIDE-UP TIP DRAWER -->
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
				<span class="text-muted" style="font-size: 0.8rem;">1-tap general tip. Anonymous.</span>
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

		<form method="POST" action="?/tip" use:enhance data-stack="xs">
			<input type="hidden" name="artistId" value={data.artist.id} />
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

		{#if form?.success && form?.tipResult}
			<div class="glass-panel" style="padding: 1rem; text-align: center; border-color: var(--highlight);">
				<div class="text-highlight" style="font-weight: 700;">Tip Confirmed!</div>
				<p class="text-muted" style="font-size: 0.85rem;">
					Thank you for supporting {data.artist.displayName}.
				</p>
			</div>
		{/if}
	</div>
{/if}
