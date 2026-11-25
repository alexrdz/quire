<script module lang="ts">
	/**
	 * "just now", "5m", "3h", "2d", and the date after a week ("Oct 12"), like a
	 * comment thread. A missing or unreadable time gives an empty string.
	 */
	export function timeAgo(at: Date | string | number | null | undefined, now: Date = new Date()): string {
		if (at === null || at === undefined || at === '') return '';
		const then = at instanceof Date ? at : new Date(typeof at === 'number' && at < 1e12 ? at * 1000 : at);
		const ms = now.getTime() - then.getTime();
		if (!Number.isFinite(ms)) return '';
		const minutes = Math.floor(ms / 60000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d`;
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(then);
	}

	/** Initials for an avatar: the first letters of the first two words. */
	export function initialsFor(name: string | null | undefined): string {
		const words = (name ?? '').trim().split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
		return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'F';
	}
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageShell, WallNote } from './reader';

	/** A note as the Issue load returns it, with the times the thread shows. */
	type ThreadNote = WallNote & {
		createdAt?: Date | string | number | null;
		replies?: Array<{ body: string; createdAt?: Date | string | number | null }> | null;
	};

	interface Props {
		/** The Wall page's id and place; not needed in the sheet. */
		shell?: PageShell;
		/** `page`: the Wall page in the reader. `sheet`: inside the Wall bottom sheet. */
		variant?: 'page' | 'sheet';
		notes: ThreadNote[];
		artistId: string;
		artistName: string;
		issueId: string;
		signedIn: boolean;
		isReadOnly: boolean;
		isArtistClosed: boolean;
		/** The last form action's error, if any. */
		formError?: string;
		/** The draft note; the page saves it across Google sign-in. */
		noteBody: string;
		onSignInToPost: () => void;
	}

	let {
		shell,
		variant = 'page',
		notes,
		artistId,
		artistName,
		issueId,
		signedIn,
		isReadOnly,
		isArtistClosed,
		formError,
		noteBody = $bindable(),
		onSignInToPost
	}: Props = $props();

	const MAX_NOTE = 250;
	/** Ids are per layout: the Wall page and the Wall sheet can both be in the DOM. */
	const prefix = $derived(variant === 'sheet' ? 'wall-sheet' : 'wall-page');

	let wallMessage = $state('');
	/** The note whose "more" menu is open. */
	let menuFor = $state<string | null>(null);
	/** The keyboard's height over the sheet (visualViewport), so the composer stays above it. */
	let keyboard = $state(0);
	let root: HTMLElement | undefined = $state();

	const countLabel = $derived(notes.length === 1 ? '1 note' : `${notes.length} notes`);
	const artistInitials = $derived(initialsFor(artistName));

	// Close the "more" menu on Escape or a tap anywhere else.
	$effect(() => {
		if (!menuFor) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.stopPropagation();
				menuFor = null;
			}
		};
		const onDown = (event: PointerEvent) => {
			if (!(event.target instanceof Element) || !event.target.closest('.wall-more')) menuFor = null;
		};
		window.addEventListener('keydown', onKey, true);
		window.addEventListener('pointerdown', onDown, true);
		return () => {
			window.removeEventListener('keydown', onKey, true);
			window.removeEventListener('pointerdown', onDown, true);
		};
	});

	// In the sheet, keep the composer above an on-screen keyboard: on phones the
	// keyboard covers the bottom of the layout viewport, so lift by what it hides.
	$effect(() => {
		if (variant !== 'sheet' || typeof window === 'undefined' || !window.visualViewport) return;
		const vv = window.visualViewport;
		const update = () => {
			keyboard = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
		};
		update();
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		return () => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
		};
	});

	function keepComposerInView() {
		// After the keyboard opens, make sure the field is in view.
		setTimeout(() => root?.querySelector('.wall-composer')?.scrollIntoView({ block: 'nearest' }), 300);
	}
</script>

{#snippet thread()}
	{#if notes.length === 0}
		<p class="wall-empty">No notes yet. Be the first to sign the Wall.</p>
	{:else}
		<ol class="wall-notes" aria-label="Notes on the Wall">
			{#each notes as note (note.id)}
				{@const name = note.author?.name || 'Fan'}
				{@const reply = note.replies?.[0]}
				<li class="wall-note-item">
					<article class="wall-note">
						<span class="wall-avatar" aria-hidden="true">{initialsFor(name)}</span>
						<div class="wall-note-main">
							<div class="wall-note-meta">
								<span class="note-author">{name}</span>
								{#if note.wasThere}
									<span class="was-there">Was there</span>
								{/if}
								{#if note.createdAt}
									<span class="note-time">{timeAgo(note.createdAt)}</span>
								{/if}
							</div>
							<p class="note-content-text">{note.body}</p>
						</div>

						{#if signedIn && !isReadOnly}
							<div class="wall-more">
								<button
									type="button"
									class="wall-more-button"
									aria-label="More for the note from {name}"
									aria-haspopup="true"
									aria-expanded={menuFor === note.id}
									onclick={() => (menuFor = menuFor === note.id ? null : note.id)}
								>
									<svg viewBox="0 0 24 24" aria-hidden="true" class="wall-icon">
										<circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
									</svg>
								</button>
								{#if menuFor === note.id}
									<div class="wall-menu">
										<form
											method="POST"
											action="?/flagNote"
											use:enhance={() =>
												async ({ update }) => {
													menuFor = null;
													await update();
												}}
										>
											<input type="hidden" name="noteId" value={note.id} />
											<button type="submit" class="wall-menu-item" aria-label="Flag the note from {name}">
												Flag note
											</button>
										</form>
									</div>
								{/if}
							</div>
						{/if}
					</article>

					{#if reply}
						<!-- The Artist's reply, indented under the note. -->
						<div class="wall-reply">
							<span class="wall-avatar is-artist" aria-hidden="true">{artistInitials}</span>
							<div class="wall-note-main">
								<div class="wall-note-meta">
									<span class="note-author">{artistName}</span>
									<span class="artist-badge">Artist</span>
									{#if reply.createdAt}
										<span class="note-time">{timeAgo(reply.createdAt)}</span>
									{/if}
								</div>
								<p class="reply-content-text">{reply.body}</p>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
{/snippet}

{#snippet composer()}
	<div class="wall-composer">
		{#if isReadOnly}
			<p class="wall-composer-note">
				{isArtistClosed
					? 'This artist has left Quire. The Wall is preserved in read-only archive mode.'
					: 'This issue is archived and preserved in read-only mode.'}
			</p>
		{:else if signedIn}
			<form
				class="wall-form"
				method="POST"
				action="?/submitNote"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							noteBody = '';
							wallMessage =
								result.data?.status === 'pending' ? 'Note submitted for artist approval!' : 'Your note is live on the Wall!';
						} else if (result.type === 'failure') {
							wallMessage = String(result.data?.error || 'Could not post note.');
						}
						await update();
					};
				}}
			>
				<input type="hidden" name="artistId" value={artistId} />
				<input type="hidden" name="issueId" value={issueId} />
				<label for="{prefix}-note-body" class="visually-hidden">Your note to {artistName}</label>
				<textarea
					id="{prefix}-note-body"
					name="body"
					bind:value={noteBody}
					placeholder="Add a note for {artistName}…"
					rows="1"
					maxlength={MAX_NOTE}
					required
					class="wall-textarea"
					aria-describedby="{prefix}-note-count"
					onfocus={keepComposerInView}
				></textarea>
				<button type="submit" class="wall-post" disabled={noteBody.trim().length === 0}>Post</button>
			</form>
			<span id="{prefix}-note-count" class="wall-count">{MAX_NOTE - noteBody.length} characters left</span>
		{:else}
			<div class="wall-form">
				<label for="{prefix}-note-draft" class="visually-hidden">Your note to {artistName}</label>
				<textarea
					id="{prefix}-note-draft"
					bind:value={noteBody}
					placeholder="Add a note for {artistName}…"
					rows="1"
					maxlength={MAX_NOTE}
					class="wall-textarea"
					onfocus={keepComposerInView}
				></textarea>
				<button type="button" class="wall-post" onclick={onSignInToPost}>Sign in to post</button>
			</div>
		{/if}

		{#if wallMessage || formError}
			<p class="wall-feedback-msg" role="status">{wallMessage || formError}</p>
		{/if}
	</div>
{/snippet}

<!--
	The Wall (ADR 0011): notes look like a modern comment thread. An initials
	avatar, the name, a "Was there" badge for a stamped Fan, the note and how
	long ago it was left; the Artist's reply is indented under it. Flag lives in
	each note's "more" menu. The composer is pinned to the bottom. The same
	thread and composer serve the Wall page and the Wall sheet.
-->
{#if variant === 'sheet'}
	<div class="story-wall is-sheet" bind:this={root}>
		<p class="wall-sub">{countLabel} · Public notes only: no links, emails or phone numbers.</p>
		<div class="wall-scroll">
			{@render thread()}
		</div>
		{@render composer()}
		<!-- Room for an on-screen keyboard, so the composer stays above it. -->
		<div class="wall-keyboard-space" style="--wall-keyboard: {keyboard}px;" aria-hidden="true"></div>
	</div>
{:else}
	<section id={shell?.id ?? 'page-wall'} class="story-wall is-page" aria-labelledby="{prefix}-title" bind:this={root}>
		<header class="wall-head">
			<h2 id="{prefix}-title" class="wall-title" tabindex="-1">The Wall</h2>
			<p class="wall-sub">{countLabel} · Public notes only: no links, emails or phone numbers.</p>
		</header>
		<div class="wall-scroll">
			{@render thread()}
		</div>
		{@render composer()}
	</section>
{/if}

<style>
	.story-wall {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		color: #ffffff;
		font-family: var(--story-font, system-ui, sans-serif);
	}

	/* The Wall page fills the reader's frame, clear of the header and the bottom bar. */
	.story-wall.is-page {
		position: absolute;
		inset: 0;
		padding-block: var(--story-top-space) var(--story-bottom-space);
		padding-inline: var(--space-s);
		background: var(--bg-void);
	}

	/* In the sheet the thread scrolls and the composer stays at the bottom. */
	.story-wall.is-sheet {
		max-block-size: 72dvh;
		padding-block-end: var(--space-2xs);
	}

	.wall-keyboard-space {
		flex: none;
		block-size: var(--wall-keyboard);
	}

	.wall-head {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}

	.wall-title {
		margin: 0;
		font-family: var(--story-heading-font, inherit);
		font-size: var(--text-heading);
		font-weight: var(--weight-heavy);
		line-height: var(--leading-heading);
	}

	.wall-title:focus {
		outline: none;
	}

	.wall-sub {
		margin: 0;
		font-size: var(--text-small);
		line-height: var(--leading-body);
		color: #c4c0cc;
	}

	.wall-scroll {
		flex: 1 1 auto;
		min-block-size: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.wall-notes {
		display: flex;
		flex-direction: column;
		gap: var(--space-s);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.wall-note-item {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.wall-note,
	.wall-reply {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2xs);
	}

	.wall-reply {
		margin-inline-start: var(--space-l);
	}

	.wall-avatar {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: 2.25rem;
		block-size: 2.25rem;
		border-radius: 999px;
		background: #2a2633;
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}

	.wall-avatar.is-artist {
		inline-size: 1.75rem;
		block-size: 1.75rem;
		background: var(--accent);
		color: var(--on-accent, #090710);
	}

	.wall-note-main {
		flex: 1 1 auto;
		min-inline-size: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-4xs);
	}

	.wall-note-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3xs);
		line-height: 1.3;
	}

	.note-author {
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}

	.was-there {
		padding-inline: var(--space-3xs);
		border-radius: 999px;
		background: var(--highlight);
		color: var(--bg-void);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
	}

	.artist-badge {
		padding-inline: var(--space-3xs);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.16);
		color: #ffffff;
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
	}

	.note-time {
		font-size: var(--text-meta);
		color: #b9b4c3;
	}

	.note-content-text,
	.reply-content-text {
		margin: 0;
		font-size: var(--text-ui);
		line-height: var(--leading-body);
		color: #ffffff;
		overflow-wrap: anywhere;
	}

	.wall-empty {
		margin: 0;
		padding-block: var(--space-m);
		font-size: var(--text-body);
		color: #c4c0cc;
		text-align: center;
	}

	/* "More": a quiet 44 px button with a small menu under it. */
	.wall-more {
		position: relative;
		flex: none;
	}

	.wall-more-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: var(--control-size);
		block-size: var(--control-size);
		margin-block-start: calc(-1 * var(--space-2xs));
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: #c4c0cc;
		cursor: pointer;
	}

	.wall-icon {
		inline-size: 1.25rem;
		block-size: 1.25rem;
		fill: currentColor;
	}

	.wall-menu {
		position: absolute;
		z-index: 2;
		inset-block-start: 100%;
		inset-inline-end: 0;
		min-inline-size: 9rem;
		padding-block: var(--space-3xs);
		border-radius: 12px;
		background: #26222e;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	}

	.wall-menu-item {
		display: flex;
		align-items: center;
		inline-size: 100%;
		min-block-size: var(--control-size);
		padding-inline: var(--space-s);
		border: 0;
		background: transparent;
		color: #ff8fb2;
		font-family: inherit;
		font-size: var(--text-ui);
		font-weight: var(--weight-semibold);
		text-align: start;
		cursor: pointer;
	}

	/* The composer, pinned under the thread. */
	.wall-composer {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		padding-block-start: var(--space-2xs);
		border-block-start: 1px solid rgba(255, 255, 255, 0.1);
	}

	.wall-form {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2xs);
	}

	.wall-textarea {
		flex: 1 1 auto;
		min-inline-size: 0;
		min-block-size: var(--control-size);
		max-block-size: 8rem;
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.06);
		color: #ffffff;
		font-family: inherit;
		font-size: var(--text-body);
		line-height: 1.3;
		resize: none;
		field-sizing: content;
	}

	.wall-textarea::placeholder {
		color: #a9a3b4;
	}

	.wall-post {
		flex: none;
		min-block-size: var(--control-size);
		padding-inline: var(--space-s);
		border: 0;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent, #090710);
		font-family: inherit;
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		cursor: pointer;
	}

	.wall-post:disabled {
		background: rgba(255, 255, 255, 0.12);
		color: #c4c0cc;
		cursor: default;
	}

	.wall-count {
		font-size: var(--text-meta);
		color: #b9b4c3;
	}

	.wall-composer-note,
	.wall-feedback-msg {
		margin: 0;
		font-size: var(--text-small);
		line-height: var(--leading-body);
	}

	.wall-composer-note {
		color: #c4c0cc;
	}

	.wall-feedback-msg {
		color: var(--highlight);
	}

	.wall-textarea:focus-visible,
	.wall-post:focus-visible,
	.wall-more-button:focus-visible,
	.wall-menu-item:focus-visible {
		outline: 2px solid #ffffff;
		outline-offset: 2px;
	}
</style>
