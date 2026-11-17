import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { hashPassword, makeSignature } from 'better-auth/crypto';
import { db, schema } from '$lib/server/db';
import { authSecret } from '$lib/server/auth';
import { checkAccentContrast } from '$domain/theme';
import { actions, load } from '../../../src/routes/(site)/dashboard/template/+page.server';

interface TestArtistFixture {
	userId: string;
	artistId: string;
	cookie: string;
}

const createdFixtures: TestArtistFixture[] = [];
const uploadedFilesToClean: string[] = [];

async function createTestArtistFixture(): Promise<TestArtistFixture> {
	const userId = crypto.randomUUID();
	const artistId = crypto.randomUUID();
	const email = `p3-template-${crypto.randomUUID()}@example.com`;
	const sessionToken = `test_p3_session_${crypto.randomUUID()}`;
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24);
	const passwordHash = await hashPassword('test-band-password-123');

	await db.insert(schema.users).values({
		id: userId,
		name: 'Neon Static',
		email,
		emailVerified: true,
		accountType: 'artist',
		createdAt: now,
		updatedAt: now
	});

	await db.insert(schema.accounts).values({
		id: crypto.randomUUID(),
		userId,
		accountId: userId,
		providerId: 'credential',
		password: passwordHash,
		createdAt: now,
		updatedAt: now
	});

	await db.insert(schema.sessions).values({
		id: crypto.randomUUID(),
		userId,
		token: sessionToken,
		expiresAt,
		createdAt: now,
		updatedAt: now
	});

	await db.insert(schema.artists).values({
		id: artistId,
		userId,
		slug: `neon-static-${crypto.randomUUID().slice(0, 6)}`,
		displayName: 'Neon Static',
		createdAt: now,
		updatedAt: now
	});

	const signature = await makeSignature(sessionToken, authSecret);
	const fixture = {
		userId,
		artistId,
		cookie: `better-auth.session_token=${sessionToken}.${signature}`
	};
	createdFixtures.push(fixture);
	return fixture;
}

function trackUploadUrl(url: string | null | undefined) {
	if (url && url.startsWith('/uploads/')) {
		const filename = url.slice('/uploads/'.length);
		if (filename) {
			uploadedFilesToClean.push(path.resolve(process.cwd(), 'static/uploads', filename));
		}
	}
}

function buildMultipartRequest(cookie: string, formData: FormData): Request {
	return new Request('http://localhost:4173/dashboard/template', {
		method: 'POST',
		headers: {
			cookie
		},
		body: formData
	});
}

afterEach(async () => {
	while (createdFixtures.length > 0) {
		const fixture = createdFixtures.pop()!;
		const pages = await db.query.templatePages.findMany({
			where: eq(schema.templatePages.artistId, fixture.artistId)
		});
		for (const page of pages) {
			try {
				const content = JSON.parse(page.contentJson);
				trackUploadUrl(content.audioUrl);
				trackUploadUrl(content.imageUrl);
			} catch {}
		}
		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.id, fixture.artistId)
		});
		trackUploadUrl(artist?.coverArtUrl);

		await db.delete(schema.templatePages).where(eq(schema.templatePages.artistId, fixture.artistId));
		await db.delete(schema.artists).where(eq(schema.artists.id, fixture.artistId));
		await db.delete(schema.sessions).where(eq(schema.sessions.userId, fixture.userId));
		await db.delete(schema.accounts).where(eq(schema.accounts.userId, fixture.userId));
		await db.delete(schema.users).where(eq(schema.users.id, fixture.userId));
	}

	while (uploadedFilesToClean.length > 0) {
		const filePath = uploadedFilesToClean.pop()!;
		await fs.rm(filePath, { force: true });
	}
});

