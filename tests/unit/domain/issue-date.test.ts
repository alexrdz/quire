import { describe, expect, it } from 'vitest';
import { formatIssueDate } from '$domain/issue-date';

describe('Issue dates', () => {
	it('formats the header and Cover dates', () => {
		expect(formatIssueDate('2026-10-12', 'America/New_York', 'short')).toBe('Oct 12');
		expect(formatIssueDate('2026-10-12', 'America/New_York', 'long')).toBe('Oct 12, 2026');
		expect(formatIssueDate('2031-03-04', 'America/Chicago', 'long')).toBe('Mar 4, 2031');
	});

	it('keeps the calendar day of the show in every time zone, even near the date line', () => {
		for (const zone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Los_Angeles', 'Asia/Tokyo', 'UTC']) {
			expect(formatIssueDate('2026-12-31', zone, 'long'), zone).toBe('Dec 31, 2026');
			expect(formatIssueDate('2027-01-01', zone, 'short'), zone).toBe('Jan 1');
		}
	});

	it('returns anything that is not a real date as it is, and never throws on a bad zone', () => {
		for (const raw of ['', 'soon', '2026-13-01', '2026-02-30', '12/10/2026']) {
			expect(formatIssueDate(raw, 'America/New_York', 'long'), raw).toBe(raw);
		}
		expect(formatIssueDate('2026-10-12', 'Not/A_Zone', 'short')).toBe('Oct 12');
		expect(formatIssueDate('2026-10-12', null, 'short')).toBe('Oct 12');
	});
});
