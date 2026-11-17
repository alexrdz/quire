import {
	type ArtistId,
	type FanUserId,
	type IssueId,
	type NoteId,
	type Result,
	type DomainError,
	ok,
	err
} from './types';

export const FLAG_AUTO_HIDE_THRESHOLD = 3;
export const MAX_NOTE_LENGTH = 500;

/**
 * Canonical Wall note lifecycle statuses and moderation actions shared across
 * domain logic, Zod boundary schemas, Drizzle persistence, and UI.
 */
export const NoteStatus = {
	Live: 'live',
	Pending: 'pending',
	Hidden: 'hidden'
} as const;

export type NoteStatus = (typeof NoteStatus)[keyof typeof NoteStatus];

export const NOTE_STATUSES = [
	NoteStatus.Live,
	NoteStatus.Pending,
	NoteStatus.Hidden
] as const;

export const ModerationAction = {
	Approve: 'approve',
	Hide: 'hide',
	Restore: 'restore',
	Delete: 'delete'
} as const;

export type ModerationAction = (typeof ModerationAction)[keyof typeof ModerationAction];

export const MODERATION_ACTIONS = [
	ModerationAction.Approve,
	ModerationAction.Hide,
	ModerationAction.Restore,
	ModerationAction.Delete
] as const;

/**
 * Moderation screening checks:
 * Decision 23: No links, emails, or phone numbers in notes.
 */
const URL_REGEX = /(https?:\/\/|www\.|\.com|\.org|\.net|\.io|\.gg|\.me\b)/i;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/;

export interface ModerationCheckResult {
	valid: boolean;
	violation?: 'CONTAINS_LINK' | 'CONTAINS_EMAIL' | 'CONTAINS_PHONE' | 'TOO_LONG' | 'EMPTY';
}

export function screenNoteText(text: string): ModerationCheckResult {
	const trimmed = text.trim();
	if (trimmed.length === 0) {
		return { valid: false, violation: 'EMPTY' };
	}
	if (trimmed.length > MAX_NOTE_LENGTH) {
		return { valid: false, violation: 'TOO_LONG' };
	}
	if (EMAIL_REGEX.test(trimmed)) {
		return { valid: false, violation: 'CONTAINS_EMAIL' };
	}
	if (URL_REGEX.test(trimmed)) {
		return { valid: false, violation: 'CONTAINS_LINK' };
	}
	if (PHONE_REGEX.test(trimmed)) {
		return { valid: false, violation: 'CONTAINS_PHONE' };
	}
	return { valid: true };
}

export interface NoteEntity {
	id: NoteId;
	artistId: ArtistId;
	issueId: IssueId | null; // null = General Wall
	fanUserId: FanUserId;
	body: string;
	status: NoteStatus;
	flagCount: number;
	flagImmune: boolean;
	createdAt: Date;
}

export interface NoteReplyEntity {
	id: string;
	noteId: NoteId;
	artistId: ArtistId;
	body: string;
	createdAt: Date;
}

/**
 * Flagging logic with immunity check.
 * 3 flags auto-hide note, unless flagImmune is true.
 */
export function flagNote(
	note: NoteEntity
): Result<{ note: NoteEntity; wasAutoHidden: boolean }, DomainError> {
	if (note.status === NoteStatus.Hidden) {
		return err({
			code: 'ALREADY_HIDDEN',
			message: 'Note is already hidden.'
		});
	}

	const newFlagCount = note.flagCount + 1;
	const shouldAutoHide = !note.flagImmune && newFlagCount >= FLAG_AUTO_HIDE_THRESHOLD;

	const updatedNote: NoteEntity = {
		...note,
		flagCount: newFlagCount,
		status: shouldAutoHide ? NoteStatus.Hidden : note.status
	};

	return ok({
		note: updatedNote,
		wasAutoHidden: shouldAutoHide
	});
}

/**
 * Artist hides a live or pending note without deleting it (SPEC 5.5).
 */
export function hideNote(note: NoteEntity): Result<NoteEntity, DomainError> {
	if (note.status === NoteStatus.Hidden) {
		return err({
			code: 'ALREADY_HIDDEN',
			message: 'Note is already hidden.'
		});
	}

	return ok({
		...note,
		status: NoteStatus.Hidden
	});
}

/**
 * Artist restores a hidden note.
 * Decision 22: Restored notes become flag-immune to block brigading.
 */
