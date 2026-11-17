import crypto from 'node:crypto';
import { redirect, fail, type Actions, type ServerLoad } from '@sveltejs/kit';
import { db, schema } from '$lib/server/db';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import {
	replyToWallNote,
	restoreWallNote,
	deleteWallNote,
	blockFanFromWalls
} from '$lib/server/services/moderation';
import { generateArtistQrSvg } from '$lib/server/services/qr';
import { replyNoteSchema } from '$schemas/wall';

const DEFAULT_SIGNUP_BIO = 'Live digital zines and tour archive on Quire.';

export const load: ServerLoad = async ({ request, url }) => {
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (!session?.user) {
		throw redirect(303, '/login?redirect=/dashboard');
	}

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.userId, session.user.id),
		with: {
			issues: {
				orderBy: [desc(schema.issues.date)],
				with: {
					tips: true,
					collections: true,
					notes: true
				}
			},
			templatePages: {
				columns: { id: true }
			}
		}
	});

	if (!artist) {
		throw redirect(303, '/login');
	}

	// Calculate stats for latest gig recap
	const latestIssue = artist.issues[0] || null;
	let latestRecap = null;

	if (latestIssue) {
		const tips = latestIssue.tips || [];
		const collections = latestIssue.collections || [];
		const issueNotes = latestIssue.notes || [];

		const totalGrossCents = tips.reduce((acc, t) => acc + t.amountGross, 0);
		const totalFeesCents = tips.reduce((acc, t) => acc + t.feeStripe + t.feePlatform, 0);
		const totalNetCents = tips.reduce((acc, t) => acc + t.amountNet, 0);

		const stampedCount = collections.filter((c) => c.kind === 'stamped').length;
		const savedCount = collections.filter((c) => c.kind === 'saved').length;

		latestRecap = {
			issue: latestIssue,
			totalGrossCents,
			totalFeesCents,
			totalNetCents,
			tipCount: tips.length,
			stampedCount,
			savedCount,
			noteCount: issueNotes.length
		};
	}

	// Calculate General (Back Page) row (SPEC.md §6.5)
	const generalTips = await db.query.tips.findMany({
		where: and(eq(schema.tips.artistId, artist.id), isNull(schema.tips.issueId))
	});
	const generalNotes = await db.query.notes.findMany({
		where: and(eq(schema.notes.artistId, artist.id), isNull(schema.notes.issueId))
	});

	const generalRow = {
		grossCents: generalTips.reduce((acc, t) => acc + t.amountGross, 0),
		feesCents: generalTips.reduce((acc, t) => acc + t.feeStripe + t.feePlatform, 0),
		netCents: generalTips.reduce((acc, t) => acc + t.amountNet, 0),
		tipCount: generalTips.length,
		noteCount: generalNotes.length
	};

	// Fetch notes across all artist walls for moderation & replies (flagged/pending prioritized)
	const allNotes = await db.query.notes.findMany({
		where: eq(schema.notes.artistId, artist.id),
		orderBy: [desc(schema.notes.flagCount), desc(schema.notes.createdAt)],
		with: {
			author: {
				columns: { id: true, name: true, email: true }
			},
			issue: {
				columns: { id: true, city: true, venue: true, slug: true }
			},
			replies: true
		}
	});

	const requestUrl = url ?? new URL(request.url);
	const origin = requestUrl.origin;
	const artistBackPageUrl = `${origin}/a/${artist.slug}`;
	const artistQrSvg = await generateArtistQrSvg(origin, artist.slug);
	const onboarding = requestUrl.searchParams.get('onboarding') === '1';

	const normalizedAccent = (artist.accentColor || '#05D9E8').trim().toUpperCase();
	const normalizedLinks = (artist.linksJson || '[]').replace(/\s+/g, '');
	const normalizedBio = (artist.bio || '').trim();
	const hasCustomizedTemplate = Boolean(
		(artist.coverArtUrl && artist.coverArtUrl.trim().length > 0) ||
			normalizedAccent !== '#05D9E8' ||
			(normalizedLinks !== '[]' && normalizedLinks !== '') ||
			(artist.templatePages && artist.templatePages.length > 1) ||
			(normalizedBio.length > 0 && normalizedBio !== DEFAULT_SIGNUP_BIO) ||
			artist.typePairing !== 'sans-serif' ||
			(artist.tipPresetsJson && artist.tipPresetsJson.replace(/\s+/g, '') !== '[3,5,10]')
	);

	return {
		artist,
		latestRecap,
		issues: artist.issues,
		generalRow,
		pendingNotes: allNotes,
		artistQrSvg,
		artistBackPageUrl,
		hasCustomizedTemplate,
		onboarding
	};
};

export const actions: Actions = {
	createDraft: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist) return fail(403, { error: 'Not an artist' });

		const today = new Date().toISOString().slice(0, 10);
		const shortId = crypto.randomBytes(3).toString('hex');
		let slug = `${artist.slug}-draft-${shortId}`;

		const existingSlug = await db.query.issues.findFirst({
			where: eq(schema.issues.slug, slug)
		});
		if (existingSlug) {
			slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
		}

		const issueId = crypto.randomUUID();
		const secretKey = crypto.randomBytes(16).toString('hex');
		const now = new Date();

		await db.insert(schema.issues).values({
			id: issueId,
			artistId: artist.id,
			slug,
			city: 'New City',
			venue: 'Venue TBA',
			date: today,
			timezone: 'America/New_York',
			coverNote: '',
			secretKey,
			status: 'draft',
			approveFirst: false,
			createdAt: now,
			updatedAt: now
		});

		throw redirect(303, `/dashboard/bookbinder/${issueId}`);
	},

	reply: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist) return fail(403, { error: 'Not an artist' });

		const formData = await request.formData();
		const noteId = String(formData.get('noteId') || '');
		const body = String(formData.get('body') || '');

		const parseResult = replyNoteSchema.safeParse({ noteId, body });
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const res = await replyToWallNote(noteId, artist.id, parseResult.data.body);
		if (!res.ok) return fail(400, { error: res.error.message });

		return { success: true };
	},

	restore: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist) return fail(403, { error: 'Not an artist' });

		const formData = await request.formData();
		const noteId = String(formData.get('noteId') || '');

		const res = await restoreWallNote(noteId, artist.id);
		if (!res.ok) return fail(400, { error: res.error.message });

		return { success: true };
	},

	delete: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const noteId = String(formData.get('noteId') || '');

		const res = await deleteWallNote(noteId, session.user.id);
		if (!res.ok) return fail(400, { error: res.error.message });

		return { success: true };
	},

	blockFan: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist) return fail(403, { error: 'Not an artist' });

		const formData = await request.formData();
		const fanUserId = String(formData.get('fanUserId') || '');
		if (!fanUserId) return fail(400, { error: 'Fan ID required' });

		const res = await blockFanFromWalls(artist.id, fanUserId);
		if (!res.ok) return fail(400, { error: res.error.message });

		return { success: true };
	}
};
