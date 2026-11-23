/**
 * An Issue's date, as people read it (R-T01b). Pure: no DOM, no Svelte.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * An Issue's date for people: "Oct 12" (`short`, the header) or "Oct 12, 2026"
 * (`long`, the Cover). The stored date is already the calendar day of the show
 * in the Issue's own time zone, so it is shown as that day. It is read as noon
 * UTC and formatted in UTC, never through a clock in another zone, which would
 * turn Oct 12 into Oct 11 or Oct 13 near the date line. `_timeZone` is the
 * zone that day belongs to; it is taken for clarity at call sites, and an
 * unknown zone can't break anything. Anything that isn't a real YYYY-MM-DD
 * date is returned as it is.
 */
export function formatIssueDate(date: string, _timeZone: string | null | undefined, style: 'short' | 'long'): string {
	const match = ISO_DATE.exec(date.trim());
	if (!match) return date;
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const at = new Date(Date.UTC(year, month - 1, day, 12));
	if (at.getUTCFullYear() !== year || at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return date;
	return new Intl.DateTimeFormat('en-US', {
		timeZone: 'UTC',
		month: 'short',
		day: 'numeric',
		...(style === 'long' ? { year: 'numeric' } : {})
	}).format(at);
}
