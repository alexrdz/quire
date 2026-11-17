import { error, fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { db, schema } from '$lib/server/db';
import { eq, and, desc, isNull, inArray } from 'drizzle-orm';
import { auth, createSessionForUser } from '$lib/server/auth';
import { seedDatabase } from '$lib/server/seed';
import { createTipCheckout } from '$lib/server/services/payments';
import { submitWallNote, flagWallNote } from '$lib/server/services/moderation';
import { initiateTipSchema } from '$schemas/tipping';
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
	const issues = artist.issues || [];
	type IssueType = (typeof issues)[number];
	const issuesByMonth = new Map<string, IssueType[]>();
	for (const issue of issues) {
		const [year, month] = issue.date.split('-');
		const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleString('default', {
			month: 'long',
			year: 'numeric'
		});
		if (!issuesByMonth.has(monthName)) {
			issuesByMonth.set(monthName, []);
		}
		issuesByMonth.get(monthName)!.push(issue);
	}

	const groupedIssues = Array.from(issuesByMonth.entries()).map(([month, list]) => ({
		month,
		issues: list
	}));

	return {
		artist,
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
		const hasGoogleKeys = Boolean(
			process.env.GOOGLE_CLIENT_ID &&
				process.env.GOOGLE_CLIENT_ID !== 'mock_google_client_id' &&
				process.env.GOOGLE_CLIENT_SECRET
		);

		if (hasGoogleKeys) {
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
		}

		await seedDatabase();
		const fanUser = await db.query.users.findFirst({
			where: eq(schema.users.email, 'maya@example.com')
		});
		if (fanUser) {
			await createSessionForUser(cookies, fanUser.id);
		}
		throw redirect(303, callbackURL);
	},

	tip: async ({ request, url }) => {
		const formData = await request.formData();
		const artistId = String(formData.get('artistId') || '');
		const amountGrossCents = Number(formData.get('amountGrossCents') || 0);
		const fanCoveredFees = formData.get('fanCoveredFees') === 'true';

		const parseResult = initiateTipSchema.safeParse({
			artistId,
			amountGrossCents,
			fanCoveredFees
		});

		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
		}

		const tipResult = await createTipCheckout({
			artistId: parseResult.data.artistId,
			issueId: null, // General tip
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
			return fail(401, { error: 'Please sign in to leave a note on the General Wall.' });
		}

		const formData = await request.formData();
		const artistId = String(formData.get('artistId') || '');
		const body = String(formData.get('body') || '');

		const parseResult = submitNoteSchema.safeParse({ body });
		if (!parseResult.success) {
			return fail(400, { error: parseResult.error.issues[0]?.message || 'Validation error' });
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
	}
};
