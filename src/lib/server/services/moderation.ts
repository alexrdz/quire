import crypto from 'node:crypto';
import { db, schema } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import {
	screenNoteText,
	flagNote,
	restoreNote,
	type NoteEntity,
	FLAG_AUTO_HIDE_THRESHOLD
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
 * checks approveFirst setting on the Issue or Artist General Wall.
 */
export async function submitWallNote(
	params: SubmitNoteParams
): Promise<Result<{ noteId: string; status: 'live' | 'pending' }, DomainError>> {
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
	const status = approveFirst ? 'pending' : 'live';

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

/**
 * Flags a note. Enforces 1 flag per fan and auto-hides at 3 flags (unless flagImmune).
 */
export async function flagWallNote(
	noteId: string,
	fanUserId: string
): Promise<Result<{ flagCount: number; status: 'live' | 'pending' | 'hidden' }, DomainError>> {
	// Check if already flagged by this fan
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

	// Insert flag
	await db.insert(schema.noteFlags).values({
		id: crypto.randomUUID(),
		noteId,
		fanUserId,
		createdAt: new Date()
	});

	const domainNote: NoteEntity = {
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

	const flagResult = flagNote(domainNote);
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
 * Restores a hidden note by the Artist.
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

	const domainNote: NoteEntity = {
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

	const restored = restoreNote(domainNote);
	if (!restored.ok) return err(restored.error);

	await db
		.update(schema.notes)
		.set({
			status: 'live',
			flagImmune: true
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
 * Deletes a note by its fan author or the artist.
 * Cascades to delete the reply.
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

	// Check if requester is either the author or the artist owner
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

	// Delete replies first
	await db.delete(schema.noteReplies).where(eq(schema.noteReplies.noteId, noteId));
	// Delete flags
	await db.delete(schema.noteFlags).where(eq(schema.noteFlags.noteId, noteId));
	// Delete note
	await db.delete(schema.notes).where(eq(schema.notes.id, noteId));

	return ok(undefined);
}
