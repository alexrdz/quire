import { error, fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { allowsStandIn, getConfig } from '$lib/server/config';
import { FEATURE_UNAVAILABLE } from '$lib/features';
import { ArtistAccountStatus } from '$domain/account';
import { isPubliclyReadable } from '$domain/issue';
import { db, schema } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { auth, createSessionForUser } from '$lib/server/auth';
import { requireFan, isDenied } from '$lib/server/guards';
import { consumeRateLimit } from '$lib/server/services/rate-limit';
import {
	submitWallNote,
	flagWallNote
} from '$lib/server/services/moderation';
import { claimStampForFan, saveIssueForFan } from '$lib/server/services/stamping';
import { submitNoteSchema, flagNoteSchema } from '$schemas/wall';
import { loadIssueReader } from '$lib/server/services/issue-reader';
import { claimStampSchema, saveIssueSchema } from '$schemas/scan';

/** The public reader: published and archived Issues by slug; a draft is 404 (B1-T33). */
export const load: ServerLoad = (event) => loadIssueReader(event, { kind: 'public', slug: event.params.slug });

/**
 * The Issue whose Wall an action writes to, from the URL slug alone. Unknown and
 * draft Issues are 404; archived Issues and closed Artists are read-only.
 */
async function resolveIssueWall(slug: string | undefined) {
	const issue = slug
		? await db.query.issues.findFirst({
				where: eq(schema.issues.slug, slug),
				with: { artist: true }
			})
		: undefined;
	if (!issue || !isPubliclyReadable(issue)) {
		return { ok: false as const, failure: fail(404, { error: 'Issue not found.' }) };
	}
	if (issue.artist.accountStatus === ArtistAccountStatus.Closed) {
		return { ok: false as const, failure: fail(403, { error: 'This artist has left Quire.' }) };
	}
	if (issue.status === 'archived') {
		return { ok: false as const, failure: fail(403, { error: 'This archived issue is read-only.' }) };
	}
	return { ok: true as const, issue };
}

export const actions: Actions = {
	googleAuth: async ({ request, params, cookies }) => {
		const formData = await request.formData();
		const targetHash = String(formData.get('targetHash') || '#page-wall');
		const callbackURL = `/i/${params.slug}${targetHash}`;

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

	submitNote: async (event) => {
		const { request, params, getClientAddress } = event;
		const fan = requireFan(event, 'Please sign in to leave a note on the Wall.');
		if (isDenied(fan)) return fan;

		// The Issue and its Artist come from the URL slug only. Any artistId or
		// issueId in the form is ignored (PRODUCTION_PLAN 3.2).
		const formData = await request.formData();
		const body = String(formData.get('body') || '');

		const parseResult = submitNoteSchema.safeParse({ body });
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const noteLimit = await consumeRateLimit('wallNoteIp', getClientAddress());
		if (!noteLimit.allowed) {
			return fail(429, { error: noteLimit.message });
		}

		const wall = await resolveIssueWall(params.slug);
		if (!wall.ok) return wall.failure;

		const noteResult = await submitWallNote({
			artistId: wall.issue.artistId,
			issueId: wall.issue.id,
			fanUserId: fan.user.id,
			body: parseResult.data.body
		});

		if (!noteResult.ok) {
			return fail(400, { error: noteResult.error.message });
		}

		return { success: true, noteId: noteResult.value.noteId, status: noteResult.value.status };
	},

	flagNote: async (event) => {
		const { request, params, getClientAddress } = event;
		const fan = requireFan(event, 'Sign in to flag a note.');
		if (isDenied(fan)) return fan;

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

		const wall = await resolveIssueWall(params.slug);
		if (!wall.ok) return wall.failure;

		// Only a note on this Issue's Wall can be flagged from this page.
		const flagResult = await flagWallNote(parseResult.data.noteId, fan.user.id, {
			artistId: wall.issue.artistId,
			issueId: wall.issue.id
		});
		if (!flagResult.ok) {
			const status = flagResult.error.code === 'NOTE_NOT_FOUND' ? 404 : 400;
			return fail(status, { error: flagResult.error.message });
		}

		return { success: true, ...flagResult.value };
	},

	claimStamp: async (event) => {
		const { request, cookies, params } = event;
		const fan = requireFan(event, 'Sign in with Google to claim your attendance stamp.');
		if (isDenied(fan)) return fan;

		const slug = params.slug!;
		const scanToken = cookies.get(`quire_scan_${slug}`);

		if (!scanToken) {
			return fail(403, {
				error: 'Physical QR scan attendance token not found. Please scan the sticker at the venue!'
			});
		}

		const formData = await request.formData();
		const issueId = String(formData.get('issueId') || '');

		const parseResult = claimStampSchema.safeParse({ issueId });
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const stampResult = await claimStampForFan(fan.user.id, issueId, scanToken);
		if (!stampResult.ok) {
			return fail(400, { error: stampResult.error.message });
		}

		return { success: true, stamped: true };
	},

	saveIssue: async (event) => {
		const { request } = event;
		const fan = requireFan(event, 'Sign in with Google to bookmark this issue.');
		if (isDenied(fan)) return fan;

		const formData = await request.formData();
		const issueId = String(formData.get('issueId') || '');

		const parseResult = saveIssueSchema.safeParse({ issueId });
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const saveResult = await saveIssueForFan(fan.user.id, issueId);
		if (!saveResult.ok) {
			return fail(400, { error: saveResult.error.message });
		}

		return { success: true, saved: true };
	}
};
