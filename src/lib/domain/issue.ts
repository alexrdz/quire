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
