import crypto from 'node:crypto';
import { db, schema } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import {
	screenNoteText,
	flagNote,
	hideNote,
	restoreNote,
	NoteStatus,
	type NoteEntity
} from '$domain/wall';
import {
	createArtistId,
	createFanUserId,
	createIssueId,
	createNoteId,
	type Result,
	type DomainError,
	ok,
	err
} from '$domain/types';

export interface SubmitNoteParams {
	artistId: string;
	issueId?: string | null;
	fanUserId: string;
	body: string;
}

/**
 * Submits a new Wall note.
 * Screens text against anti-spam/URL/email/phone rules,
 * checks if fan is blocked, and checks approveFirst setting on the Issue or Artist General Wall.
 */
export async function submitWallNote(
	params: SubmitNoteParams
): Promise<Result<{ noteId: string; status: typeof NoteStatus.Live | typeof NoteStatus.Pending }, DomainError>> {
	const existingBlock = await db.query.blocks.findFirst({
		where: and(
			eq(schema.blocks.artistId, params.artistId),
			eq(schema.blocks.fanUserId, params.fanUserId)
		)
	});

	if (existingBlock) {
		return err({
			code: 'FAN_BLOCKED',
			message: 'You have been blocked from posting on this artist’s Walls.'
		});
	}

	const screen = screenNoteText(params.body);
	if (!screen.valid) {
		return err({
			code: 'SCREENING_FAILED',
			message: `Note violates community standards: ${screen.violation}`
		});
	}

	// Determine if approve-first applies
	let approveFirst = false;
	if (params.issueId) {
		const issue = await db.query.issues.findFirst({
			where: eq(schema.issues.id, params.issueId)
		});
		if (issue) {
			approveFirst = issue.approveFirst;
		}
	} else {
		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.id, params.artistId)
		});
		if (artist) {
			approveFirst = artist.generalWallApproveFirst;
		}
	}

	const noteId = crypto.randomUUID();
	const status = approveFirst ? NoteStatus.Pending : NoteStatus.Live;

	await db.insert(schema.notes).values({
		id: noteId,
		artistId: params.artistId,
		issueId: params.issueId ?? null,
		fanUserId: params.fanUserId,
		body: params.body,
		status,
		flagCount: 0,
		flagImmune: false,
		createdAt: new Date()
	});

	return ok({ noteId, status });
}

function toDomainNote(note: typeof schema.notes.$inferSelect): NoteEntity {
	return {
		id: createNoteId(note.id),
		artistId: createArtistId(note.artistId),
		issueId: note.issueId ? createIssueId(note.issueId) : null,
		fanUserId: createFanUserId(note.fanUserId),
		body: note.body,
		status: note.status,
		flagCount: note.flagCount,
		flagImmune: note.flagImmune,
		createdAt: note.createdAt
	};
}

/**
 * Flags a note. Enforces 1 flag per fan and auto-hides at 3 flags (unless flagImmune).
 */
export async function flagWallNote(
	noteId: string,
	fanUserId: string
): Promise<Result<{ flagCount: number; status: NoteStatus }, DomainError>> {
	const existingFlag = await db.query.noteFlags.findFirst({
		where: and(
			eq(schema.noteFlags.noteId, noteId),
			eq(schema.noteFlags.fanUserId, fanUserId)
		)
	});

	if (existingFlag) {
		return err({ code: 'ALREADY_FLAGGED', message: 'You have already flagged this note.' });
	}

	const note = await db.query.notes.findFirst({
		where: eq(schema.notes.id, noteId)
	});

	if (!note) {
		return err({ code: 'NOTE_NOT_FOUND', message: 'Note does not exist.' });
	}

	await db.insert(schema.noteFlags).values({
		id: crypto.randomUUID(),
		noteId,
		fanUserId,
		createdAt: new Date()
	});

	const flagResult = flagNote(toDomainNote(note));
	if (!flagResult.ok) {
		return err(flagResult.error);
	}

	const updated = flagResult.value.note;

	await db
		.update(schema.notes)
		.set({
			flagCount: updated.flagCount,
			status: updated.status
		})
		.where(eq(schema.notes.id, noteId));

	return ok({
		flagCount: updated.flagCount,
		status: updated.status
	});
}

/**
 * Non-destructively hides a note from public Walls while preserving it for review/restoration.
 */
export async function hideWallNote(
	noteId: string,
	artistId: string
): Promise<Result<void, DomainError>> {
	const note = await db.query.notes.findFirst({
		where: and(eq(schema.notes.id, noteId), eq(schema.notes.artistId, artistId))
	});

	if (!note) {
		return err({ code: 'NOTE_NOT_FOUND', message: 'Note not found or unauthorized.' });
	}

	const hidden = hideNote(toDomainNote(note));
	if (!hidden.ok) return err(hidden.error);

	await db
		.update(schema.notes)
		.set({
			status: hidden.value.status
		})
		.where(eq(schema.notes.id, noteId));

	return ok(undefined);
}

/**
 * Restores a hidden/pending note by the Artist.
 * Decision 22: Restored notes become flag-immune.
 */
