import crypto from 'node:crypto';
import { redirect, fail, type Actions, type ServerLoad } from '@sveltejs/kit';
import { db, schema } from '$lib/server/db';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import {
	blockFanFromWalls,
	deleteWallNote,
	deleteWallReply,
	hideWallNote,
	replyToWallNote,
	restoreWallNote,
	unblockFanFromWalls
} from '$lib/server/services/moderation';
import { generateArtistQrSvg } from '$lib/server/services/qr';
import {
	blockFanSchema,
	noteIdSchema,
	replyNoteSchema,
	unblockFanSchema
} from '$schemas/wall';
import { countTipTaps } from '$lib/server/services/tip-taps';
import { ArtistAccountStatus } from '$domain/account';
import { resendEmailConfirmation } from '$lib/server/email/verification';

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

	if (artist.accountStatus === ArtistAccountStatus.Closed) {
		throw redirect(303, '/login?closed=1');
	}

	// Tip Taps (ADR 0008): counts of tip-button taps only. Quire cannot see Venmo
	// payments, so nothing here is a dollar amount.
	const tapCounts = await countTipTaps(artist.id);

	const latestIssue = artist.issues[0] || null;
	let latestRecap = null;

	if (latestIssue) {
		const collections = latestIssue.collections || [];
		const issueNotes = latestIssue.notes || [];

		latestRecap = {
			issue: latestIssue,
			tipTaps: tapCounts.byIssue[latestIssue.id] ?? 0,
			stampedCount: collections.filter((c) => c.kind === 'stamped').length,
			savedCount: collections.filter((c) => c.kind === 'saved').length,
			noteCount: issueNotes.length
		};
	}

	// General (Back Page) row (SPEC.md §6.5)
	const generalNotes = await db.query.notes.findMany({
		where: and(eq(schema.notes.artistId, artist.id), isNull(schema.notes.issueId))
	});
	const generalRow = {
		tipTaps: tapCounts.general,
		noteCount: generalNotes.length
	};

	const issuesWithTipTaps = artist.issues.map((issue) => ({
		...issue,
		tipTaps: tapCounts.byIssue[issue.id] ?? 0
	}));

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

	const blocks = await db.query.blocks.findMany({
		where: eq(schema.blocks.artistId, artist.id),
		orderBy: [desc(schema.blocks.createdAt)],
		with: {
			fanUser: {
				columns: { id: true, name: true, email: true }
			}
		}
	});

	const blockedFans = blocks.map((b) => ({
		id: b.id,
		fanUserId: b.fanUserId,
		name: b.fanUser?.name || 'Fan',
		email: b.fanUser?.email || '',
		createdAt: b.createdAt
	}));

	return {
		artist,
		emailVerified: Boolean(session.user.emailVerified),
		userEmail: session.user.email,
		latestRecap,
		issues: issuesWithTipTaps,
		generalRow,
		totalTipTaps: tapCounts.total,
		hasVenmo: Boolean(artist.venmoUsername),
		pendingNotes: allNotes,
		blockedFans,
		artistQrSvg,
		artistBackPageUrl,
		hasCustomizedTemplate,
		onboarding
	};
};

async function requireArtistContext(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return { errorResponse: fail(401, { error: 'Unauthorized' }) } as const;
	}

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.userId, session.user.id)
	});
	if (!artist || artist.accountStatus === ArtistAccountStatus.Closed) {
		return { errorResponse: fail(403, { error: 'Active artist account required' }) } as const;
	}

	return { session, artist } as const;
}

