import crypto from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import {
	archiveIssuesOnClosure,
	ArtistAccountStatus,
	SlugPetitionStatus
} from '$domain/account';
import type { Issue } from '$domain/issue';
import {
	createArtistId,
	createIssueId,
	err,
	ok,
	type DomainError,
	type Result
} from '$domain/types';
import { slugPetitionSchema } from '$schemas/auth';
import { verifyUserCredentialPassword } from '$lib/server/auth';
import { db, schema } from '$lib/server/db';
import { sendSlugPetitionConfirmationEmail } from '$lib/server/email';

function toDomainIssue(row: typeof schema.issues.$inferSelect): Issue {
	const base = {
		id: createIssueId(row.id),
		artistId: createArtistId(row.artistId),
		slug: row.slug,
		city: row.city,
		venue: row.venue,
		date: row.date,
		timezone: row.timezone,
		coverNote: row.coverNote,
		approveFirst: row.approveFirst
	};

	switch (row.status) {
		case 'draft':
			return { ...base, status: 'draft' };
		case 'published':
			return {
				...base,
				status: 'published',
				secretKey: row.secretKey,
				stampWindow: {
					start: row.stampWindowStart ?? row.createdAt,
					end: row.stampWindowEnd ?? new Date((row.stampWindowStart ?? row.createdAt).getTime() + 1000)
				},
				publishedAt: row.publishedAt ?? row.createdAt
			};
		case 'cancelled':
			return {
				...base,
				status: 'cancelled',
				cancelledAt: row.updatedAt
			};
		case 'archived':
			return {
				...base,
				status: 'archived',
				archivedAt: row.archivedAt ?? row.updatedAt,
				previousStatus: 'published'
			};
	}
}

/**
 * Soft-closes an Artist account per EDGE-CASES.md:
 * - Verifies shared band password
 * - Marks artist accountStatus = 'closed' & disables payouts
 * - Archives all active/draft/cancelled Issues (read-only; never deleted)
 * - Revokes all sessions and cancels pending payout tokens
 * - Preserves Fan Stubs, tip records, and Wall history
 */
export async function closeArtistAccount(params: {
	artistId: string;
	userId: string;
	confirmPassword: string;
}): Promise<Result<{ archivedIssuesCount: number }, DomainError>> {
	const artist = await db.query.artists.findFirst({
		where: and(
			eq(schema.artists.id, params.artistId),
			eq(schema.artists.userId, params.userId)
		)
	});

	if (!artist) {
		return err({ code: 'ARTIST_NOT_FOUND', message: 'Artist account not found.' });
	}

	if (artist.accountStatus === ArtistAccountStatus.Closed) {
		return err({
			code: 'ACCOUNT_ALREADY_CLOSED',
			message: 'This artist account has already been closed.'
		});
	}

	const passwordValid = await verifyUserCredentialPassword(params.userId, params.confirmPassword);
	if (!passwordValid) {
		return err({
			code: 'INVALID_PASSWORD',
			message: 'Incorrect password. Please enter your current band password to close this account.'
		});
	}

	const now = new Date();
	const artistIssues = await db.query.issues.findMany({
		where: eq(schema.issues.artistId, artist.id)
	});

	const archivedResult = archiveIssuesOnClosure(artistIssues.map(toDomainIssue), now);
	if (!archivedResult.ok) {
		return err(archivedResult.error);
	}

	const issuesToArchive = artistIssues.filter((issue) => issue.status !== 'archived');

	await db
		.update(schema.artists)
		.set({
			accountStatus: ArtistAccountStatus.Closed,
			closedAt: now,
			payoutsEnabled: false,
			updatedAt: now
		})
		.where(eq(schema.artists.id, artist.id));

	if (issuesToArchive.length > 0) {
		await db
			.update(schema.issues)
			.set({
				status: 'archived',
				archivedAt: now,
				updatedAt: now
			})
			.where(
				and(
					eq(schema.issues.artistId, artist.id),
					ne(schema.issues.status, 'archived')
				)
			);
	}

	await db
		.update(schema.payoutChangeTokens)
		.set({ status: 'cancelled' })
		.where(
			and(
				eq(schema.payoutChangeTokens.artistId, artist.id),
				eq(schema.payoutChangeTokens.status, 'pending')
			)
		);

	await db.delete(schema.sessions).where(eq(schema.sessions.userId, params.userId));

	return ok({ archivedIssuesCount: issuesToArchive.length });
}

/**
 * Records a handle-claim petition when an artist makes a case to acquire an
 * already-registered or inactive /a/[slug] handle.
 */
export async function submitSlugPetition(input: {
	requestedSlug: string;
	petitionerName: string;
	petitionerEmail: string;
	evidenceUrl?: string;
	rationale: string;
}): Promise<Result<{ petitionId: string; existingArtistClosed: boolean }, DomainError>> {
	const parsed = slugPetitionSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_PETITION_INPUT',
			message: parsed.error.issues[0]?.message || 'Please complete all required petition fields.'
		});
	}

	const existingArtist = await db.query.artists.findFirst({
		where: eq(schema.artists.slug, parsed.data.requestedSlug)
	});

	if (!existingArtist) {
		return err({
			code: 'HANDLE_AVAILABLE',
			message: `The handle "/a/${parsed.data.requestedSlug}" is available! You can claim it directly on Sign Up.`
		});
	}

	const duplicatePending = await db.query.slugPetitions.findFirst({
		where: and(
			eq(schema.slugPetitions.requestedSlug, parsed.data.requestedSlug),
			eq(schema.slugPetitions.petitionerEmail, parsed.data.petitionerEmail),
			eq(schema.slugPetitions.status, SlugPetitionStatus.Pending)
		)
	});

	if (duplicatePending) {
		return err({
			code: 'PETITION_ALREADY_PENDING',
			message: `You already have a pending petition for "/a/${parsed.data.requestedSlug}".`
		});
	}

	const now = new Date();
	const petitionId = crypto.randomUUID();
	const existingArtistClosed = existingArtist.accountStatus === ArtistAccountStatus.Closed;

	await db.insert(schema.slugPetitions).values({
		id: petitionId,
		requestedSlug: parsed.data.requestedSlug,
		existingArtistId: existingArtist.id,
		existingArtistClosed,
		petitionerName: parsed.data.petitionerName,
		petitionerEmail: parsed.data.petitionerEmail,
		evidenceUrl: parsed.data.evidenceUrl || null,
		rationale: parsed.data.rationale,
		status: SlugPetitionStatus.Pending,
		createdAt: now,
		updatedAt: now
	});

	await sendSlugPetitionConfirmationEmail({
		to: parsed.data.petitionerEmail,
		petitionerName: parsed.data.petitionerName,
		requestedSlug: parsed.data.requestedSlug,
		existingArtistClosed
	});

	return ok({ petitionId, existingArtistClosed });
}
