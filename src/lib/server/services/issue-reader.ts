import { readResumeIntent } from './resume-intent';
import { error, type RequestEvent } from '@sveltejs/kit';
import { and, asc, desc, eq } from 'drizzle-orm';
import { ArtistAccountStatus } from '$domain/account';
import { isPubliclyReadable } from '$domain/issue';
import { db, schema } from '$lib/server/db';
import { optionalViewer } from '$lib/server/guards';
import { verifyScanToken } from '$lib/server/services/stamping';

/**
 * The data the Stories reader renders, shared by the public reader (/i/[slug]) and the
 * Artist's own preview in the Bookbinder (/dashboard/bookbinder/[id]/preview), so both
 * show the same pages from the same code.
 *
 * - `public`: by slug, for anyone. A draft is not public: it is 404, as is an unknown slug.
 * - `owner`: by id, only for the Artist who owns it, drafts included. Anyone else gets
 *   404, not 403, so a draft can't be discovered. The preview is the Artist's own view:
 *   it never reads a Fan's scan cookie or collection.
 */
export type IssueReaderAccess =
	| { kind: 'public'; slug: string | undefined }
	| { kind: 'owner'; issueId: string | undefined; artistId: string };

async function findIssue(access: IssueReaderAccess) {
	if (access.kind === 'public') {
		if (!access.slug) return undefined;
		const issue = await db.query.issues.findFirst({
			where: eq(schema.issues.slug, access.slug),
			with: { artist: true, issuePages: { orderBy: [asc(schema.issuePages.position)] } }
		});
		// A draft is the Artist's alone (B1-T34): the same rule as every other public path.
		return issue && isPubliclyReadable(issue) ? issue : undefined;
	}
	if (!access.issueId) return undefined;
	return db.query.issues.findFirst({
		where: and(eq(schema.issues.id, access.issueId), eq(schema.issues.artistId, access.artistId)),
		with: { artist: true, issuePages: { orderBy: [asc(schema.issuePages.position)] } }
	});
}

/** Nothing on an archived Issue or a closed Artist's can be written, so there is nothing to resume. */
function isReadOnlyIssue(issue: { status: string; artist: { accountStatus: string } }): boolean {
	return issue.artist.accountStatus === ArtistAccountStatus.Closed || issue.status === 'archived';
}

export async function loadIssueReader(event: RequestEvent, access: IssueReaderAccess) {
	const issue = await findIssue(access);
	if (!issue) throw error(404, 'Issue not found');
	const preview = access.kind === 'owner';

	// The Artist's recurring Master Template pages.
	const templatePages = await db.query.templatePages.findMany({
		where: eq(schema.templatePages.artistId, issue.artistId),
		orderBy: [asc(schema.templatePages.position)]
	});

	// Fans who stamped this Issue, for the "Was there" mark (SPEC.md §5.5).
	const issueStamps = await db.query.collections.findMany({
		where: and(eq(schema.collections.issueId, issue.id), eq(schema.collections.kind, 'stamped'))
	});
	const stampedFanIds = new Set(issueStamps.map((s) => s.fanUserId));

	// Live Wall notes with their replies.
	const rawNotes = await db.query.notes.findMany({
		where: and(eq(schema.notes.issueId, issue.id), eq(schema.notes.status, 'live')),
		orderBy: [desc(schema.notes.createdAt)],
		with: {
			author: { columns: { id: true, name: true, image: true } },
			replies: true
		}
	});
	const notes = rawNotes.map((n) => ({ ...n, wasThere: stampedFanIds.has(n.fanUserId) }));

	const viewer = optionalViewer(event);

	// The attendance scan cookie (a Fan's, never read for the Artist's preview).
	let isScanVerified = false;
	const scanToken = preview ? undefined : event.cookies.get(`quire_scan_${issue.slug}`);
	if (scanToken) {
		const tokenCheck = verifyScanToken(scanToken);
		isScanVerified = tokenCheck.ok && tokenCheck.value.issueSlug === issue.slug;
	}

	// The signed-in Fan's Save or Stamp of this Issue (not for the Artist's preview).
	let collectionStatus: 'none' | 'saved' | 'stamped' = 'none';
	if (viewer && !preview) {
		const entry = await db.query.collections.findFirst({
			where: and(eq(schema.collections.fanUserId, viewer.id), eq(schema.collections.issueId, issue.id))
		});
		if (entry) collectionStatus = entry.kind as 'saved' | 'stamped';
	}

	// What a signed-in Fan asked to finish before Google sign-in (B1-T37): the reader
	// submits it once on return. Read-only here; the action spends the token.
	const resumeIntent = viewer && !preview && !isReadOnlyIssue(issue) ? readResumeIntent(event.cookies, issue.slug) : null;

	let tipPresets = [3, 5, 10];
	try {
		tipPresets = JSON.parse(issue.artist.tipPresetsJson || '[3, 5, 10]');
	} catch {
		// The default presets.
	}

	const isArtistClosed = issue.artist.accountStatus === ArtistAccountStatus.Closed;
	const isReadOnly = isArtistClosed || issue.status === 'archived';

	return {
		issue,
		artist: issue.artist,
		isArtistClosed,
		isReadOnly,
		issuePages: issue.issuePages,
		templatePages,
		notes,
		tipPresets,
		viewer,
		isScanVerified,
		collectionStatus,
		resumeIntent,
		/** True in the Artist's Bookbinder preview: nothing in it may write. */
		preview
	};
}
