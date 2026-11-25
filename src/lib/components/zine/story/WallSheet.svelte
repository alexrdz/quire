<script lang="ts">
	import { page } from '$app/state';
	import BottomSheet from './BottomSheet.svelte';
	import WallPage from '../WallPage.svelte';
	import AuthDrawer from '../AuthDrawer.svelte';
	import type { Mode } from '$lib/features';
	import type { WallNote } from '../reader';

	/**
	 * The Wall sheet (ADR 0011), from the bottom bar on any page: the same thread
	 * and composer as the Wall page, with the composer pinned to the bottom of the
	 * sheet. The Issue's notes and the Fan's sign-in come from the page's data, so
	 * the sheet and the Wall page always agree. Signing in to post saves the draft
	 * (the same way the Wall page does), closes the sheet and opens sign-in.
	 */
	interface Props {
		open: boolean;
		onclose: () => void;
		/** The count the bottom bar shows; the sheet counts the live notes itself. */
		noteCount?: number;
	}

	let { open, onclose }: Props = $props();

	interface ReaderData {
		notes?: WallNote[];
		artist?: { id: string; displayName: string };
		issue?: { id: string };
		viewer?: unknown;
		isReadOnly?: boolean;
		isArtistClosed?: boolean;
		features?: { fanSignIn: boolean; mode: Mode };
	}

	const data = $derived((page.data ?? {}) as ReaderData);
	const formError = $derived((page.form as { error?: string } | null)?.error);
	const fanSignInError = $derived((page.form as { fanSignInError?: string } | null)?.fanSignInError);

	let noteBody = $state('');
	let signingIn = $state(false);

	function signInToPost() {
		const issueId = data.issue?.id;
		if (issueId && noteBody.trim().length > 0) {
			try {
				sessionStorage.setItem(`quire_draft_${issueId}`, noteBody);
			} catch {
				// Without storage the draft is just not kept.
			}
		}
		onclose();
		signingIn = true;
	}
</script>

<BottomSheet {open} {onclose} label="The Wall" title="The Wall" class="wall-sheet">
	{#if data.artist && data.issue}
		<WallPage
			variant="sheet"
			notes={data.notes ?? []}
			artistId={data.artist.id}
			artistName={data.artist.displayName}
			issueId={data.issue.id}
			signedIn={Boolean(data.viewer)}
			isReadOnly={Boolean(data.isReadOnly)}
			isArtistClosed={Boolean(data.isArtistClosed)}
			{formError}
			bind:noteBody
			onSignInToPost={signInToPost}
		/>
	{/if}
</BottomSheet>

{#if signingIn && data.features}
	<AuthDrawer
		pendingAction="note"
		fanSignIn={data.features.fanSignIn}
		mode={data.features.mode}
		{fanSignInError}
		onClose={() => (signingIn = false)}
	/>
{/if}
