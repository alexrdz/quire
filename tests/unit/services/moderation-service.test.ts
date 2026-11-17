import { describe, it, expect } from 'vitest';
import {
	submitWallNote,
	flagWallNote,
	hideWallNote,
	restoreWallNote,
	replyToWallNote,
	deleteWallReply,
	deleteWallNote,
	blockFanFromWalls,
	unblockFanFromWalls
} from '$lib/server/services/moderation';
import { NoteStatus } from '$domain/wall';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { seedDatabase } from '$lib/server/seed';
import crypto from 'node:crypto';

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

	it('supports non-destructive hide/restore, deleteWallReply, and block/unblock fan workflows', async () => {
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

		// Create a note and reply
		const subRes = await submitWallNote({
			artistId: artist.id,
			fanUserId: fan.id,
			body: `Great set in Brooklyn ${crypto.randomBytes(3).toString('hex')}`
		});
		expect(subRes.ok).toBe(true);
		if (!subRes.ok) return;
		const noteId = subRes.value.noteId;

		const replyRes = await replyToWallNote(noteId, artist.id, 'First reply');
		expect(replyRes.ok).toBe(true);

		// Delete own reply, leaving note intact and allowing a new reply
		const delReplyRes = await deleteWallReply(noteId, artist.id);
		expect(delReplyRes.ok).toBe(true);
		const replyAfterDelete = await db.query.noteReplies.findFirst({
			where: eq(schema.noteReplies.noteId, noteId)
		});
		expect(replyAfterDelete).toBeUndefined();

		const reReplyRes = await replyToWallNote(noteId, artist.id, 'Updated reply');
		expect(reReplyRes.ok).toBe(true);

		// Non-destructive hide + restore
		const hideRes = await hideWallNote(noteId, artist.id);
		expect(hideRes.ok).toBe(true);
		const hiddenNote = await db.query.notes.findFirst({
			where: eq(schema.notes.id, noteId)
		});
		expect(hiddenNote?.status).toBe(NoteStatus.Hidden);

		const restoreRes = await restoreWallNote(noteId, artist.id);
		expect(restoreRes.ok).toBe(true);
		const restoredNote = await db.query.notes.findFirst({
			where: eq(schema.notes.id, noteId)
		});
		expect(restoredNote?.status).toBe(NoteStatus.Live);
		expect(restoredNote?.flagImmune).toBe(true);

		// Block fan -> hides notes and prevents new posts
		const blockRes = await blockFanFromWalls(artist.id, fan.id);
		expect(blockRes.ok).toBe(true);
		const afterBlockNote = await db.query.notes.findFirst({
			where: eq(schema.notes.id, noteId)
		});
		expect(afterBlockNote?.status).toBe(NoteStatus.Hidden);

		const blockedPostRes = await submitWallNote({
			artistId: artist.id,
			fanUserId: fan.id,
			body: 'Should be blocked'
		});
		expect(blockedPostRes.ok).toBe(false);

		// Unblock fan -> keeps existing hidden note hidden, allows new posts
		const unblockRes = await unblockFanFromWalls(artist.id, fan.id);
		expect(unblockRes.ok).toBe(true);
		const stillHiddenNote = await db.query.notes.findFirst({
			where: eq(schema.notes.id, noteId)
		});
		expect(stillHiddenNote?.status).toBe(NoteStatus.Hidden);

		const postAfterUnblock = await submitWallNote({
			artistId: artist.id,
			fanUserId: fan.id,
			body: 'Back on the wall!'
		});
		expect(postAfterUnblock.ok).toBe(true);

		// Cleanup created notes
		await deleteWallNote(noteId, artist.userId);
		if (postAfterUnblock.ok) {
			await deleteWallNote(postAfterUnblock.value.noteId, artist.userId);
		}
	});
});
