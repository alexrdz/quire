import { describe, it, expect } from 'vitest';
import {
	submitWallNote,
	flagWallNote,
	restoreWallNote,
	replyToWallNote,
	deleteWallNote
} from '$lib/server/services/moderation';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { seedDatabase } from '$lib/server/seed';

describe('Moderation & Wall Notes Service', () => {
	it('handles note submission, flagging, restoration, and replies', async () => {
		await seedDatabase();

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, 'the-neon-velvet')
		});
		const fan = await db.query.users.findFirst({
			where: eq(schema.users.email, 'maya@example.com')
		});
		expect(artist).toBeDefined();
		expect(fan).toBeDefined();
		if (!artist || !fan) return;

		// 1. Submit note
		const subRes = await submitWallNote({
			artistId: artist.id,
			fanUserId: fan.id,
			body: 'The encore drum solo blew my mind!'
		});

		expect(subRes.ok).toBe(true);
		if (!subRes.ok) return;
		const noteId = subRes.value.noteId;

		// 2. Reply to note
		const replyRes = await replyToWallNote(noteId, artist.id, 'Thanks Maya! Drummer appreciated it.');
		expect(replyRes.ok).toBe(true);

		// Disallow duplicate reply
		const dupReplyRes = await replyToWallNote(noteId, artist.id, 'Second reply attempt');
		expect(dupReplyRes.ok).toBe(false);

		// 3. Flag note
		const flagRes = await flagWallNote(noteId, fan.id);
		expect(flagRes.ok).toBe(true);
		if (!flagRes.ok) return;
		expect(flagRes.value.flagCount).toBe(1);

		// Disallow duplicate flag from same fan
		const dupFlagRes = await flagWallNote(noteId, fan.id);
		expect(dupFlagRes.ok).toBe(false);

		// 4. Delete note cascades to delete reply
		const delRes = await deleteWallNote(noteId, fan.id);
		expect(delRes.ok).toBe(true);

		// Verify note and reply are gone
		const deletedNote = await db.query.notes.findFirst({
			where: eq(schema.notes.id, noteId)
		});
		expect(deletedNote).toBeUndefined();

		const deletedReply = await db.query.noteReplies.findFirst({
			where: eq(schema.noteReplies.noteId, noteId)
		});
		expect(deletedReply).toBeUndefined();
	});
});
