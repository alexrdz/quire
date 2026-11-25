import { error, fail, type Actions, type RequestEvent, type ServerLoad } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { ArtistAccountStatus } from '$domain/account';
import { db, schema } from '$lib/server/db';
import { optionalUser } from '$lib/server/guards';
import { loadIssueReader } from '$lib/server/services/issue-reader';

/**
 * The Artist's own preview of an Issue, framed by the Bookbinder (B1-T33, ADR 0011).
 *
 * It renders the same Stories reader as /i/[slug], with the same data, for drafts and
 * published Issues alike, but only for the signed-in Artist who owns the Issue. Anyone
 * else, signed out or not, gets 404 (not 403), so a draft can't be discovered. It is
 * never indexed or cached, and only Quire may frame it (security-headers.ts).
 *
 * Nothing in it writes: every action the reader posts to is refused here, on the server,
 * beyond the client guard in BookbinderPreview.
 */

const PREVIEW_REFUSAL = 'This is a preview, so nothing here is saved or sent.';

/** The signed-in user's active Artist, or null. */
async function ownerArtistId(event: Parameters<ServerLoad>[0]): Promise<string | null> {
	const signedIn = optionalUser(event);
	if (!signedIn) return null;
	const artist = await db.query.artists.findFirst({
		where: and(eq(schema.artists.userId, signedIn.user.id), eq(schema.artists.accountStatus, ArtistAccountStatus.Active))
	});
	return artist?.id ?? null;
}

export const load: ServerLoad = async (event) => {
	event.setHeaders({
		'cache-control': 'private, no-store',
		'x-robots-tag': 'noindex, nofollow'
	});
	const artistId = await ownerArtistId(event);
	if (!artistId) throw error(404, 'Issue not found');
	return loadIssueReader(event, { kind: 'owner', issueId: event.params.id, artistId });
};

/** Signed out: 401, like every dashboard action. Signed in: the preview's refusal. */
const refuse = (event: RequestEvent) =>
	optionalUser(event)
		? fail(403, { error: PREVIEW_REFUSAL, fanSignInError: PREVIEW_REFUSAL })
		: fail(401, { error: 'Unauthorized', fanSignInError: 'Unauthorized' });

/** Every action the reader can post to: the Wall, flagging, Stamp, Save and Fan sign-in. */
export const actions: Actions = {
	submitNote: refuse,
	flagNote: refuse,
	claimStamp: refuse,
	saveIssue: refuse,
	googleAuth: refuse
};
