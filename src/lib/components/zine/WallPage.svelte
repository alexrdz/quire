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
	The Wall: VIP Backstage Greenroom Board
	Fan notes are archival dark paper cards taped up with avatar badges and authentic 'Was There' ink stamps.
	Verified artist replies feature distinct accent borders and authentic marker writing.
	Every control meets the >= 44px touch target requirement.
-->
<ZinePageShell {shell} variant="wall">
	<Stack gap="2xs" class="wall-head">
		<Cluster justify="between" align="center" gap="xs">
			<h2 class="wall-heading marker-face">Greenroom Board</h2>
			<span class="wall-badge type-face">VIP Access</span>
		</Cluster>
		<p class="wall-subtext type-face">
			Leave your mark from tonight’s show. Public notes only—no links, emails, or phone numbers.
		</p>
	</Stack>

	<!-- Note composer: taped down flat, never tilted. -->
	<div class="wall-composer">
		<Tape placement="top" position={3} />
		<div class="wall-composer-paper">
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
				<div data-stack="gap:sm">
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
				</div>
			{/if}

			{#if wallMessage || formError}
				<p class="wall-feedback-msg" role="status">
					{wallMessage || formError}
				</p>
			{/if}
		</div>
	</div>

	<!-- The notes board -->
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
										<span class="note-avatar-badge type-face" aria-hidden="true">
											{(note.author?.name || 'F').charAt(0).toUpperCase()}
										</span>
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
							<!-- The Artist's reply: authentic marker writing with verified accent border -->
							<Scrap position={i + 31} tone="light" class="wall-reply">
								<Stack gap="3xs">
									<Cluster align="center" gap="2xs">
										<span class="verified-icon" aria-hidden="true">
											<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
												<path d="M8 0l2 2 2.8-.5.9 2.7 2.7.9-.5 2.8 2 2-2 2 .5 2.8-2.7.9-.9 2.7-2.8-.5-2 2-2-2-2.8.5-.9-2.7-2.7-.9.5-2.8-2-2 2-2-.5-2.8 2.7-.9.9-2.7 2.8.5zM6.5 11l5-5-1.1-1.1-3.9 3.9-1.8-1.8-1.1 1.1z"/>
											</svg>
										</span>
										<span class="reply-author-label type-face">{artistName} (Artist)</span>
										<span class="verified-pill type-face">Verified</span>
									</Cluster>
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

	.wall-badge {
		font-size: var(--text-meta);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		border-radius: 2px;
		padding-block: var(--space-4xs);
		padding-inline: var(--space-3xs);
		background: rgba(1, 255, 195, 0.08);
	}

	.wall-subtext {
		font-size: var(--text-small);
		line-height: var(--leading-body);
		color: #d4cfdc;
	}

	/* The composer: backstage clipboard card taped flat to the wall. */
	.wall-composer {
		position: relative;
		margin-block-start: var(--space-xs);
	}

	.wall-composer-paper {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding-block: var(--space-m) var(--space-s);
		padding-inline: var(--space-s);
		background-color: var(--zine-scrap-dark);
		background-image:
			var(--zine-grain),
			radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.05), transparent 75%),
			linear-gradient(to bottom, rgba(255, 255, 255, 0.03), transparent 50%);
		background-size: 160px 160px, auto, auto;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 3px;
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.4),
			0 12px 28px -6px rgba(0, 0, 0, 0.75),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.wall-composer-note {
		font-size: var(--text-small);
		line-height: var(--leading-body);
		color: #d4cfdc;
	}

	.wall-textarea {
		inline-size: 100%;
		min-block-size: 48px;
		background: rgba(9, 7, 16, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 2px;
		color: var(--paper);
		padding-block: var(--space-xs);
		padding-inline: var(--space-xs);
		font-family: inherit;
		font-size: var(--text-body);
		resize: none;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.wall-textarea::placeholder {
		color: #a9a3b4;
	}

	.wall-textarea:focus-visible {
		outline: 2px solid var(--highlight);
		outline-offset: 1px;
		border-color: var(--highlight);
		box-shadow: 0 0 12px rgba(1, 255, 195, 0.2);
	}

	.char-count {
		font-size: var(--text-meta);
		color: #c9c3d4;
	}

	.wall-feedback-msg {
		font-size: var(--text-small);
		color: var(--highlight);
	}

	/* The notes scroll inside the greenroom board */
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

	.note-avatar-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: 1.5rem;
		block-size: 1.5rem;
		border-radius: 50%;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.04));
		border: 1px solid rgba(255, 255, 255, 0.22);
		color: var(--highlight);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
		flex-shrink: 0;
	}

	.note-author {
		font-size: var(--text-small);
		color: var(--paper);
		font-weight: var(--weight-semibold);
	}

	.note-content-text {
		font-size: var(--text-ui);
		line-height: var(--leading-body);
		color: var(--paper);
		overflow-wrap: anywhere;
	}

	/* Verified artist reply: sleek accent border with ambient glow */
	:global(.wall-reply) {
		margin-block-start: calc(-1 * var(--space-3xs));
		margin-inline-start: var(--space-m);
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		border-inline-start: 3px solid var(--accent);
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.25),
			-3px 0 12px rgba(5, 217, 232, 0.3);
	}

	.verified-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--accent);
		inline-size: 12px;
		block-size: 12px;
	}

	.verified-pill {
		font-size: var(--text-meta);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--accent);
		background: rgba(5, 217, 232, 0.12);
		border: 1px solid rgba(5, 217, 232, 0.3);
		border-radius: 2px;
		padding-block: var(--space-4xs);
		padding-inline: var(--space-3xs);
	}

	.reply-author-label {
		font-size: var(--text-meta);
		text-transform: uppercase;
		letter-spacing: var(--tracking-label);
		color: #3b3545;
		font-weight: var(--weight-bold);
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
		min-inline-size: 44px;
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
