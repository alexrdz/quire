import { archiveIssue, type ArchivedIssue, type Issue } from './issue';
import { type DomainError, type Result, err, ok } from './types';

/**
 * Canonical Artist account lifecycle statuses shared across domain, DB, and routes.
 */
export const ArtistAccountStatus = {
	Active: 'active',
	Closed: 'closed'
} as const;

export type ArtistAccountStatus =
	(typeof ArtistAccountStatus)[keyof typeof ArtistAccountStatus];

export const ARTIST_ACCOUNT_STATUSES = [
	ArtistAccountStatus.Active,
	ArtistAccountStatus.Closed
] as const;

/**
 * Canonical handle-claim petition statuses when an artist petitions for an
 * existing or inactive /a/[slug] handle.
 */
export const SlugPetitionStatus = {
	Pending: 'pending',
	Approved: 'approved',
	Rejected: 'rejected'
} as const;

export type SlugPetitionStatus =
	(typeof SlugPetitionStatus)[keyof typeof SlugPetitionStatus];

export const SLUG_PETITION_STATUSES = [
	SlugPetitionStatus.Pending,
	SlugPetitionStatus.Approved,
	SlugPetitionStatus.Rejected
] as const;

export function isArtistClosed(artist: { accountStatus: ArtistAccountStatus }): boolean {
	return artist.accountStatus === ArtistAccountStatus.Closed;
}

/**
 * Transitions all non-archived Issues to 'archived' when an artist closes their account.
 * Reuses the Issue Lifecycle FSM for published/cancelled issues and archives drafts directly
 * so fan Stubs and historical records stay preserved in read-only mode (EDGE-CASES.md).
 */
export function archiveIssuesOnClosure(
	issues: ReadonlyArray<Issue>,
	archivedAt: Date = new Date()
): Result<ArchivedIssue[], DomainError> {
	const archived: ArchivedIssue[] = [];

	for (const issue of issues) {
		if (issue.status === 'archived') {
			archived.push(issue);
			continue;
		}

		if (issue.status === 'draft') {
			archived.push({
				id: issue.id,
				artistId: issue.artistId,
				slug: issue.slug,
				city: issue.city,
				venue: issue.venue,
				date: issue.date,
				timezone: issue.timezone,
				coverNote: issue.coverNote,
				approveFirst: issue.approveFirst,
				status: 'archived',
				archivedAt,
				previousStatus: 'published'
			});
			continue;
		}

		const result = archiveIssue(issue, archivedAt);
		if (!result.ok) {
			return err(result.error);
		}
		archived.push(result.value);
	}

	return ok(archived);
}
