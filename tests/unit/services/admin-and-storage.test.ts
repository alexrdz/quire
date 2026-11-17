import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ArtistAccountStatus, SlugPetitionStatus } from '$domain/account';
import { db, schema } from '$lib/server/db';
import { optimizeRasterImageBuffer, uploadMedia } from '$lib/server/services/storage';
import {
	approveSlugPetition,
	listSlugPetitions,
	rejectSlugPetition,
	setArtistVerifiedBySlug
} from '$lib/server/services/admin';

const createdUserIds: string[] = [];
const createdPetitionIds: string[] = [];
const uploadedKeys: string[] = [];

afterEach(async () => {
	while (uploadedKeys.length > 0) {
		const key = uploadedKeys.pop()!;
		try {
			await fs.unlink(path.resolve(process.cwd(), 'static/uploads', key));
		} catch {}
	}
	while (createdPetitionIds.length > 0) {
		const id = createdPetitionIds.pop()!;
		await db.delete(schema.slugPetitions).where(eq(schema.slugPetitions.id, id));
	}
	while (createdUserIds.length > 0) {
		const userId = createdUserIds.pop()!;
		await db.delete(schema.users).where(eq(schema.users.id, userId));
	}
});

async function seedArtistAndFanWithStub(opts: { accountStatus: 'active' | 'closed' }) {
	const suffix = crypto.randomBytes(4).toString('hex');
	const artistUserId = crypto.randomUUID();
	const fanUserId = crypto.randomUUID();
	const artistId = crypto.randomUUID();
	const issueId = crypto.randomUUID();
	const slug = `departed-band-${suffix}`;
	const now = new Date();

	createdUserIds.push(artistUserId, fanUserId);

	await db.insert(schema.users).values([
		{
			id: artistUserId,
			name: 'Departed Band',
			email: `departed-${suffix}@example.com`,
			emailVerified: true,
			accountType: 'artist',
			createdAt: now,
			updatedAt: now
		},
		{
			id: fanUserId,
			name: 'Loyal Fan',
			email: `loyalfan-${suffix}@example.com`,
			emailVerified: true,
			accountType: 'fan',
			createdAt: now,
			updatedAt: now
		}
	]);

	await db.insert(schema.artists).values({
		id: artistId,
		userId: artistUserId,
		slug,
		displayName: 'Departed Band',
		verified: false,
		accountStatus: opts.accountStatus,
		closedAt: opts.accountStatus === ArtistAccountStatus.Closed ? now : null,
		createdAt: now,
		updatedAt: now
	});

	await db.insert(schema.issues).values({
		id: issueId,
		artistId,
		slug: `${slug}-2026-09-01`,
		city: 'Portland',
		venue: 'Holocene',
		date: '2026-09-01',
		timezone: 'America/Los_Angeles',
		status: opts.accountStatus === ArtistAccountStatus.Closed ? 'archived' : 'published',
		archivedAt: opts.accountStatus === ArtistAccountStatus.Closed ? now : null,
		secretKey: `sec_${crypto.randomUUID()}`,
		stampWindowStart: now,
		stampWindowEnd: new Date(now.getTime() + 86400_000),
		publishedAt: now,
		createdAt: now,
		updatedAt: now
	});

	const collectionId = crypto.randomUUID();
	await db.insert(schema.collections).values({
		id: collectionId,
		fanUserId,
		issueId,
		kind: 'stamped',
		createdAt: now
	});

	return { artistId, slug, issueId, collectionId, suffix };
}

describe('Storage Media Optimization & Validation', () => {
	it('preserves SVG uploads untouched without raster conversion', async () => {
		const svgBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>');
		const res = await uploadMedia({
			filename: 'poster.svg',
			contentType: 'image/svg+xml',
			buffer: svgBytes,
			allowedKind: 'image'
		});

		expect(res.ok).toBe(true);
		if (!res.ok) return;
		uploadedKeys.push(res.value.key);

		expect(res.value.key.endsWith('.svg')).toBe(true);
		expect(res.value.url).toBe(`/uploads/${res.value.key}`);
	});

	it('falls back gracefully on optimizeRasterImageBuffer when sharp is absent or bytes are minimal', async () => {
		const pngStub = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		const optimized = await optimizeRasterImageBuffer(pngStub, 'image/png');
		expect(optimized.buffer.equals(pngStub)).toBe(true);
		expect(optimized.mimeType).toBe('image/png');

		const uploadRes = await uploadMedia({
			filename: 'cover.png',
			contentType: 'image/png',
			buffer: pngStub,
			allowedKind: 'image'
		});
		expect(uploadRes.ok).toBe(true);
		if (!uploadRes.ok) return;
		uploadedKeys.push(uploadRes.value.key);
		expect(uploadRes.value.key.endsWith('.png')).toBe(true);
	});
});