describe('Master Template +page.server', () => {
	it('loads artist template and ordered recurring pages', async () => {
		const fixture = await createTestArtistFixture();
		const req = new Request('http://localhost:4173/dashboard/template', {
			headers: { cookie: fixture.cookie }
		});
		const data = (await (load as any)({ request: req })) as any;
		expect(data.artist.id).toBe(fixture.artistId);
		expect(data.tipPresets).toEqual([3, 5, 10]);
	});

	it('auto-adjusts low-contrast accentColor to WCAG AA suggestedHex and saves template', async () => {
		const fixture = await createTestArtistFixture();
		const formData = new FormData();
		formData.set('accentColor', '#1A1025');
		formData.set('typePairing', 'serif');
		formData.set('coverArtUrl', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a');
		formData.set('bio', 'Synth-punk trio from Montreal.');
		formData.set('preset1', '3');
		formData.set('preset2', '7');
		formData.set('preset3', '15');
		formData.append('linkLabel', 'Bandcamp');
		formData.append('linkUrl', 'https://neonstatic.bandcamp.com');

		const result = (await (actions.saveTemplate as any)({
			request: buildMultipartRequest(fixture.cookie, formData)
		})) as any;

		expect(result.success).toBe(true);
		expect(result.contrastAdjusted).toBe(true);
		expect(result.adjustedFrom).toBe('#1A1025');
		expect(result.adjustedTo).toMatch(/^#[0-9A-F]{6}$/);
		expect(checkAccentContrast(result.adjustedTo).ok).toBe(true);

		const updated = await db.query.artists.findFirst({
			where: eq(schema.artists.id, fixture.artistId)
		});
		expect(updated?.accentColor).toBe(result.adjustedTo);
		expect(updated?.typePairing).toBe('serif');
		expect(updated?.tipPresetsJson).toBe('[3,7,15]');
	});

	it('uploads coverArtFile and rejects invalid coverArtFile MIME types', async () => {
		const fixture = await createTestArtistFixture();
		const validForm = new FormData();
		validForm.set('accentColor', '#05D9E8');
		validForm.set('typePairing', 'sans-serif');
		validForm.set(
			'coverArtFile',
			new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'cover.png', {
				type: 'image/png'
			})
		);

		const uploadRes = (await (actions.saveTemplate as any)({
			request: buildMultipartRequest(fixture.cookie, validForm)
		})) as any;
		expect(uploadRes.success).toBe(true);

		const updated = await db.query.artists.findFirst({
			where: eq(schema.artists.id, fixture.artistId)
		});
		expect(updated?.coverArtUrl).toMatch(/^\/uploads\/[a-zA-Z0-9-]+\.png$/);

		const invalidForm = new FormData();
		invalidForm.set('accentColor', '#05D9E8');
		invalidForm.set('typePairing', 'sans-serif');
		invalidForm.set(
			'coverArtFile',
			new File(['not-an-image'], 'notes.txt', { type: 'text/plain' })
		);

		const invalidRes = (await (actions.saveTemplate as any)({
			request: buildMultipartRequest(fixture.cookie, invalidForm)
		})) as any;
		expect(invalidRes.status).toBe(400);
	});

	it('supports adding, editing, reordering, and deleting recurring pages with audio/photo/video media', async () => {
		const fixture = await createTestArtistFixture();

		// 1. Add audio page via file upload
		const audioForm = new FormData();
		audioForm.set('kind', 'audio');
		audioForm.set('title', 'Basement Tape Demo');
		audioForm.set('duration', '04:12');
		audioForm.set('body', 'Recorded on 4-track cassette.');
		audioForm.set(
			'audioFile',
			new File([new Uint8Array([73, 68, 51, 3, 0])], 'demo.mp3', { type: 'audio/mpeg' })
		);
		const addAudioRes = (await (actions.addTemplatePage as any)({
			request: buildMultipartRequest(fixture.cookie, audioForm)
		})) as any;
		expect(addAudioRes.pageAdded).toBe(true);

		// 2. Add photo page via photoFile upload
		const photoForm = new FormData();
		photoForm.set('kind', 'photo');
		photoForm.set('title', 'Soundcheck');
		photoForm.set('body', 'Before doors opened.');
		photoForm.set(
			'photoFile',
			new File([new Uint8Array([255, 216, 255, 224])], 'soundcheck.jpg', {
				type: 'image/jpeg'
			})
		);
		const addPhotoRes = (await (actions.addTemplatePage as any)({
			request: buildMultipartRequest(fixture.cookie, photoForm)
		})) as any;
		expect(addPhotoRes.pageAdded).toBe(true);

		// 3. Add video page via URL
		const videoForm = new FormData();
		videoForm.set('kind', 'video');
		videoForm.set('title', 'Live Session Video');
		videoForm.set('videoUrl', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
		videoForm.set('body', 'Full live take.');
		const addVideoRes = (await (actions.addTemplatePage as any)({
			request: buildMultipartRequest(fixture.cookie, videoForm)
		})) as any;
		expect(addVideoRes.pageAdded).toBe(true);

		let pages = await db.query.templatePages.findMany({
			where: eq(schema.templatePages.artistId, fixture.artistId),
			orderBy: [asc(schema.templatePages.position)]
		});
		expect(pages).toHaveLength(3);
		expect(JSON.parse(pages[0].contentJson).audioUrl).toMatch(/^\/uploads\/.+\.mp3$/);
		expect(JSON.parse(pages[1].contentJson).imageUrl).toMatch(/^\/uploads\/.+\.jpg$/);
		expect(JSON.parse(pages[2].contentJson).videoUrl).toBe(
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
		);

		// 4. Edit audio page to use Bandcamp embed URL
		const editForm = new FormData();
		editForm.set('pageId', pages[0].id);
		editForm.set('kind', 'audio');
		editForm.set('title', 'Basement Tape (Remaster)');
		editForm.set('duration', '04:18');
		editForm.set('audioUrl', 'https://neonstatic.bandcamp.com/track/basement-tape');
		editForm.set('body', 'Remastered for tour.');
		const editRes = (await (actions.editTemplatePage as any)({
			request: buildMultipartRequest(fixture.cookie, editForm)
		})) as any;
		expect(editRes.pageUpdated).toBe(true);

		// 5. Move third page up, then first page down
		const moveForm = new FormData();
		moveForm.set('pageId', pages[2].id);
		moveForm.set('direction', 'up');
		const moveRes = (await (actions.moveTemplatePage as any)({
			request: buildMultipartRequest(fixture.cookie, moveForm)
		})) as any;
		expect(moveRes.pageMoved).toBe(true);

		pages = await db.query.templatePages.findMany({
			where: eq(schema.templatePages.artistId, fixture.artistId),
			orderBy: [asc(schema.templatePages.position)]
		});
		expect(pages.map((p) => p.kind)).toEqual(['audio', 'video', 'photo']);
		expect(JSON.parse(pages[0].contentJson).title).toBe('Basement Tape (Remaster)');
		expect(JSON.parse(pages[0].contentJson).audioUrl).toBe(
			'https://neonstatic.bandcamp.com/track/basement-tape'
		);

		// 6. Delete middle page
		const delForm = new FormData();
		delForm.set('pageId', pages[1].id);
		const delRes = (await (actions.deleteTemplatePage as any)({
			request: buildMultipartRequest(fixture.cookie, delForm)
		})) as any;
		expect(delRes.pageDeleted).toBe(true);

		pages = await db.query.templatePages.findMany({
			where: eq(schema.templatePages.artistId, fixture.artistId),
			orderBy: [asc(schema.templatePages.position)]
		});
		expect(pages.map((p) => p.kind)).toEqual(['audio', 'photo']);
	});
});
