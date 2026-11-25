import {
	type ArtistId,
	type IssueId,
	type Result,
	type DomainError,
	ok,
	err
} from './types';

export interface BaseIssue {
	id: IssueId;
	artistId: ArtistId;
	slug: string;
	city: string;
	venue: string;
	date: string; // YYYY-MM-DD
	timezone: string;
	coverNote: string;
	approveFirst: boolean;
}

export interface StampWindow {
	start: Date;
	end: Date;
}

export interface DraftIssue extends BaseIssue {
	status: 'draft';
}

export interface PublishedIssue extends BaseIssue {
	status: 'published';
	secretKey: string;
	stampWindow: StampWindow;
	publishedAt: Date;
}

export interface CancelledIssue extends BaseIssue {
	status: 'cancelled';
	reason?: string;
	cancelledAt: Date;
}

export interface ArchivedIssue extends BaseIssue {
	status: 'archived';
	archivedAt: Date;
	previousStatus: 'published' | 'cancelled';
}

export type Issue = DraftIssue | PublishedIssue | CancelledIssue | ArchivedIssue;

export interface PublishParams {
	secretKey: string;
	stampWindow: StampWindow;
	publishedAt?: Date;
}

/**
 * Issue Lifecycle Finite State Machine (FSM)
 * Allowed transitions:
 * draft -> published
 * published -> cancelled
 * published -> archived
 * cancelled -> archived
 * (Issues are never deleted; once archived or cancelled, cannot transition back).
 */
export function publishIssue(
	issue: Issue,
	params: PublishParams
): Result<PublishedIssue, DomainError> {
	if (issue.status !== 'draft') {
		return err({
			code: 'ILLEGAL_TRANSITION',
			message: `Cannot publish an issue with status '${issue.status}'. Only 'draft' issues can be published.`
		});
	}

	if (!params.secretKey || params.secretKey.trim().length === 0) {
		return err({
			code: 'INVALID_SECRET_KEY',
			message: 'A non-empty secret key is required to publish an issue for QR verification.'
		});
	}

	if (params.stampWindow.end <= params.stampWindow.start) {
		return err({
			code: 'INVALID_STAMP_WINDOW',
			message: 'Stamp window end date must be strictly after start date.'
		});
	}

	return ok({
		...issue,
		status: 'published',
		secretKey: params.secretKey,
		stampWindow: params.stampWindow,
		publishedAt: params.publishedAt ?? new Date()
	});
}

export function cancelIssue(
	issue: Issue,
	reason?: string,
	cancelledAt: Date = new Date()
): Result<CancelledIssue, DomainError> {
	if (issue.status !== 'published') {
		return err({
			code: 'ILLEGAL_TRANSITION',
			message: `Cannot cancel an issue with status '${issue.status}'. Only 'published' issues can be cancelled.`
		});
	}

	return ok({
		...issue,
		status: 'cancelled',
		reason,
		cancelledAt
	});
}

export function archiveIssue(
	issue: Issue,
	archivedAt: Date = new Date()
): Result<ArchivedIssue, DomainError> {
	if (issue.status !== 'published' && issue.status !== 'cancelled') {
		return err({
			code: 'ILLEGAL_TRANSITION',
			message: `Cannot archive an issue with status '${issue.status}'. Only 'published' or 'cancelled' issues can be archived.`
		});
	}

	return ok({
		...issue,
		status: 'archived',
		archivedAt,
		previousStatus: issue.status
	});
}

export interface IssueMonthGroup<T extends { date: string }> {
	key: string;
	month: string;
	issues: T[];
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});

function parseYearMonth(dateStr: string): { key: string; month: string } {
	const match = /^(\d{4})-(\d{2})/.exec(dateStr.trim());
	if (!match) {
		return { key: '0000-00', month: dateStr || 'Undated' };
	}

	const year = Number(match[1]);
	const monthNum = Number(match[2]);
	if (!Number.isInteger(year) || !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
		return { key: '0000-00', month: dateStr || 'Undated' };
	}

	const key = `${match[1]}-${match[2]}`;
	const label = MONTH_FORMATTER.format(new Date(Date.UTC(year, monthNum - 1, 1)));
	return { key, month: label };
}

/**
 * Pure domain helper that groups issues into YYYY-MM buckets ordered newest-first.
 * Uses UTC month formatting to prevent local timezone drift on YYYY-MM-DD dates.
 */
export function groupIssuesByMonth<T extends { date: string }>(
	issues: readonly T[]
): IssueMonthGroup<T>[] {
	const buckets = new Map<string, IssueMonthGroup<T>>();

	for (const issue of issues) {
		const { key, month } = parseYearMonth(issue.date);
		let bucket = buckets.get(key);
		if (!bucket) {
			bucket = { key, month, issues: [] };
			buckets.set(key, bucket);
		}
		bucket.issues.push(issue);
	}

	return Array.from(buckets.values()).sort((a, b) => b.key.localeCompare(a.key));
}

/**
 * Whether anyone may read an Issue by its slug or id: every status but a draft. A draft is
 * the Artist's alone (B1-T34); published, cancelled and archived Issues stay readable, since
 * Fans' Stubs, Tip Taps and the Wall outlive them (CONTEXT, decision 21). Every public path
 * (the reader, the Wall, Save, Stamp, Tip Taps, My Stubs) checks this; the Back Page has its
 * own, stricter list.
 */
export function isPubliclyReadable(issue: { status: string }): boolean {
	return issue.status !== 'draft';
}
