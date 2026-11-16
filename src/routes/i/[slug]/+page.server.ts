import { error, fail, type Actions, type ServerLoad } from '@sveltejs/kit';
import { db, schema } from '$lib/server/db';
import { eq, and, asc, desc } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import { createTipCheckout } from '$lib/server/services/payments';
import {
	submitWallNote,
	flagWallNote,
	deleteWallNote
} from '$lib/server/services/moderation';
import {
	claimStampForFan,
	saveIssueForFan,
	verifyScanToken
} from '$lib/server/services/stamping';
import { initiateTipSchema } from '$schemas/tipping';
import { submitNoteSchema, flagNoteSchema } from '$schemas/wall';
import { claimStampSchema, saveIssueSchema } from '$schemas/scan';

export const load: ServerLoad = async ({ params, cookies, request }) => {
	const slug = params.slug;
	if (!slug) throw error(404, 'Issue slug required');

	const issue = await db.query.issues.findFirst({
		where: eq(schema.issues.slug, slug),
		with: {
			artist: true,
			issuePages: {
				orderBy: [asc(schema.issuePages.position)]
			}
		}
	});

	if (!issue) {
		throw error(404, 'Issue not found');
	}

	// Fetch template pages for the artist
	const templatePages = await db.query.templatePages.findMany({
		where: eq(schema.templatePages.artistId, issue.artistId),
		orderBy: [asc(schema.templatePages.position)]
	});

	// Fetch live wall notes with replies
	const notes = await db.query.notes.findMany({
		where: and(eq(schema.notes.issueId, issue.id), eq(schema.notes.status, 'live')),
		orderBy: [desc(schema.notes.createdAt)],
		with: {
			author: {
				columns: { id: true, name: true, image: true }
			},
			replies: true
		}
	});

	// Check authentication session
	const session = await auth.api.getSession({
		headers: request.headers
	});

	// Check attendance scan token cookie
	const scanToken = cookies.get(`quire_scan_${slug}`);
	let isScanVerified = false;
	if (scanToken) {
		const tokenCheck = verifyScanToken(scanToken);
		if (tokenCheck.ok && tokenCheck.value.issueSlug === slug) {
			isScanVerified = true;
		}
	}

	// Check collection state if logged in
	let collectionStatus: 'none' | 'saved' | 'stamped' = 'none';
	if (session?.user) {
		const entry = await db.query.collections.findFirst({
			where: and(
				eq(schema.collections.fanUserId, session.user.id),
				eq(schema.collections.issueId, issue.id)
			)
		});
		if (entry) {
			collectionStatus = entry.kind as 'saved' | 'stamped';
		}
	}

	// Parse tip presets
	let tipPresets = [3, 5, 10, 20];
	try {
		tipPresets = JSON.parse(issue.artist.tipPresetsJson || '[3, 5, 10, 20]');
	} catch {
		// fallback
	}

	return {
		issue,
		artist: issue.artist,
		issuePages: issue.issuePages,
		templatePages,
		notes,
		tipPresets,
		session,
		isScanVerified,
		collectionStatus
	};
};

export const actions: Actions = {
	tip: async ({ request, url }) => {
		const formData = await request.formData();
		const artistId = String(formData.get('artistId') || '');
		const issueId = formData.get('issueId') ? String(formData.get('issueId')) : null;
		const amountGrossCents = Number(formData.get('amountGrossCents') || 0);
		const fanCoveredFees = formData.get('fanCoveredFees') === 'true';

		const parseResult = initiateTipSchema.safeParse({
			artistId,
			issueId,
			amountGrossCents,
			fanCoveredFees
		});

		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const tipResult = await createTipCheckout({
			artistId: parseResult.data.artistId,
			issueId: parseResult.data.issueId,
			amountGrossCents: parseResult.data.amountGrossCents,
			fanCoveredFees: parseResult.data.fanCoveredFees,
			returnUrl: url.toString()
		});

		if (!tipResult.ok) {
			return fail(400, { error: tipResult.error.message });
		}

		return { success: true, tipResult: tipResult.value };
	},

	submitNote: async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});

		if (!session?.user) {
			return fail(401, { error: 'Please sign in to leave a note on the Wall.' });
		}

		const formData = await request.formData();
		const artistId = String(formData.get('artistId') || '');
		const issueId = formData.get('issueId') ? String(formData.get('issueId')) : null;
		const body = String(formData.get('body') || '');

		const parseResult = submitNoteSchema.safeParse({ issueId, body });
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const noteResult = await submitWallNote({
			artistId,
			issueId,
			fanUserId: session.user.id,
			body: parseResult.data.body
		});

		if (!noteResult.ok) {
			return fail(400, { error: noteResult.error.message });
		}

		return { success: true, noteId: noteResult.value.noteId, status: noteResult.value.status };
	},

	flagNote: async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});

		if (!session?.user) {
			return fail(401, { error: 'Sign in to flag a note.' });
		}

		const formData = await request.formData();
		const noteId = String(formData.get('noteId') || '');

		const parseResult = flagNoteSchema.safeParse({ noteId });
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const flagResult = await flagWallNote(noteId, session.user.id);
		if (!flagResult.ok) {
			return fail(400, { error: flagResult.error.message });
		}

		return { success: true, ...flagResult.value };
	},

	claimStamp: async ({ request, cookies, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});

		if (!session?.user) {
			return fail(401, { error: 'Sign in with Google to claim your attendance stamp.' });
		}

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

		const stampResult = await claimStampForFan(session.user.id, issueId, scanToken);
		if (!stampResult.ok) {
			return fail(400, { error: stampResult.error.message });
		}

		return { success: true, stamped: true };
	},

	saveIssue: async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});

		if (!session?.user) {
			return fail(401, { error: 'Sign in with Google to bookmark this issue.' });
		}

		const formData = await request.formData();
		const issueId = String(formData.get('issueId') || '');

		const parseResult = saveIssueSchema.safeParse({ issueId });
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const saveResult = await saveIssueForFan(session.user.id, issueId);
		if (!saveResult.ok) {
			return fail(400, { error: saveResult.error.message });
		}

		return { success: true, saved: true };
	}
};