describe('Platform Admin Service', () => {
	it('verifies and unverifies artists by slug and handles unknown handles', async () => {
		const fixture = await seedArtistAndFanWithStub({ accountStatus: 'active' });

		const verifyRes = await setArtistVerifiedBySlug({ slug: fixture.slug, verified: true });
		expect(verifyRes.ok).toBe(true);
		if (!verifyRes.ok) return;
		expect(verifyRes.value.verified).toBe(true);

		const dbAfterVerify = await db.query.artists.findFirst({
			where: eq(schema.artists.id, fixture.artistId)
		});
		expect(dbAfterVerify?.verified).toBe(true);

		const unverifyRes = await setArtistVerifiedBySlug({ slug: fixture.slug, verified: false });
		expect(unverifyRes.ok).toBe(true);
		const dbAfterUnverify = await db.query.artists.findFirst({
			where: eq(schema.artists.id, fixture.artistId)
		});
		expect(dbAfterUnverify?.verified).toBe(false);

		const missingRes = await setArtistVerifiedBySlug({ slug: 'missing-band-xyz', verified: true });
		expect(missingRes.ok).toBe(false);
		if (!missingRes.ok) {
			expect(missingRes.error.code).toBe('ARTIST_NOT_FOUND');
		}
	});

	it('blocks approving a petition for an active artist unless forceActiveOverride is set', async () => {
		const fixture = await seedArtistAndFanWithStub({ accountStatus: 'active' });
		const petitionId = crypto.randomUUID();
		const now = new Date();
		createdPetitionIds.push(petitionId);

		await db.insert(schema.slugPetitions).values({
			id: petitionId,
			requestedSlug: fixture.slug,
			existingArtistId: fixture.artistId,
			existingArtistClosed: false,
			petitionerName: 'New Tour Band',
			petitionerEmail: `petitioner-${fixture.suffix}@example.com`,
			rationale: 'Registered trademark in the US',
			status: SlugPetitionStatus.Pending,
			createdAt: now,
			updatedAt: now
		});

		const refused = await approveSlugPetition({ petitionId });
		expect(refused.ok).toBe(false);
		if (!refused.ok) {
			expect(refused.error.code).toBe('EXISTING_ARTIST_ACTIVE');
		}

		const forced = await approveSlugPetition({
			petitionId,
			forceActiveOverride: true,
			note: 'Verified trademark dispute resolution'
		});
		expect(forced.ok).toBe(true);
		if (!forced.ok) return;
		expect(forced.value.releasedSlug).toBe(fixture.slug);
		expect(forced.value.retiredArtistNewSlug?.startsWith(`${fixture.slug}-retired-`)).toBe(true);
	});

	it('approves closed-artist handle petitions, retires slug cleanly, and preserves Fan Stubs & Issues', async () => {
		const fixture = await seedArtistAndFanWithStub({ accountStatus: 'closed' });
		const petitionId = crypto.randomUUID();
		const now = new Date();
		createdPetitionIds.push(petitionId);

		await db.insert(schema.slugPetitions).values({
			id: petitionId,
			requestedSlug: fixture.slug,
			existingArtistId: fixture.artistId,
			existingArtistClosed: true,
			petitionerName: 'Reformed Project',
			petitionerEmail: `claimant-${fixture.suffix}@example.com`,
			evidenceUrl: 'https://bandcamp.com/example',
			rationale: 'Original owner closed account and passed band rights to us.',
			status: SlugPetitionStatus.Pending,
			createdAt: now,
			updatedAt: now
		});

		const listRes = await listSlugPetitions(SlugPetitionStatus.Pending);
		expect(listRes.ok).toBe(true);
		if (listRes.ok) {
			const match = listRes.value.find((p) => p.id === petitionId);
			expect(match?.existingArtistStatus).toBe('closed');
		}

		const approveRes = await approveSlugPetition({ petitionId });
		expect(approveRes.ok).toBe(true);
		if (!approveRes.ok) return;

		expect(approveRes.value.releasedSlug).toBe(fixture.slug);
		expect(approveRes.value.retiredArtistId).toBe(fixture.artistId);
		expect(approveRes.value.retiredArtistNewSlug?.startsWith(`${fixture.slug}-retired-`)).toBe(true);

		// Original requested slug is now free for lookup
		const holderAtOldSlug = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, fixture.slug)
		});
		expect(holderAtOldSlug).toBeUndefined();

		// Fan Stub and archived Issue remain linked to artistId
		const stub = await db.query.collections.findFirst({
			where: eq(schema.collections.id, fixture.collectionId)
		});
		expect(stub?.issueId).toBe(fixture.issueId);
		const issue = await db.query.issues.findFirst({
			where: eq(schema.issues.id, fixture.issueId)
		});
		expect(issue?.artistId).toBe(fixture.artistId);
	});

	it('rejects a pending petition and prevents duplicate resolution', async () => {
		const fixture = await seedArtistAndFanWithStub({ accountStatus: 'closed' });
		const petitionId = crypto.randomUUID();
		const now = new Date();
		createdPetitionIds.push(petitionId);

		await db.insert(schema.slugPetitions).values({
			id: petitionId,
			requestedSlug: fixture.slug,
			existingArtistId: fixture.artistId,
			existingArtistClosed: true,
			petitionerName: 'Random Squat',
			petitionerEmail: `reject-${fixture.suffix}@example.com`,
			rationale: 'No affiliation',
			status: SlugPetitionStatus.Pending,
			createdAt: now,
			updatedAt: now
		});

		const rejectRes = await rejectSlugPetition({
			petitionId,
			note: 'Insufficient ownership evidence.'
		});
		expect(rejectRes.ok).toBe(true);

		const row = await db.query.slugPetitions.findFirst({
			where: eq(schema.slugPetitions.id, petitionId)
		});
		expect(row?.status).toBe(SlugPetitionStatus.Rejected);

		const doubleApprove = await approveSlugPetition({ petitionId });
		expect(doubleApprove.ok).toBe(false);
		if (!doubleApprove.ok) {
			expect(doubleApprove.error.code).toBe('PETITION_ALREADY_RESOLVED');
		}
	});
});
