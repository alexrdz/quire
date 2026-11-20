<script lang="ts">
	import { enhance } from '$app/forms';
	import { Stack, Cluster } from '$lib/components/layout';
	import Scrap from './Scrap.svelte';
	import Stamp from './Stamp.svelte';
	import Tape from './Tape.svelte';
	import ZinePageShell from './ZinePageShell.svelte';
	import type { PageShell, WallNote } from './reader';

	interface Props {
		shell: PageShell;
		notes: WallNote[];
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

	let wallMessage = $state('');

	/** Where each note's tape goes, by position, so the notes don't all look the same. */
	const TAPE_PLACEMENTS = ['top', 'top-left', 'top-right'] as const;
	function tapeFor(index: number): (typeof TAPE_PLACEMENTS)[number] {
		return TAPE_PLACEMENTS[index % TAPE_PLACEMENTS.length]!;
	}
</script>

<!--
	The Wall (ADR 0009): Fan notes are dark paper scraps taped up at a small,
	deterministic tilt; the Artist's reply is a cream slip in the marker face
	stuck under its note; "Was There" is an ink stamp. The composer is taped
	down and never tilted, and every control is at least 44 px.
-->
<ZinePageShell {shell} variant="wall">
	<Stack gap="2xs" class="wall-head">
		<h2 class="wall-heading marker-face">Digital Guestbook</h2>
		<p class="wall-subtext type-face">
			Leave your mark from tonight’s show. Public notes only—no links, emails, or phone numbers.
		</p>
	</Stack>

	<!-- Note composer: taped down, never tilted. -->
	<div class="wall-composer">
		<Tape placement="top" position={3} />
		<Stack gap="sm" class="wall-composer-paper">
			{#if isReadOnly}
				<p class="wall-composer-note">
					{isArtistClosed
						? 'This artist has left Quire. The Wall is preserved in read-only archive mode.'
						: 'This issue is archived and preserved in read-only mode.'}
				</p>
			{:else if signedIn}
				<form
					data-stack="gap:sm"
					method="POST"
					action="?/submitNote"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'success') {
								noteBody = '';
								wallMessage =
									result.data?.status === 'pending'
										? 'Note submitted for artist approval!'
										: 'Your note is live on the Wall!';
							} else if (result.type === 'failure') {
								wallMessage = String(result.data?.error || 'Could not post note.');
							}
							await update();
						};
					}}
				>
					<input type="hidden" name="artistId" value={artistId} />
					<input type="hidden" name="issueId" value={issueId} />
					<label for="wall-note-body" class="visually-hidden">Your note to {artistName}</label>
					<textarea
						id="wall-note-body"
						name="body"
						bind:value={noteBody}
						placeholder="Write a note to {artistName}..."
						rows="2"
						maxlength="250"
						required
						class="wall-textarea"
					></textarea>
					<Cluster justify="between" align="center" gap="xs">
						<span class="char-count type-face">{250 - noteBody.length} chars left</span>
						<button type="submit" class="btn-wall-post">
							Post Note →
						</button>
					</Cluster>
				</form>
			{:else}
				<label for="wall-note-draft" class="visually-hidden">Your note to {artistName}</label>
				<textarea
					id="wall-note-draft"
					bind:value={noteBody}
					placeholder="Type your note to the band first..."
					rows="2"
					maxlength="250"
					class="wall-textarea"
				></textarea>
				<Cluster justify="between" align="center" gap="xs">
					<span class="char-count type-face">{250 - noteBody.length} chars left</span>
					<button type="button" class="btn-wall-post" onclick={onSignInToPost}>
						Sign in with Google to Post →
					</button>
				</Cluster>
			{/if}

			{#if wallMessage || formError}
				<p class="wall-feedback-msg" role="status">
					{wallMessage || formError}
				</p>
			{/if}
		</Stack>
	</div>

	<!-- The notes, taped up. -->
	<div class="wall-notes-scroll">
		{#if notes.length === 0}
			<Scrap position={0} tone="light" class="wall-empty">
				<Tape placement="top" position={4} />
				<p class="wall-empty-text type-face">No notes left yet tonight. Be the first to sign the Wall!</p>
			</Scrap>
		{:else}
			<Stack as="ol" gap="lg" class="wall-notes" aria-label="Notes on the Wall">
				{#each notes as note, i (note.id)}
					<li class="wall-note-item">
						<Scrap position={i} tone="dark" as="article" class="wall-note">
							<Tape placement={tapeFor(i)} position={i} />
							<Stack gap="xs">
								<Cluster justify="between" align="center" gap="xs">
									<Cluster align="center" gap="xs">
										<span class="note-author type-face">{note.author?.name || 'Fan'}</span>
										{#if note.wasThere}
											<Stamp label="Was There" tone="highlight" position={i} />
										{/if}
									</Cluster>

									{#if signedIn && !isReadOnly}
										<form method="POST" action="?/flagNote" use:enhance>
											<input type="hidden" name="noteId" value={note.id} />
											<button
												type="submit"
												class="btn-flag-note"
												aria-label="Flag the note from {note.author?.name || 'a Fan'}"
											>
												Flag
											</button>
										</form>
									{/if}
								</Cluster>

								<p class="note-content-text">{note.body}</p>
							</Stack>
						</Scrap>

						{#if note.replies && note.replies.length > 0}
							<!-- The Artist's reply: a marker note stuck under the Fan's note. -->
							<Scrap position={i + 31} tone="light" class="wall-reply">
								<Stack gap="3xs">
									<span class="reply-author-label type-face">{artistName} (Artist)</span>
									<p class="reply-content-text marker-face">{note.replies[0].body}</p>
								</Stack>
							</Scrap>
						{/if}
					</li>
				{/each}
			</Stack>
		{/if}
	</div>
</ZinePageShell>

<style>
	.wall-heading {
		font-size: var(--text-heading);
		font-weight: 400;
		line-height: 1.15;
		color: var(--paper);
	}

	.wall-subtext {
		font-size: var(--text-small);
		line-height: var(--leading-body);
		color: #d4cfdc;
	}

	/* The composer: a sheet of dark paper taped flat to the page. */
	.wall-composer {
		position: relative;
		margin-block-start: var(--space-xs);
	}

	:global(.wall-composer-paper) {
		padding-block: var(--space-m) var(--space-s);
		padding-inline: var(--space-s);
		background-color: var(--zine-scrap-dark);
		background-image: var(--zine-grain);
		background-size: 160px 160px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 2px 3px 2px 4px;
		box-shadow:
			0 1px 1px rgba(0, 0, 0, 0.4),
			0 10px 22px -8px rgba(0, 0, 0, 0.7);
	}

	.wall-composer-note {
		font-size: var(--text-small);
		line-height: var(--leading-body);
		color: #d4cfdc;
	}

	.wall-textarea {
		inline-size: 100%;
		min-block-size: 44px;
		background: rgba(0, 0, 0, 0.45);
		border: 1px solid rgba(255, 255, 255, 0.22);
		border-radius: 2px;
		color: var(--paper);
		padding-block: var(--space-xs);
		padding-inline: var(--space-xs);
		font-family: inherit;
		font-size: var(--text-body);
		resize: none;
	}

	.wall-textarea::placeholder {
		color: #a9a3b4;
	}

	.wall-textarea:focus-visible {
		outline: 2px solid var(--highlight);
		outline-offset: 2px;
	}

	.char-count {
		font-size: var(--text-meta);
		color: #c9c3d4;
	}

	.wall-feedback-msg {
		font-size: var(--text-small);
		color: var(--highlight);
	}

	/* The notes scroll inside the page; padding leaves room for tape and tilt. */
	.wall-notes-scroll {
		flex: 1;
		overflow-y: auto;
		overflow-x: clip;
		max-block-size: 38vh;
		padding-block: var(--space-s) var(--space-xs);
		padding-inline: var(--space-xs);
	}

	:global(.wall-notes) {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.wall-note-item {
		display: flow-root;
	}

	.note-author {
		font-size: var(--text-small);
		color: var(--paper);
	}

	.note-content-text {
		font-size: var(--text-ui);
		line-height: var(--leading-body);
		color: var(--paper);
		overflow-wrap: anywhere;
	}

	/* Stuck under the note, overlapping only the note's bottom edge. */
	:global(.wall-reply) {
		margin-block-start: calc(-1 * var(--space-3xs));
		margin-inline-start: var(--space-l);
		padding-block: var(--space-xs);
	}

	.reply-author-label {
		font-size: var(--text-meta);
		text-transform: uppercase;
		letter-spacing: var(--tracking-label);
		color: #4a4356;
	}

	.reply-content-text {
		font-size: var(--text-ui);
		line-height: 1.45;
		color: var(--zine-scrap-light-ink);
		overflow-wrap: anywhere;
	}

	.wall-empty-text {
		font-size: var(--text-small);
		line-height: var(--leading-body);
	}

	.btn-wall-post {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-block-size: 44px;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		border-radius: 2px;
		background: var(--highlight);
		color: var(--ink);
		border: 1px solid var(--highlight);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: filter 0.15s ease;
	}

	.btn-wall-post:hover {
		filter: brightness(1.08);
	}

	.btn-flag-note {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-block-size: 44px;
		min-inline-size: 44px;
		padding-inline: var(--space-2xs);
		border-radius: 2px;
		background: transparent;
		color: #d4cfdc;
		border: 1px solid rgba(255, 255, 255, 0.28);
		font-family: var(--font-type);
		font-size: var(--text-meta);
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.btn-flag-note:hover {
		background: rgba(255, 42, 109, 0.15);
		color: #ff8fb2;
	}

	.btn-wall-post:focus-visible,
	.btn-flag-note:focus-visible {
		outline: 2px solid var(--highlight);
		outline-offset: 2px;
	}
</style>
