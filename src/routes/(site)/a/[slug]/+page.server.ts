import { error, fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { allowsStandIn, getConfig } from '$lib/server/config';
import { FEATURE_UNAVAILABLE } from '$lib/features';
import { ArtistAccountStatus } from '$domain/account';
import { groupIssuesByMonth } from '$domain/issue';
import { db, schema } from '$lib/server/db';
import { eq, and, desc, isNull, inArray } from 'drizzle-orm';
import { auth, createSessionForUser } from '$lib/server/auth';
import { consumeRateLimit } from '$lib/server/services/rate-limit';
import { submitWallNote, flagWallNote } from '$lib/server/services/moderation';
import { submitNoteSchema, flagNoteSchema } from '$schemas/wall';

export const load: ServerLoad = async ({ params, request }) => {
	const slug = params.slug;
	if (!slug) throw error(404, 'Artist slug required');

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.slug, slug),
		with: {
			issues: {
				where: inArray(schema.issues.status, ['published', 'cancelled']),
				orderBy: [desc(schema.issues.date)]
			}
		}
	});

	if (!artist) {
		throw error(404, 'Artist not found');
	}

	// Fetch general wall notes (issueId is NULL)
	const generalNotes = await db.query.notes.findMany({
		where: and(
			eq(schema.notes.artistId, artist.id),
			isNull(schema.notes.issueId),
			eq(schema.notes.status, 'live')
		),
		orderBy: [desc(schema.notes.createdAt)],
		with: {
			author: {
				columns: { id: true, name: true, image: true }
			},
			replies: true
		}
	});

	const session = await auth.api.getSession({
		headers: request.headers
	});

	// Parse tip presets and links
	let tipPresets = [3, 5, 10];
	try {
		tipPresets = JSON.parse(artist.tipPresetsJson || '[3, 5, 10]');
	} catch {}

	let links: Array<{ label: string; url: string }> = [];
	try {
		links = JSON.parse(artist.linksJson || '[]');
	} catch {}

	// Group issues by month: 'October 2026', 'September 2026', etc.
	// Closed accounts archive all issues and hide them from the Back Page.
	const isArtistClosed = artist.accountStatus === ArtistAccountStatus.Closed;
	const issues = isArtistClosed ? [] : artist.issues || [];
	const groupedIssues = groupIssuesByMonth(issues);

	return {
		artist,
		isArtistClosed,
		groupedIssues,
		generalNotes,
		tipPresets,
		links,
		session
	};
};

export const actions: Actions = {
	googleAuth: async ({ request, params, cookies }) => {
		const callbackURL = `/a/${params.slug}#general-wall`;
		const { features, live } = getConfig();
		if (!features.fanSignIn) {
			return fail(503, { fanSignInError: FEATURE_UNAVAILABLE.fanSignIn });
		}

		if (live.fanSignIn) {
			const res = await auth.api.signInSocial({
				body: {
					provider: 'google',
					callbackURL
				},
				headers: request.headers
			});
			if (res?.url) {
				throw redirect(303, res.url);
			}
			return fail(502, { fanSignInError: FEATURE_UNAVAILABLE.fanSignIn });
		}

		// Stand-in sign-in as the sample Fan: development, test and the Demo only (ADR 0007).
		if (!allowsStandIn('fanSignIn', getConfig().mode)) {
			return fail(503, { fanSignInError: FEATURE_UNAVAILABLE.fanSignIn });
		}
		const fanUser = await db.query.users.findFirst({
			where: eq(schema.users.email, 'maya@example.com')
		});
		if (fanUser) {
			await createSessionForUser(cookies, fanUser.id);
		}
		throw redirect(303, callbackURL);
	},

	submitNote: async ({ request, params, getClientAddress }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});

		if (!session?.user) {
			return fail(401, { error: 'Please sign in to leave a note on the General Wall.' });
		}

		const artistRecord = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, params.slug!)
		});
		if (artistRecord?.accountStatus === ArtistAccountStatus.Closed) {
			return fail(403, { error: 'This artist has left Quire.' });
		}

		const formData = await request.formData();
		const artistId = String(formData.get('artistId') || '');
		const body = String(formData.get('body') || '');

		const parseResult = submitNoteSchema.safeParse({ body });
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const noteLimit = await consumeRateLimit('wallNoteIp', getClientAddress());
		if (!noteLimit.allowed) {
			return fail(429, { error: noteLimit.message });
		}

		const noteResult = await submitWallNote({
			artistId,
			issueId: null, // General Wall
			fanUserId: session.user.id,
			body: parseResult.data.body
		});

		if (!noteResult.ok) {
			return fail(400, { error: noteResult.error.message });
		}

		return { success: true, noteId: noteResult.value.noteId, status: noteResult.value.status };
	},

	flagNote: async ({ request, params, getClientAddress }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});

		if (!session?.user) {
			return fail(401, { error: 'Sign in to flag a note.' });
		}

		const artistRecord = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, params.slug!)
		});
		if (artistRecord?.accountStatus === ArtistAccountStatus.Closed) {
			return fail(403, { error: 'This artist has left Quire.' });
		}

		const formData = await request.formData();
		const noteId = String(formData.get('noteId') || '');

		const parseResult = flagNoteSchema.safeParse({ noteId });
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const flagLimit = await consumeRateLimit('flagIp', getClientAddress());
		if (!flagLimit.allowed) {
			return fail(429, { error: flagLimit.message });
		}

		const flagResult = await flagWallNote(noteId, session.user.id);
		if (!flagResult.ok) {
			return fail(400, { error: flagResult.error.message });
		}

		return { success: true, ...flagResult.value };
	}
};
