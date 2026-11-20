<script lang="ts">
	import { enhance } from '$app/forms';
	import { Stack, Box, Cluster } from '$lib/components/layout';
	import MetaChip from './MetaChip.svelte';
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
</script>

<ZinePageShell {shell} variant="wall">
	<Stack gap="2xs">
		<h2 class="wall-heading">Digital Guestbook</h2>
		<p class="text-muted wall-subtext">
			Leave your mark from tonight’s show. Public notes only—no links, emails, or phone numbers.
		</p>
	</Stack>

	<!-- Note Submission Box -->
	<Box variant="raised" padding="md" radius="md" class="wall-composer-box">
		{#if isReadOnly}
			<p class="text-muted">
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
				<textarea
					name="body"
					bind:value={noteBody}
					placeholder="Write a note to {artistName}..."
					rows="2"
					maxlength="250"
					required
					class="wall-textarea"
				></textarea>
				<Cluster justify="between" align="center">
					<span class="text-muted char-count">{250 - noteBody.length} chars left</span>
					<button type="submit" class="btn-wall-post">
						Post Note →
					</button>
				</Cluster>
			</form>
		{:else}
			<Stack gap="sm">
				<textarea
					bind:value={noteBody}
					placeholder="Type your note to the band first..."
					rows="2"
					maxlength="250"
					class="wall-textarea"
				></textarea>
				<Cluster justify="between" align="center">
					<span class="text-muted char-count">{250 - noteBody.length} chars left</span>
					<button type="button" class="btn-wall-post" onclick={onSignInToPost}>
						Sign in with Google to Post →
					</button>
				</Cluster>
			</Stack>
		{/if}

		{#if wallMessage || formError}
			<p class="text-highlight wall-feedback-msg">
				{wallMessage || formError}
			</p>
		{/if}
	</Box>

	<!-- Live Notes Stream -->
	<Stack gap="sm" class="notes-scroll-body">
		{#if notes.length === 0}
			<Box variant="subtle" padding="lg" radius="md" class="empty-notes-box">
				<p class="text-muted">No notes left yet tonight. Be the first to sign the Wall!</p>
			</Box>
		{:else}
			{#each notes as note}
				<Stack as="article" gap="xs" class="note-card">
					<Cluster justify="between" align="center">
						<Cluster align="center" gap="xs">
							<div class="note-avatar">
								{note.author?.name ? note.author.name[0] : 'F'}
							</div>
							<span class="note-author">{note.author?.name || 'Fan'}</span>
							{#if note.wasThere}
								<MetaChip tone="highlight">✓ Was There</MetaChip>
							{/if}
						</Cluster>

						{#if signedIn && !isReadOnly}
							<form method="POST" action="?/flagNote" use:enhance>
								<input type="hidden" name="noteId" value={note.id} />
								<button type="submit" class="btn-flag-note">
									Flag
								</button>
							</form>
						{/if}
					</Cluster>

					<p class="note-content-text">{note.body}</p>

					{#if note.replies && note.replies.length > 0}
						<Stack gap="3xs" class="artist-reply">
							<span class="text-accent reply-author-label">
								✓ {artistName} (Artist)
							</span>
							<p class="reply-content-text">{note.replies[0].body}</p>
						</Stack>
					{/if}
				</Stack>
			{/each}
		{/if}
	</Stack>
</ZinePageShell>

<style>
	.wall-heading {
		font-size: var(--text-heading);
		font-weight: var(--weight-heavy);
		color: #ffffff;
	}

	.wall-subtext {
		font-size: var(--text-body);
	}

	:global(.wall-composer-box) {
		border-color: var(--glass-border);
	}

	.wall-textarea {
		inline-size: 100%;
		background: rgba(0, 0, 0, 0.45);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		padding-block: var(--space-xs);
		padding-inline: var(--space-xs);
		font-family: inherit;
		font-size: var(--text-body);
		resize: none;
	}

	.char-count {
		font-size: var(--text-meta);
	}

	.wall-feedback-msg {
		font-size: var(--text-small);
		margin-block-start: var(--space-2xs);
	}

	:global(.notes-scroll-body) {
		flex: 1;
		overflow-y: auto;
		max-block-size: 38vh;
		padding-inline-end: var(--space-3xs);
	}

	.note-content-text {
		font-size: var(--text-ui);
		line-height: var(--leading-body);
		color: #f4f4f0;
	}

	.reply-author-label {
		font-weight: var(--weight-bold);
		font-size: var(--text-meta);
	}

	.reply-content-text {
		color: #ffffff;
		font-size: var(--text-small);
	}

	.btn-wall-post {
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
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-wall-post:hover {
		background: rgba(1, 255, 195, 0.24);
	}

	.btn-flag-note {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-3xs);
		padding-inline: var(--space-2xs);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.04);
		color: #a1a1aa;
		border: 1px solid rgba(255, 255, 255, 0.08);
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.btn-flag-note:hover {
		background: rgba(255, 42, 109, 0.15);
		color: #ff6b9b;
	}
</style>