export function restoreNote(note: NoteEntity): Result<NoteEntity, DomainError> {
	return ok({
		...note,
		status: NoteStatus.Live,
		flagImmune: true
	});
}

/**
 * Wall Note Submission Finite State Machine (FSM)
 * empty -> typing -> pending_auth -> submitting -> live | pending_review | rejected
 */
export type WallNoteState =
	| { status: 'empty' }
	| { status: 'typing'; draft: string }
	| { status: 'pending_auth'; draft: string; returnUrl: string }
	| { status: 'submitting'; draft: string; fanUserId: FanUserId }
	| { status: 'live'; note: NoteEntity }
	| { status: 'pending_review'; note: NoteEntity }
	| { status: 'rejected'; reason: string; draft: string };

export type WallNoteEvent =
	| { type: 'TYPE'; text: string }
	| { type: 'SUBMIT_ANONYMOUS'; returnUrl: string }
	| { type: 'AUTH_SUCCESS'; fanUserId: FanUserId }
	| {
			type: 'PROCESS_SUBMISSION';
			noteId: NoteId;
			artistId: ArtistId;
			issueId: IssueId | null;
			approveFirst: boolean;
	  }
	| { type: 'CLEAR' };

export function wallNoteTransition(
	currentState: WallNoteState,
	event: WallNoteEvent
): Result<WallNoteState, DomainError> {
	switch (currentState.status) {
		case 'empty': {
			if (event.type === 'TYPE') {
				if (event.text.trim().length === 0) {
					return ok({ status: 'empty' });
				}
				return ok({ status: 'typing', draft: event.text });
			}
			return err({ code: 'INVALID_EVENT', message: 'Note is empty.' });
		}

		case 'typing': {
			if (event.type === 'TYPE') {
				if (event.text.trim().length === 0) {
					return ok({ status: 'empty' });
				}
				return ok({ status: 'typing', draft: event.text });
			}
			if (event.type === 'SUBMIT_ANONYMOUS') {
				const screen = screenNoteText(currentState.draft);
				if (!screen.valid) {
					return ok({
						status: 'rejected',
						reason: `Note violates guidelines: ${screen.violation}`,
						draft: currentState.draft
					});
				}
				return ok({
					status: 'pending_auth',
					draft: currentState.draft,
					returnUrl: event.returnUrl
				});
			}
			if (event.type === 'AUTH_SUCCESS') {
				return ok({
					status: 'submitting',
					draft: currentState.draft,
					fanUserId: event.fanUserId
				});
			}
			if (event.type === 'CLEAR') {
				return ok({ status: 'empty' });
			}
			return err({ code: 'INVALID_EVENT', message: `Unexpected event in typing state.` });
		}

		case 'pending_auth': {
			if (event.type === 'AUTH_SUCCESS') {
				return ok({
					status: 'submitting',
					draft: currentState.draft,
					fanUserId: event.fanUserId
				});
			}
			if (event.type === 'CLEAR') {
				return ok({ status: 'empty' });
			}
			return err({ code: 'INVALID_EVENT', message: 'Awaiting authentication completion.' });
		}

		case 'submitting': {
			if (event.type === 'PROCESS_SUBMISSION') {
				const screen = screenNoteText(currentState.draft);
				if (!screen.valid) {
					return ok({
						status: 'rejected',
						reason: `Submission rejected: ${screen.violation}`,
						draft: currentState.draft
					});
				}

				const note: NoteEntity = {
					id: event.noteId,
					artistId: event.artistId,
					issueId: event.issueId,
					fanUserId: currentState.fanUserId,
					body: currentState.draft,
					status: event.approveFirst ? NoteStatus.Pending : NoteStatus.Live,
					flagCount: 0,
					flagImmune: false,
					createdAt: new Date()
				};

				if (event.approveFirst) {
					return ok({ status: 'pending_review', note });
				} else {
					return ok({ status: 'live', note });
				}
			}
			return err({ code: 'INVALID_EVENT', message: 'Note is currently submitting.' });
		}

		case 'live':
		case 'pending_review':
		case 'rejected': {
			if (event.type === 'CLEAR') {
				return ok({ status: 'empty' });
			}
			if (event.type === 'TYPE') {
				return ok({ status: 'typing', draft: event.text });
			}
			return err({ code: 'TERMINAL_STATE', message: 'Current state must be cleared.' });
		}
	}
}
