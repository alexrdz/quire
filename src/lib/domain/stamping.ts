import {
	type FanUserId,
	type IssueId,
	type ScanTokenHash,
	type Result,
	type DomainError,
	ok,
	err
} from './types';
import type { StampWindow } from './issue';

/**
 * Calculates the 48-hour Stamp Window:
 * Begins at 00:00:00 on the gig date and ends at 23:59:59 the following day.
 * Uses ISO date string (YYYY-MM-DD) and venue timezone offset or standard string.
 */
export function calculateStampWindow(
	dateStr: string, // YYYY-MM-DD
	timezone: string = 'UTC'
): Result<StampWindow, DomainError> {
	const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
	if (!dateRegex.test(dateStr)) {
		return err({
			code: 'INVALID_DATE_FORMAT',
			message: 'Date must be formatted as YYYY-MM-DD.'
		});
	}

	try {
		// Construct 00:00:00 on gig date and 23:59:59.999 on day after in target timezone
		const [year, month, day] = dateStr.split('-').map(Number);

		// We compute timestamps using Intl / Date
		const startIso = `${dateStr}T00:00:00`;
		// Day after
		const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
		const nextYear = nextDate.getUTCFullYear();
		const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
		const nextDay = String(nextDate.getUTCDate()).padStart(2, '0');
		const endIso = `${nextYear}-${nextMonth}-${nextDay}T23:59:59.999`;

		// In pure domain without external libraries, we can anchor UTC representation or parse timezone offset
		const start = new Date(`${startIso}Z`);
		const end = new Date(`${endIso}Z`);

		if (isNaN(start.getTime()) || isNaN(end.getTime())) {
			return err({
				code: 'INVALID_DATE',
				message: 'Failed to construct valid stamp window dates.'
			});
		}

		return ok({ start, end });
	} catch (e) {
		return err({
			code: 'TIMEZONE_ERROR',
			message: `Could not parse timezone '${timezone}' or date: ${String(e)}`
		});
	}
}

/**
 * Checks if a given timestamp falls within an issue's Stamp Window.
 */
export function isWithinStampWindow(now: Date, window: StampWindow): boolean {
	return now >= window.start && now <= window.end;
}

/**
 * Stamp Attendance Eligibility Finite State Machine (FSM)
 * States:
 * - unverified: Direct link visit. Can only bookmark/Save.
 * - scan_verified_in_window: Physical QR scan verified during Stamp Window. Eligible to Stamp.
 * - stamped: Attendance confirmed; converted into a collector's Stub.
 * - save_only: Bookmarked without physical verification.
 */
export type AttendanceState =
	| {
			status: 'unverified';
			issueId: IssueId;
	  }
	| {
			status: 'scan_verified_in_window';
			issueId: IssueId;
			scanTokenHash: ScanTokenHash;
			scannedAt: Date;
	  }
	| {
			status: 'stamped';
			issueId: IssueId;
			fanUserId: FanUserId;
			stampedAt: Date;
	  }
	| {
			status: 'save_only';
			issueId: IssueId;
			fanUserId: FanUserId;
			savedAt: Date;
	  };

export type AttendanceEvent =
	| {
			type: 'VERIFY_SCAN';
			scanTokenHash: ScanTokenHash;
			scannedAt: Date;
			window: StampWindow;
	  }
	| {
			type: 'CLAIM_STAMP';
			fanUserId: FanUserId;
			stampedAt?: Date;
	  }
	| {
			type: 'SAVE_ISSUE';
			fanUserId: FanUserId;
			savedAt?: Date;
	  };

export function attendanceTransition(
	currentState: AttendanceState,
	event: AttendanceEvent
): Result<AttendanceState, DomainError> {
	switch (currentState.status) {
		case 'unverified': {
			if (event.type === 'VERIFY_SCAN') {
				if (!isWithinStampWindow(event.scannedAt, event.window)) {
					return err({
						code: 'OUTSIDE_STAMP_WINDOW',
						message: 'The physical QR code was scanned outside of the 48-hour Stamp Window.'
					});
				}
				return ok({
					status: 'scan_verified_in_window',
					issueId: currentState.issueId,
					scanTokenHash: event.scanTokenHash,
					scannedAt: event.scannedAt
				});
			}
			if (event.type === 'SAVE_ISSUE') {
				return ok({
					status: 'save_only',
					issueId: currentState.issueId,
					fanUserId: event.fanUserId,
					savedAt: event.savedAt ?? new Date()
				});
			}
			if (event.type === 'CLAIM_STAMP') {
				return err({
					code: 'SCAN_REQUIRED',
					message: 'Cannot claim a Stamp without scanning the physical QR code sticker at the gig.'
				});
			}
			return err({
				code: 'INVALID_EVENT',
				message: `Unexpected event in unverified state.`
			});
		}

		case 'scan_verified_in_window': {
			if (event.type === 'CLAIM_STAMP') {
				return ok({
					status: 'stamped',
					issueId: currentState.issueId,
					fanUserId: event.fanUserId,
					stampedAt: event.stampedAt ?? new Date()
				});
			}
			if (event.type === 'SAVE_ISSUE') {
				// Fan chooses to save, but remains eligible to stamp later
				return ok({
					status: 'save_only',
					issueId: currentState.issueId,
					fanUserId: event.fanUserId,
					savedAt: event.savedAt ?? new Date()
				});
			}
			return err({
				code: 'INVALID_EVENT',
				message: `Unexpected event '${event.type}' in scan_verified_in_window state.`
			});
		}

		case 'save_only': {
			// If previously saved and now scans or claims stamp
			if (event.type === 'VERIFY_SCAN') {
				if (!isWithinStampWindow(event.scannedAt, event.window)) {
					return err({
						code: 'OUTSIDE_STAMP_WINDOW',
						message: 'QR code was scanned outside of the 48-hour Stamp Window.'
					});
				}
				return ok({
					status: 'scan_verified_in_window',
					issueId: currentState.issueId,
					scanTokenHash: event.scanTokenHash,
					scannedAt: event.scannedAt
				});
			}
			return err({
				code: 'ALREADY_SAVED',
				message: 'Issue is already saved in fan collection.'
			});
		}

		case 'stamped': {
			return err({
				code: 'ALREADY_STAMPED',
				message: 'This issue has already been stamped as attended. One Stamp per fan per issue.'
			});
		}
	}
}
