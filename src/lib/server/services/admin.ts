import crypto from 'node:crypto';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { ArtistAccountStatus, SlugPetitionStatus } from '$domain/account';
import { err, ok, type DomainError, type Result } from '$domain/types';
import { db, schema } from '$lib/server/db';
import { sendSlugPetitionDecisionEmail } from '$lib/server/email';

const setArtistVerifiedSchema = z.object({
	slug: z
		.string()
		.trim()
		.min(2, 'Artist slug is required')
		.max(80)
		.transform((val) => val.toLowerCase()),
	verified: z.boolean()
});

const petitionFilterSchema = z
	.enum([
		SlugPetitionStatus.Pending,
		SlugPetitionStatus.Approved,
		SlugPetitionStatus.Rejected,
		'all'
	])
	.optional();

const petitionDecisionSchema = z.object({
	petitionId: z.string().trim().min(1, 'Petition ID is required'),
	note: z.string().trim().max(500).optional(),
	forceActiveOverride: z.boolean().optional()
});

export interface AdminVerifiedArtistResult {
	artistId: string;
	slug: string;
	displayName: string;
	verified: boolean;
}

export interface AdminSlugPetitionSummary {
	id: string;
	requestedSlug: string;
	existingArtistId: string | null;
	existingArtistClosed: boolean;
	existingArtistCurrentSlug: string | null;
	existingArtistDisplayName: string | null;
	existingArtistStatus: string | null;
	petitionerName: string;
	petitionerEmail: string;
	evidenceUrl: string | null;
	rationale: string;
	status: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface ApprovePetitionResult {
	petitionId: string;
	releasedSlug: string;
	retiredArtistId: string | null;
	retiredArtistNewSlug: string | null;
	petitionerEmail: string;
}

export interface RejectPetitionResult {
	petitionId: string;
	requestedSlug: string;
	petitionerEmail: string;
}

async function generateRetiredSlug(baseSlug: string): Promise<string> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const suffix = crypto.randomBytes(2).toString('hex');
		const candidate = `${baseSlug}-retired-${suffix}`;
		const collision = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, candidate),
			columns: { id: true }
		});
		if (!collision) {
			return candidate;
		}
	}
	return `${baseSlug}-retired-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Grants or revokes platform verification badge (SPEC §6.4) for an artist handle.
 */
export async function setArtistVerifiedBySlug(input: {
	slug: string;
	verified: boolean;
}): Promise<Result<AdminVerifiedArtistResult, DomainError>> {
	const parsed = setArtistVerifiedSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_ADMIN_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid artist verification parameters.'
		});
	}

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.slug, parsed.data.slug)
	});

	if (!artist) {
		return err({
			code: 'ARTIST_NOT_FOUND',
			message: `No artist found with handle "/a/${parsed.data.slug}".`
		});
	}

	await db
		.update(schema.artists)
		.set({
			verified: parsed.data.verified,
			updatedAt: new Date()
		})
		.where(eq(schema.artists.id, artist.id));

	return ok({
		artistId: artist.id,
		slug: artist.slug,
		displayName: artist.displayName,
		verified: parsed.data.verified
	});
}

/**
 * Lists handle-transfer petitions with live status of the existing artist holder.
 */
export async function listSlugPetitions(
	filterStatus?: string
): Promise<Result<AdminSlugPetitionSummary[], DomainError>> {
	const parsedFilter = petitionFilterSchema.safeParse(filterStatus);
	if (!parsedFilter.success) {
		return err({
			code: 'INVALID_FILTER',
			message: `Status filter must be one of: pending, approved, rejected, all.`
		});
	}

	const rows = await db.query.slugPetitions.findMany({
		where:
			parsedFilter.data && parsedFilter.data !== 'all'
				? eq(schema.slugPetitions.status, parsedFilter.data)
				: undefined,
		orderBy: [desc(schema.slugPetitions.createdAt)],
		with: {
			existingArtist: {
				columns: {
					id: true,
					slug: true,
					displayName: true,
					accountStatus: true
				}
			}
		}
	});

	return ok(
		rows.map((row) => ({
			id: row.id,
			requestedSlug: row.requestedSlug,
			existingArtistId: row.existingArtistId,
			existingArtistClosed: row.existingArtistClosed,
			existingArtistCurrentSlug: row.existingArtist?.slug ?? null,
			existingArtistDisplayName: row.existingArtist?.displayName ?? null,
			existingArtistStatus: row.existingArtist?.accountStatus ?? null,
			petitionerName: row.petitionerName,
			petitionerEmail: row.petitionerEmail,
			evidenceUrl: row.evidenceUrl,
			rationale: row.rationale,
			status: row.status,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}))
	);
}

/**
 * Approves a pending handle petition by retiring the departing artist's slug
 * (preserving artistId foreign keys so Issues & Fan Stubs remain intact),
 * marking the petition approved, and emailing the petitioner.
 */
export async function approveSlugPetition(input: {
	petitionId: string;
	note?: string;
	forceActiveOverride?: boolean;
}): Promise<Result<ApprovePetitionResult, DomainError>> {
	const parsed = petitionDecisionSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_ADMIN_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid petition approval parameters.'
		});
	}

	const petition = await db.query.slugPetitions.findFirst({
		where: eq(schema.slugPetitions.id, parsed.data.petitionId)
	});

	if (!petition) {
		return err({
			code: 'PETITION_NOT_FOUND',
			message: `Handle petition "${parsed.data.petitionId}" was not found.`
		});
	}

	if (petition.status !== SlugPetitionStatus.Pending) {
		return err({
			code: 'PETITION_ALREADY_RESOLVED',
			message: `Petition "${petition.id}" is already ${petition.status}.`
		});
	}

	const currentHolder = await db.query.artists.findFirst({
		where: eq(schema.artists.slug, petition.requestedSlug)
	});

	const now = new Date();
	let retiredArtistId: string | null = null;
	let retiredArtistNewSlug: string | null = null;

	if (currentHolder) {
		const isClosed = currentHolder.accountStatus === ArtistAccountStatus.Closed;
		if (!isClosed && !parsed.data.forceActiveOverride) {
			return err({
				code: 'EXISTING_ARTIST_ACTIVE',
				message: `Handle "/a/${petition.requestedSlug}" is still active (${currentHolder.displayName}). Close the existing account first or pass forceActiveOverride.`
			});
		}

		retiredArtistNewSlug = await generateRetiredSlug(currentHolder.slug);
		retiredArtistId = currentHolder.id;

		await db
			.update(schema.artists)
			.set({
				slug: retiredArtistNewSlug,
				updatedAt: now
			})
			.where(eq(schema.artists.id, currentHolder.id));
	}

	await db
		.update(schema.slugPetitions)
		.set({
			status: SlugPetitionStatus.Approved,
			updatedAt: now
		})
		.where(eq(schema.slugPetitions.id, petition.id));

	await sendSlugPetitionDecisionEmail({
		to: petition.petitionerEmail,
		petitionerName: petition.petitionerName,
		requestedSlug: petition.requestedSlug,
		decision: 'approved',
		note: parsed.data.note
	});

	return ok({
		petitionId: petition.id,
		releasedSlug: petition.requestedSlug,
		retiredArtistId,
		retiredArtistNewSlug,
		petitionerEmail: petition.petitionerEmail
	});
}

/**
 * Rejects a pending handle petition and sends a decision notification email.
 */
export async function rejectSlugPetition(input: {
	petitionId: string;
	note?: string;
}): Promise<Result<RejectPetitionResult, DomainError>> {
	const parsed = petitionDecisionSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_ADMIN_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid petition rejection parameters.'
		});
	}

	const petition = await db.query.slugPetitions.findFirst({
		where: eq(schema.slugPetitions.id, parsed.data.petitionId)
	});

	if (!petition) {
		return err({
			code: 'PETITION_NOT_FOUND',
			message: `Handle petition "${parsed.data.petitionId}" was not found.`
		});
	}

	if (petition.status !== SlugPetitionStatus.Pending) {
		return err({
			code: 'PETITION_ALREADY_RESOLVED',
			message: `Petition "${petition.id}" is already ${petition.status}.`
		});
	}

	await db
		.update(schema.slugPetitions)
		.set({
			status: SlugPetitionStatus.Rejected,
			updatedAt: new Date()
		})
		.where(eq(schema.slugPetitions.id, petition.id));

	await sendSlugPetitionDecisionEmail({
		to: petition.petitionerEmail,
		petitionerName: petition.petitionerName,
		requestedSlug: petition.requestedSlug,
		decision: 'rejected',
		note: parsed.data.note
	});

	return ok({
		petitionId: petition.id,
		requestedSlug: petition.requestedSlug,
		petitionerEmail: petition.petitionerEmail
	});
}