export const actions: Actions = {
	/** Resend from the confirm-your-email bar on any dashboard page (PRODUCTION_PLAN 2.4). */
	resendVerification: async ({ request }) => {
		const ctx = await requireArtistContext(request);
		if ('errorResponse' in ctx) {
			return fail(403, { accountError: 'Sign in as an artist to confirm your email.' });
		}

		const result = await resendEmailConfirmation({
			user: ctx.session.user,
			headers: request.headers,
			callbackURL: '/dashboard?verified=1',
			send: (args) => auth.api.sendVerificationEmail(args)
		});
		if (!result.ok) {
			return fail(result.status, { accountError: result.message });
		}
		return result.alreadyConfirmed
			? { alreadyVerified: true }
			: { verificationEmailSent: true, sentToEmail: ctx.session.user.email };
	},

	createDraft: async ({ request }) => {
		const ctx = await requireArtistContext(request);
		if ('errorResponse' in ctx) return ctx.errorResponse;
		const { artist } = ctx;

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
		const ctx = await requireArtistContext(request);
		if ('errorResponse' in ctx) return ctx.errorResponse;

		const formData = await request.formData();
		const parseResult = replyNoteSchema.safeParse({
			noteId: String(formData.get('noteId') || ''),
			body: String(formData.get('body') || '')
		});
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const res = await replyToWallNote(
			parseResult.data.noteId,
			ctx.artist.id,
			parseResult.data.body
		);
		if (!res.ok) return fail(400, { error: res.error.message });

		return { success: true };
	},

	deleteReply: async ({ request }) => {
		const ctx = await requireArtistContext(request);
		if ('errorResponse' in ctx) return ctx.errorResponse;

		const formData = await request.formData();
		const parseResult = noteIdSchema.safeParse({
			noteId: String(formData.get('noteId') || '')
		});
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const res = await deleteWallReply(parseResult.data.noteId, ctx.artist.id);
		if (!res.ok) return fail(400, { error: res.error.message });

		return { success: true };
	},

	hide: async ({ request }) => {
		const ctx = await requireArtistContext(request);
		if ('errorResponse' in ctx) return ctx.errorResponse;

		const formData = await request.formData();
		const parseResult = noteIdSchema.safeParse({
			noteId: String(formData.get('noteId') || '')
		});
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const res = await hideWallNote(parseResult.data.noteId, ctx.artist.id);
		if (!res.ok) return fail(400, { error: res.error.message });

		return { success: true };
	},

	restore: async ({ request }) => {
		const ctx = await requireArtistContext(request);
		if ('errorResponse' in ctx) return ctx.errorResponse;

		const formData = await request.formData();
		const parseResult = noteIdSchema.safeParse({
			noteId: String(formData.get('noteId') || '')
		});
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const res = await restoreWallNote(parseResult.data.noteId, ctx.artist.id);
		if (!res.ok) return fail(400, { error: res.error.message });

		return { success: true };
	},

	delete: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const parseResult = noteIdSchema.safeParse({
			noteId: String(formData.get('noteId') || '')
		});
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const res = await deleteWallNote(parseResult.data.noteId, session.user.id);
		if (!res.ok) return fail(400, { error: res.error.message });

		return { success: true };
	},

	blockFan: async ({ request }) => {
		const ctx = await requireArtistContext(request);
		if ('errorResponse' in ctx) return ctx.errorResponse;

		const formData = await request.formData();
		const parseResult = blockFanSchema.safeParse({
			fanUserId: String(formData.get('fanUserId') || '')
		});
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Fan ID required' });
		}

		const res = await blockFanFromWalls(ctx.artist.id, parseResult.data.fanUserId);
		if (!res.ok) return fail(400, { error: res.error.message });

		return { success: true };
	},

	unblockFan: async ({ request }) => {
		const ctx = await requireArtistContext(request);
		if ('errorResponse' in ctx) return ctx.errorResponse;

		const formData = await request.formData();
		const parseResult = unblockFanSchema.safeParse({
			fanUserId: String(formData.get('fanUserId') || '')
		});
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Fan ID required' });
		}

		const res = await unblockFanFromWalls(ctx.artist.id, parseResult.data.fanUserId);
		if (!res.ok) return fail(400, { error: res.error.message });

		return { success: true };
	}
};
