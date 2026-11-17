import { describe, it, expect } from 'vitest';
import {
	screenNoteText,
	flagNote,
	hideNote,
	restoreNote,
	wallNoteTransition,
	NoteStatus,
	ModerationAction,
	type WallNoteState,
	type NoteEntity,
	FLAG_AUTO_HIDE_THRESHOLD
} from '$domain/wall';
import { createArtistId, createFanUserId, createIssueId, createNoteId } from '$domain/types';

describe('Wall Note Moderation & Submission FSM', () => {
	const artistId = createArtistId('artist-1');
	const issueId = createIssueId('issue-1');
	const fanUserId = createFanUserId('fan-1');
	const noteId = createNoteId('note-1');

	describe('Anti-Spam Screening Rules', () => {
		it('allows genuine clean notes', () => {
			expect(screenNoteText('Amazing gig tonight in Detroit!').valid).toBe(true);
			expect(screenNoteText('Play the encore!!').valid).toBe(true);
		});

		it('rejects notes containing links/URLs', () => {
			expect(screenNoteText('Check my soundcloud at https://soundcloud.com/band').violation).toBe('CONTAINS_LINK');
			expect(screenNoteText('Visit www.mywebsite.org for tickets').violation).toBe('CONTAINS_LINK');
			expect(screenNoteText('Follow me on insta.gg/music').violation).toBe('CONTAINS_LINK');
		});

		it('rejects notes containing emails', () => {
			expect(screenNoteText('Email me for bookings at manager@band.com').violation).toBe('CONTAINS_EMAIL');
		});

		it('rejects notes containing phone numbers', () => {
			expect(screenNoteText('Hit me up after the show 555-234-5678').violation).toBe('CONTAINS_PHONE');
			expect(screenNoteText('Call me: +1 (212) 555-0199').violation).toBe('CONTAINS_PHONE');
		});

		it('rejects empty or whitespace-only notes', () => {
			expect(screenNoteText('   ').violation).toBe('EMPTY');
		});

		it('rejects notes longer than 500 characters', () => {
			const longText = 'a'.repeat(501);
			expect(screenNoteText(longText).violation).toBe('TOO_LONG');
		});
	});

	describe('Flagging & Immunity Invariants', () => {
		const baseNote: NoteEntity = {
			id: noteId,
			artistId,
			issueId,
			fanUserId,
			body: 'Great set!',
			status: 'live',
			flagCount: 0,
			flagImmune: false,
			createdAt: new Date()
		};

		it('increments flag count and auto-hides at threshold (3 flags)', () => {
			let note = { ...baseNote };

			// Flag 1
			let res = flagNote(note);
			expect(res.ok).toBe(true);
			if (!res.ok) return;
			note = res.value.note;
			expect(note.flagCount).toBe(1);
			expect(note.status).toBe('live');

			// Flag 2
			res = flagNote(note);
			if (!res.ok) return;
			note = res.value.note;
			expect(note.flagCount).toBe(2);
			expect(note.status).toBe('live');

			// Flag 3 -> auto-hides
			res = flagNote(note);
			if (!res.ok) return;
			note = res.value.note;
			expect(note.flagCount).toBe(3);
			expect(note.status).toBe('hidden');
			expect(res.value.wasAutoHidden).toBe(true);
		});

		it('Decision 22: restored note becomes flag-immune to stop brigading', () => {
			const hiddenNote: NoteEntity = {
				...baseNote,
				status: 'hidden',
				flagCount: 3,
				flagImmune: false
			};

			const restoreRes = restoreNote(hiddenNote);
			expect(restoreRes.ok).toBe(true);
			if (!restoreRes.ok) return;

			const restored = restoreRes.value;
			expect(restored.status).toBe('live');
			expect(restored.flagImmune).toBe(true);

			// Flagging again increments count but DOES NOT auto-hide
			const flagAgain = flagNote(restored);
			expect(flagAgain.ok).toBe(true);
			if (!flagAgain.ok) return;
			expect(flagAgain.value.note.status).toBe('live');
			expect(flagAgain.value.wasAutoHidden).toBe(false);
		});

		it('hides a live note non-destructively and rejects hiding an already hidden note', () => {
			expect(NoteStatus.Hidden).toBe('hidden');
			expect(ModerationAction.Hide).toBe('hide');

			const hiddenRes = hideNote(baseNote);
			expect(hiddenRes.ok).toBe(true);
			if (!hiddenRes.ok) return;
			expect(hiddenRes.value.status).toBe(NoteStatus.Hidden);

			const doubleHide = hideNote(hiddenRes.value);
			expect(doubleHide.ok).toBe(false);
			if (!doubleHide.ok) {
				expect(doubleHide.error.code).toBe('ALREADY_HIDDEN');
			}
		});
	});

	describe('Wall Note Submission FSM', () => {
		it('supports anonymous drafting with pending auth restoration', () => {
			let state: WallNoteState = { status: 'empty' };

			// Fan types note
			let res = wallNoteTransition(state, { type: 'TYPE', text: 'Incredible bass tone!' });
			expect(res.ok).toBe(true);
			if (!res.ok) return;
			state = res.value;
			expect(state.status).toBe('typing');

			// Fan taps post without being logged in
			res = wallNoteTransition(state, { type: 'SUBMIT_ANONYMOUS', returnUrl: '/i/slug#wall' });
			expect(res.ok).toBe(true);
			if (!res.ok) return;
			state = res.value;
			expect(state.status).toBe('pending_auth');

			// OAuth returns successfully
			res = wallNoteTransition(state, { type: 'AUTH_SUCCESS', fanUserId });
			expect(res.ok).toBe(true);
			if (!res.ok) return;
			state = res.value;
			expect(state.status).toBe('submitting');

			// Process submission for live wall
			res = wallNoteTransition(state, {
				type: 'PROCESS_SUBMISSION',
				noteId,
				artistId,
				issueId,
				approveFirst: false
			});
			expect(res.ok).toBe(true);
			if (!res.ok) return;
			state = res.value;
			expect(state.status).toBe('live');
		});

		it('diverts to pending_review when approveFirst is enabled', () => {
			const submittingState: WallNoteState = {
				status: 'submitting',
				draft: 'Hello from row 1!',
				fanUserId
			};

			const res = wallNoteTransition(submittingState, {
				type: 'PROCESS_SUBMISSION',
				noteId,
				artistId,
				issueId,
				approveFirst: true
			});
			expect(res.ok).toBe(true);
			if (!res.ok) return;
			expect(res.value.status).toBe('pending_review');
		});
	});
});
