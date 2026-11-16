import { describe, it, expect } from 'vitest';
import {
	calculateStampWindow,
	isWithinStampWindow,
	attendanceTransition,
	type AttendanceState
} from '$domain/stamping';
import { createFanUserId, createIssueId, createScanTokenHash } from '$domain/types';

describe('Stamp Window & Attendance Eligibility FSM', () => {
	const issueId = createIssueId('issue-1');
	const fanUserId = createFanUserId('fan-1');
	const scanTokenHash = createScanTokenHash('hash_abc123');

	describe('Stamp Window Calculation', () => {
		it('calculates the 48-hour calendar window from gig date through the next day', () => {
			const result = calculateStampWindow('2026-10-12', 'America/New_York');
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			expect(result.value.start.toISOString()).toBe('2026-10-12T00:00:00.000Z');
			expect(result.value.end.toISOString()).toBe('2026-10-13T23:59:59.999Z');
		});

		it('correctly validates if a timestamp is inside the window', () => {
			const windowResult = calculateStampWindow('2026-10-12', 'UTC');
			if (!windowResult.ok) return;
			const window = windowResult.value;

			// During gig
			expect(isWithinStampWindow(new Date('2026-10-12T21:30:00Z'), window)).toBe(true);
			// Next morning
			expect(isWithinStampWindow(new Date('2026-10-13T10:00:00Z'), window)).toBe(true);
			// Day before
			expect(isWithinStampWindow(new Date('2026-10-11T23:59:00Z'), window)).toBe(false);
			// Two days later
			expect(isWithinStampWindow(new Date('2026-10-14T00:00:01Z'), window)).toBe(false);
		});
	});

	describe('Attendance Eligibility FSM', () => {
		it('allows an unverified direct link visitor to save the issue, but NOT stamp', () => {
			const unverifiedState: AttendanceState = {
				status: 'unverified',
				issueId
			};

			// Attempting to claim stamp directly fails
			const stampResult = attendanceTransition(unverifiedState, {
				type: 'CLAIM_STAMP',
				fanUserId
			});
			expect(stampResult.ok).toBe(false);
			if (!stampResult.ok) {
				expect(stampResult.error.code).toBe('SCAN_REQUIRED');
			}

			// Saving the issue succeeds
			const saveResult = attendanceTransition(unverifiedState, {
				type: 'SAVE_ISSUE',
				fanUserId
			});
			expect(saveResult.ok).toBe(true);
			if (!saveResult.ok) return;
			expect(saveResult.value.status).toBe('save_only');
		});

		it('allows a fan who scanned during the window to claim a Stamp', () => {
			const windowResult = calculateStampWindow('2026-10-12', 'UTC');
			if (!windowResult.ok) return;

			const unverifiedState: AttendanceState = {
				status: 'unverified',
				issueId
			};

			// 1. Verify scan during window
			const scanResult = attendanceTransition(unverifiedState, {
				type: 'VERIFY_SCAN',
				scanTokenHash,
				scannedAt: new Date('2026-10-12T22:00:00Z'),
				window: windowResult.value
			});
			expect(scanResult.ok).toBe(true);
			if (!scanResult.ok) return;
			expect(scanResult.value.status).toBe('scan_verified_in_window');

			// 2. Claim stamp
			const claimResult = attendanceTransition(scanResult.value, {
				type: 'CLAIM_STAMP',
				fanUserId
			});
			expect(claimResult.ok).toBe(true);
			if (!claimResult.ok) return;
			expect(claimResult.value.status).toBe('stamped');
		});

		it('rejects scanning outside the 48-hour stamp window', () => {
			const windowResult = calculateStampWindow('2026-10-12', 'UTC');
			if (!windowResult.ok) return;

			const unverifiedState: AttendanceState = {
				status: 'unverified',
				issueId
			};

			const scanResult = attendanceTransition(unverifiedState, {
				type: 'VERIFY_SCAN',
				scanTokenHash,
				scannedAt: new Date('2026-10-15T00:00:00Z'), // Too late
				window: windowResult.value
			});
			expect(scanResult.ok).toBe(false);
			if (!scanResult.ok) {
				expect(scanResult.error.code).toBe('OUTSIDE_STAMP_WINDOW');
			}
		});

		it('replaces a Save with a Stamp if the fan scans later within the window', () => {
			const windowResult = calculateStampWindow('2026-10-12', 'UTC');
			if (!windowResult.ok) return;

			const savedState: AttendanceState = {
				status: 'save_only',
				issueId,
				fanUserId,
				savedAt: new Date('2026-10-10T00:00:00Z')
			};

			// Scan at gig
			const scanResult = attendanceTransition(savedState, {
				type: 'VERIFY_SCAN',
				scanTokenHash,
				scannedAt: new Date('2026-10-12T20:00:00Z'),
				window: windowResult.value
			});
			expect(scanResult.ok).toBe(true);
			if (!scanResult.ok) return;
			expect(scanResult.value.status).toBe('scan_verified_in_window');
		});
	});
});