export async function restoreWallNote(
	noteId: string,
	artistId: string
): Promise<Result<void, DomainError>> {
	const note = await db.query.notes.findFirst({
		where: and(eq(schema.notes.id, noteId), eq(schema.notes.artistId, artistId))
	});

	if (!note) {
		return err({ code: 'NOTE_NOT_FOUND', message: 'Note not found or unauthorized.' });
	}

	const restored = restoreNote(toDomainNote(note));
	if (!restored.ok) return err(restored.error);

	await db
		.update(schema.notes)
		.set({
			status: restored.value.status,
			flagImmune: restored.value.flagImmune
		})
		.where(eq(schema.notes.id, noteId));

	return ok(undefined);
}

/**
 * Adds an Artist reply to a note.
 * Exactly 1 reply per note, only by the Artist.
 */
export async function replyToWallNote(
	noteId: string,
	artistId: string,
	body: string
): Promise<Result<{ replyId: string }, DomainError>> {
	const trimmed = body.trim();
	if (trimmed.length === 0) {
		return err({ code: 'EMPTY_REPLY', message: 'Reply text cannot be empty.' });
	}

	const note = await db.query.notes.findFirst({
		where: and(eq(schema.notes.id, noteId), eq(schema.notes.artistId, artistId))
	});

	if (!note) {
		return err({ code: 'NOTE_NOT_FOUND', message: 'Note not found or unauthorized.' });
	}

	const existingReply = await db.query.noteReplies.findFirst({
		where: eq(schema.noteReplies.noteId, noteId)
	});

	if (existingReply) {
		return err({
			code: 'REPLY_EXISTS',
			message: 'A reply has already been posted to this note. Only one reply is permitted.'
		});
	}

	const replyId = crypto.randomUUID();
	await db.insert(schema.noteReplies).values({
		id: replyId,
		noteId,
		artistId,
		body: trimmed,
		createdAt: new Date()
	});

	return ok({ replyId });
}

/**
 * Deletes an Artist's own reply to a note, returning the note to an unanswered state (EDGE-CASES.md).
 */
export async function deleteWallReply(
	noteId: string,
	artistId: string
): Promise<Result<void, DomainError>> {
	const existingReply = await db.query.noteReplies.findFirst({
		where: and(
			eq(schema.noteReplies.noteId, noteId),
			eq(schema.noteReplies.artistId, artistId)
		)
	});

	if (!existingReply) {
		return err({ code: 'REPLY_NOT_FOUND', message: 'Reply not found or unauthorized.' });
	}

	await db
		.delete(schema.noteReplies)
		.where(
			and(
				eq(schema.noteReplies.id, existingReply.id),
				eq(schema.noteReplies.artistId, artistId)
			)
		);

	return ok(undefined);
}

/**
 * Hides or deletes a note by its fan author or the artist.
 */
export async function deleteWallNote(
	noteId: string,
	requesterUserId: string
): Promise<Result<void, DomainError>> {
	const note = await db.query.notes.findFirst({
		where: eq(schema.notes.id, noteId)
	});

	if (!note) {
		return err({ code: 'NOTE_NOT_FOUND', message: 'Note not found.' });
	}

	const artist = await db.query.artists.findFirst({
		where: and(
			eq(schema.artists.id, note.artistId),
			eq(schema.artists.userId, requesterUserId)
		)
	});

	const isAuthor = note.fanUserId === requesterUserId;
	const isArtistOwner = Boolean(artist);

	if (!isAuthor && !isArtistOwner) {
		return err({ code: 'UNAUTHORIZED', message: 'Not authorized to delete this note.' });
	}

	await db.delete(schema.noteReplies).where(eq(schema.noteReplies.noteId, noteId));
	await db.delete(schema.noteFlags).where(eq(schema.noteFlags.noteId, noteId));
	await db.delete(schema.notes).where(eq(schema.notes.id, noteId));

	return ok(undefined);
}

/**
 * Blocks a fan from all of an Artist's Walls and hides their notes (SPEC.md §5.5).
 */
export async function blockFanFromWalls(
	artistId: string,
	fanUserId: string
): Promise<Result<void, DomainError>> {
	const existing = await db.query.blocks.findFirst({
		where: and(eq(schema.blocks.artistId, artistId), eq(schema.blocks.fanUserId, fanUserId))
	});

	if (!existing) {
		await db.insert(schema.blocks).values({
			id: crypto.randomUUID(),
			artistId,
			fanUserId,
			createdAt: new Date()
		});
	}

	await db
		.update(schema.notes)
		.set({ status: NoteStatus.Hidden })
		.where(and(eq(schema.notes.artistId, artistId), eq(schema.notes.fanUserId, fanUserId)));

	return ok(undefined);
}

/**
 * Unblocks a previously blocked fan so they can post again.
 * Previously hidden notes remain hidden unless individually restored by the Artist.
 */
export async function unblockFanFromWalls(
	artistId: string,
	fanUserId: string
): Promise<Result<void, DomainError>> {
	if (!artistId || !fanUserId) {
		return err({ code: 'INVALID_INPUT', message: 'Artist ID and Fan ID are required.' });
	}

	await db
		.delete(schema.blocks)
		.where(and(eq(schema.blocks.artistId, artistId), eq(schema.blocks.fanUserId, fanUserId)));

	return ok(undefined);
}
