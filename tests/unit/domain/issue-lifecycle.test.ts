import { describe, it, expect } from 'vitest';
import {
	publishIssue,
	cancelIssue,
	archiveIssue,
	groupIssuesByMonth,
	type DraftIssue,
	type PublishedIssue
} from '$domain/issue';
import { createArtistId, createIssueId } from '$domain/types';

describe('Issue Lifecycle FSM', () => {
	const baseDraft: DraftIssue = {
		id: createIssueId('issue-1'),
		artistId: createArtistId('artist-1'),
		slug: 'neon-velvet-brooklyn',
		city: 'Brooklyn',
		venue: "Baby's All Right",
		date: '2026-10-12',
		timezone: 'America/New_York',
		coverNote: 'Doors at 8.',
		approveFirst: false,
		status: 'draft'
	};

	const validStampWindow = {
		start: new Date('2026-10-12T00:00:00Z'),
		end: new Date('2026-10-13T23:59:59Z')
	};

	it('successfully publishes a draft issue with secret key and valid stamp window', () => {
		const result = publishIssue(baseDraft, {
			secretKey: 'secure_secret_key_123',
			stampWindow: validStampWindow
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.status).toBe('published');
		expect(result.value.secretKey).toBe('secure_secret_key_123');
		expect(result.value.stampWindow).toEqual(validStampWindow);
	});

	it('rejects publishing without a secret key', () => {
		const result = publishIssue(baseDraft, {
			secretKey: '   ',
			stampWindow: validStampWindow
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('INVALID_SECRET_KEY');
		}
	});

	it('rejects publishing with invalid stamp window dates', () => {
		const result = publishIssue(baseDraft, {
			secretKey: 'secret_123',
			stampWindow: {
				start: new Date('2026-10-13T00:00:00Z'),
				end: new Date('2026-10-12T00:00:00Z') // End before start
			}
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('INVALID_STAMP_WINDOW');
		}
	});

	it('allows cancelling a published issue', () => {
		const pubResult = publishIssue(baseDraft, {
			secretKey: 'secret_123',
			stampWindow: validStampWindow
		});
		expect(pubResult.ok).toBe(true);
		if (!pubResult.ok) return;

		const cancelResult = cancelIssue(pubResult.value, 'Show rained out');
		expect(cancelResult.ok).toBe(true);
		if (!cancelResult.ok) return;

		expect(cancelResult.value.status).toBe('cancelled');
		expect(cancelResult.value.reason).toBe('Show rained out');
	});

	it('allows archiving a published or cancelled issue', () => {
		const pubResult = publishIssue(baseDraft, {
			secretKey: 'secret_123',
			stampWindow: validStampWindow
		});
		expect(pubResult.ok).toBe(true);
		if (!pubResult.ok) return;

		const archiveResult = archiveIssue(pubResult.value);
		expect(archiveResult.ok).toBe(true);
		if (!archiveResult.ok) return;

		expect(archiveResult.value.status).toBe('archived');
		expect(archiveResult.value.previousStatus).toBe('published');
	});

	it('forbids archiving a draft directly', () => {
		const archiveResult = archiveIssue(baseDraft);
		expect(archiveResult.ok).toBe(false);
		if (!archiveResult.ok) {
			expect(archiveResult.error.code).toBe('ILLEGAL_TRANSITION');
		}
	});

	it('forbids publishing an already published, cancelled, or archived issue', () => {
		const pubResult = publishIssue(baseDraft, {
			secretKey: 'secret_123',
			stampWindow: validStampWindow
		});
		if (!pubResult.ok) return;

		const rePubResult = publishIssue(pubResult.value, {
			secretKey: 'new_secret',
			stampWindow: validStampWindow
		});
		expect(rePubResult.ok).toBe(false);
		if (!rePubResult.ok) {
			expect(rePubResult.error.code).toBe('ILLEGAL_TRANSITION');
		}
	});
});

describe('groupIssuesByMonth', () => {
	it('groups issues into UTC YYYY-MM buckets ordered newest-first without timezone drift', () => {
		const input = [
			{ id: '1', date: '2026-09-01', city: 'Chicago' },
			{ id: '2', date: '2026-10-31', city: 'Brooklyn' },
			{ id: '3', date: '2026-10-01', city: 'Boston' },
			{ id: '4', date: '2025-12-15', city: 'Austin' }
		];

		const groups = groupIssuesByMonth(input);

		expect(groups.map((g) => g.key)).toEqual(['2026-10', '2026-09', '2025-12']);
		expect(groups.map((g) => g.month)).toEqual([
			'October 2026',
			'September 2026',
			'December 2025'
		]);
		expect(groups[0]?.issues.map((i) => i.city)).toEqual(['Brooklyn', 'Boston']);
		expect(groups[1]?.issues.map((i) => i.city)).toEqual(['Chicago']);
		expect(groups[2]?.issues.map((i) => i.city)).toEqual(['Austin']);
	});

	it('returns an empty array for empty input and handles malformed dates gracefully', () => {
		expect(groupIssuesByMonth([])).toEqual([]);

		const weird = groupIssuesByMonth([{ id: 'x', date: 'TBD' }]);
		expect(weird).toHaveLength(1);
		expect(weird[0]?.key).toBe('0000-00');
		expect(weird[0]?.month).toBe('TBD');
	});
});
