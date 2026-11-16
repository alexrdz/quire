import { redirect, fail, type Actions, type ServerLoad } from '@sveltejs/kit';
import { db, schema } from '$lib/server/db';
import { eq, and, desc } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import { replyToWallNote, restoreWallNote, deleteWallNote } from '$lib/server/services/moderation';
import { replyNoteSchema } from '$schemas/wall';

export const load: ServerLoad = async ({ request }) => {
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
					collections: true
				}
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

		const grossTipsCents = tips.reduce((sum: number, t: { amountGross: number }) => sum + t.amountGross, 0);
		const netTipsCents = tips.reduce((sum: number, t: { amountNet: number }) => sum + t.amountNet, 0);
		const stampsCount = collections.filter((c: { kind: string }) => c.kind === 'stamped').length;
		const savesCount = collections.filter((c: { kind: string }) => c.kind === 'saved').length;

		latestRecap = {
			issue: latestIssue,
			grossTipsCents,
			netTipsCents,
			tipperCount: tips.length,
			stampsCount,
			savesCount
		};
	}

	// Fetch notes awaiting moderation (either status='pending' or flagCount > 0)
	const pendingNotes = await db.query.notes.findMany({
		where: and(eq(schema.notes.artistId, artist.id)),
		orderBy: [desc(schema.notes.createdAt)],
		with: {
			author: {
				columns: { id: true, name: true, image: true }
			},
			issue: {
				columns: { id: true, city: true, venue: true, date: true }
			},
			replies: true
		}
	});

	return {
		artist,
		latestRecap,
		issues: artist.issues,
		pendingNotes
	};
};

export const actions: Actions = {
	reply: async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist) return fail(401, { error: 'Artist profile not found' });

		const formData = await request.formData();
		const noteId = String(formData.get('noteId') || '');
		const body = String(formData.get('body') || '');

		const parse = replyNoteSchema.safeParse({ noteId, body });
		if (!parse.success) {
			return fail(400, { error: parse.error.issues[0]?.message || 'Validation error' });
		}

		const res = await replyToWallNote(noteId, artist.id, parse.data.body);
		if (!res.ok) {
			return fail(400, { error: res.error.message });
		}

		return { success: true };
	},

	restoreNote: async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist) return fail(401, { error: 'Artist profile not found' });

		const formData = await request.formData();
		const noteId = String(formData.get('noteId') || '');

		const res = await restoreWallNote(noteId, artist.id);
		if (!res.ok) {
			return fail(400, { error: res.error.message });
		}

		return { success: true };
	},

	deleteNote: async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const noteId = String(formData.get('noteId') || '');

		const res = await deleteWallNote(noteId, session.user.id);
		if (!res.ok) {
			return fail(400, { error: res.error.message });
		}

		return { success: true };
	}
};
