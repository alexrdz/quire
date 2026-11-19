import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { hashPassword, makeSignature } from 'better-auth/crypto';
import { db, schema } from '$lib/server/db';
import { authSecret } from '$lib/server/auth';
import { actions as quickActions } from '../../../src/routes/(site)/dashboard/issues/quick/+page.server';
import {
	actions as bookbinderActions,
	load as bookbinderLoad
} from '../../../src/routes/(site)/dashboard/bookbinder/[id]/+page.server';
import { load as readerLoad } from '../../../src/routes/(zine)/i/[slug]/+page.server';
import { TINY_JPEG, TINY_MP3, TINY_PNG } from '../helpers/media';
import { seedDatabase } from '$lib/server/seed';

interface TestArtistFixture {
	userId: string;
	artistId: string;
	slug: string;
	cookie: string;
}

const createdFixtures: TestArtistFixture[] = [];
const uploadedFilesToClean: string[] = [];

async function createTestArtistFixture(label = 'p4-band'): Promise<TestArtistFixture> {
	const userId = crypto.randomUUID();
	const artistId = crypto.randomUUID();
	const suffix = crypto.randomUUID().slice(0, 6);
	const slug = `${label}-${suffix}`;
	const email = `${slug}@example.com`;
	const sessionToken = `test_p4_session_${crypto.randomUUID()}`;
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24);
	const passwordHash = await hashPassword('test-band-password-123');

	await db.insert(schema.users).values({
		id: userId,
		name: `Band ${suffix}`,
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
		slug,
		displayName: `Band ${suffix}`,
		createdAt: now,
		updatedAt: now
	});

	const signature = await makeSignature(sessionToken, authSecret);
	const fixture = {
		userId,
		artistId,
		slug,
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

function buildPostRequest(urlStr: string, cookie: string, formData: FormData): Request {
	return new Request(urlStr, {
		method: 'POST',
		headers: { cookie },
		body: formData
	});
}

// Creates the tables and sample data on a fresh test database (no route seeds any more).
beforeAll(async () => {
	await seedDatabase();
});

afterEach(async () => {
	while (createdFixtures.length > 0) {
		const fixture = createdFixtures.pop()!;
		const issues = await db.query.issues.findMany({
			where: eq(schema.issues.artistId, fixture.artistId),
			with: { issuePages: true }
		});
		for (const issue of issues) {
			for (const page of issue.issuePages) {
				try {
					const parsed = JSON.parse(page.contentJson);
					trackUploadUrl(parsed.imageUrl);
					if (Array.isArray(parsed.photos)) {
						for (const photo of parsed.photos) trackUploadUrl(photo?.url);
					}
					trackUploadUrl(parsed.audioUrl);
					trackUploadUrl(parsed.videoUrl);
				} catch {}
			}
			await db.delete(schema.issuePages).where(eq(schema.issuePages.issueId, issue.id));
		}
		await db.delete(schema.issues).where(eq(schema.issues.artistId, fixture.artistId));
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

describe('P4 Quick Issue + Bookbinder + Reader', () => {
	it('Quick Issue publishes with optional uploaded photoFile and setlist', async () => {
		const fixture = await createTestArtistFixture('quick-pub');

		const formData = new FormData();
		formData.set('city', 'Philadelphia');
		formData.set('venue', "Johnny Brenda's");
		formData.set('date', '2026-11-20');
		formData.set('timezone', 'America/New_York');
		formData.set('coverNote', 'Doors at 8pm');
		formData.set('setlistSongs', 'Static Bloom, Velvet Wire');
		formData.set('photoCaption', 'Soundcheck on Frankford Ave');
		formData.set('saveMode', 'published');
		formData.set(
			'photoFile',
			new File([TINY_PNG], 'soundcheck.png', {
				type: 'image/png'
			})
		);

		const reqUrl = new URL('http://localhost:4173/dashboard/issues/quick');
		const result = (await (quickActions.default as any)({
			request: buildPostRequest(reqUrl.toString(), fixture.cookie, formData),
			url: reqUrl
		})) as any;

		expect(result.success).toBe(true);
		expect(result.qrSvg).toContain('<svg');
		expect(result.issueUrl).toBe(`/i/${result.slug}`);

		const issue = await db.query.issues.findFirst({
			where: eq(schema.issues.id, result.issueId),
			with: { issuePages: { orderBy: [asc(schema.issuePages.position)] } }
		});
		expect(issue?.status).toBe('published');
		expect(issue?.publishedAt).toBeInstanceOf(Date);
		expect(issue?.issuePages).toHaveLength(2);
		expect(issue?.issuePages[0].kind).toBe('setlist');
		expect(issue?.issuePages[1].kind).toBe('photo');

		const photoContent = JSON.parse(issue!.issuePages[1].contentJson);
		expect(photoContent.imageUrl).toMatch(/^\/uploads\/.+\.webp$/);
		expect(photoContent.body).toBe('Soundcheck on Frankford Ave');
	});

	it('Quick Issue saveMode=draft creates a draft and redirects to Bookbinder', async () => {
		const fixture = await createTestArtistFixture('quick-draft');

		const formData = new FormData();
		formData.set('city', 'Brooklyn');
		formData.set('venue', 'Baby’s All Right');
		formData.set('date', '2026-11-21');
		formData.set('timezone', 'America/New_York');
		formData.set('photoUrl', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a');
		formData.set('saveMode', 'draft');

		const reqUrl = new URL('http://localhost:4173/dashboard/issues/quick');

		try {
			await (quickActions.default as any)({
				request: buildPostRequest(reqUrl.toString(), fixture.cookie, formData),
				url: reqUrl
			});
			expect.unreachable('Expected 303 redirect to bookbinder');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toMatch(/^\/dashboard\/bookbinder\/[a-f0-9-]+$/);

			const issueId = err.location.split('/').pop()!;
			const issue = await db.query.issues.findFirst({
				where: eq(schema.issues.id, issueId),
				with: { issuePages: true }
			});
			expect(issue?.status).toBe('draft');
			expect(issue?.publishedAt).toBeNull();
			expect(issue?.issuePages).toHaveLength(1);
			expect(issue?.issuePages[0].kind).toBe('photo');
		}
	});

	it('Bookbinder enforces Issue Lifecycle FSM and rejects illegal transitions', async () => {
		const fixture = await createTestArtistFixture('fsm-band');
		const now = new Date();
		const issueId = crypto.randomUUID();
		await db.insert(schema.issues).values({
			id: issueId,
			artistId: fixture.artistId,
			slug: `fsm-chicago-${issueId.slice(0, 6)}`,
			city: 'Chicago',
			venue: 'Empty Bottle',
			date: '2026-11-22',
			timezone: 'America/Chicago',
			coverNote: '',
			secretKey: 'secret123',
			status: 'draft',
			createdAt: now,
			updatedAt: now
		});

		const saveUrl = `http://localhost:4173/dashboard/bookbinder/${issueId}?/save`;

		// Illegal: draft -> archived
		const draftToArchive = new FormData();
		draftToArchive.set('city', 'Chicago');
		draftToArchive.set('venue', 'Empty Bottle');
		draftToArchive.set('date', '2026-11-22');
		draftToArchive.set('status', 'archived');
		const badArchive = (await (bookbinderActions.save as any)({
			request: buildPostRequest(saveUrl, fixture.cookie, draftToArchive),
			params: { id: issueId }
		})) as any;
		expect(badArchive.status).toBe(400);
		expect(badArchive.data.error).toContain("Cannot archive an issue with status 'draft'");

		// Legal: draft -> published (sets publishedAt)
		const draftToPub = new FormData();
		draftToPub.set('city', 'Chicago');
		draftToPub.set('venue', 'Empty Bottle');
		draftToPub.set('date', '2026-11-22');
		draftToPub.set('status', 'published');
		const pubRes = (await (bookbinderActions.save as any)({
			request: buildPostRequest(saveUrl, fixture.cookie, draftToPub),
			params: { id: issueId }
		})) as any;
		expect(pubRes.success).toBe(true);

		let updated = await db.query.issues.findFirst({ where: eq(schema.issues.id, issueId) });
		expect(updated?.status).toBe('published');
		expect(updated?.publishedAt).toBeInstanceOf(Date);

		// Illegal: published -> draft
		const pubToDraft = new FormData();
		pubToDraft.set('city', 'Chicago');
		pubToDraft.set('venue', 'Empty Bottle');
		pubToDraft.set('date', '2026-11-22');
		pubToDraft.set('status', 'draft');
		const badDraft = (await (bookbinderActions.save as any)({
			request: buildPostRequest(saveUrl, fixture.cookie, pubToDraft),
			params: { id: issueId }
		})) as any;
		expect(badDraft.status).toBe(400);
		expect(badDraft.data.error).toContain("back to 'draft'");

		// Legal: published -> archived (sets archivedAt)
		const pubToArch = new FormData();
		pubToArch.set('city', 'Chicago');
		pubToArch.set('venue', 'Empty Bottle');
		pubToArch.set('date', '2026-11-22');
		pubToArch.set('status', 'archived');
		const archRes = (await (bookbinderActions.save as any)({
			request: buildPostRequest(saveUrl, fixture.cookie, pubToArch),
			params: { id: issueId }
		})) as any;
		expect(archRes.success).toBe(true);

		updated = await db.query.issues.findFirst({ where: eq(schema.issues.id, issueId) });
		expect(updated?.status).toBe('archived');
		expect(updated?.archivedAt).toBeInstanceOf(Date);

		// Illegal: archived -> published
		const archToPub = new FormData();
		archToPub.set('city', 'Chicago');
		archToPub.set('venue', 'Empty Bottle');
		archToPub.set('date', '2026-11-22');
		archToPub.set('status', 'published');
		const badRepub = (await (bookbinderActions.save as any)({
			request: buildPostRequest(saveUrl, fixture.cookie, archToPub),
			params: { id: issueId }
		})) as any;
		expect(badRepub.status).toBe(400);
		expect(badRepub.data.error).toContain("Cannot publish an issue with status 'archived'");
	});

	it('Bookbinder verifies ownership across save, addPage, updatePage, movePage, and deletePage', async () => {
		const owner = await createTestArtistFixture('owner-band');
		const intruder = await createTestArtistFixture('intruder-band');
		const now = new Date();
		const issueId = crypto.randomUUID();
		const pageId = crypto.randomUUID();

		await db.insert(schema.issues).values({
			id: issueId,
			artistId: owner.artistId,
			slug: `owner-show-${issueId.slice(0, 6)}`,
			city: 'Austin',
			venue: 'Mohawk',
			date: '2026-11-23',
			timezone: 'America/Chicago',
			coverNote: '',
			secretKey: 'ownerkey',
			status: 'published',
			publishedAt: now,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(schema.issuePages).values({
			id: pageId,
			issueId,
			position: 1,
			kind: 'text',
			contentJson: JSON.stringify({ title: 'Owner Note', body: 'Do not touch' }),
			createdAt: now
		});

		const baseUrl = `http://localhost:4173/dashboard/bookbinder/${issueId}`;

		const saveAttempt = new FormData();
		saveAttempt.set('city', 'Hacked');
		saveAttempt.set('venue', 'Hacked');
		saveAttempt.set('date', '2026-11-23');
		saveAttempt.set('status', 'published');
		const resSave = (await (bookbinderActions.save as any)({
			request: buildPostRequest(`${baseUrl}?/save`, intruder.cookie, saveAttempt),
			params: { id: issueId }
		})) as any;
		expect(resSave.status).toBe(403);

		const updateAttempt = new FormData();
		updateAttempt.set('pageId', pageId);
		updateAttempt.set('kind', 'text');
		updateAttempt.set('title', 'Hacked');
		const resUpdate = (await (bookbinderActions.updatePage as any)({
			request: buildPostRequest(`${baseUrl}?/updatePage`, intruder.cookie, updateAttempt),
			params: { id: issueId }
		})) as any;
		expect(resUpdate.status).toBe(403);

		const moveAttempt = new FormData();
		moveAttempt.set('pageId', pageId);
		moveAttempt.set('direction', 'up');
		const resMove = (await (bookbinderActions.movePage as any)({
			request: buildPostRequest(`${baseUrl}?/movePage`, intruder.cookie, moveAttempt),
			params: { id: issueId }
		})) as any;
		expect(resMove.status).toBe(403);

		const addAttempt = new FormData();
		addAttempt.set('kind', 'text');
		addAttempt.set('title', 'Intruder');
		const resAdd = (await (bookbinderActions.addPage as any)({
			request: buildPostRequest(`${baseUrl}?/addPage`, intruder.cookie, addAttempt),
			params: { id: issueId }
		})) as any;
		expect(resAdd.status).toBe(403);

		const deleteAttempt = new FormData();
		deleteAttempt.set('pageId', pageId);
		const resDelete = (await (bookbinderActions.deletePage as any)({
			request: buildPostRequest(`${baseUrl}?/deletePage`, intruder.cookie, deleteAttempt),
			params: { id: issueId }
		})) as any;
		expect(resDelete.status).toBe(403);

		const intactPage = await db.query.issuePages.findFirst({
			where: eq(schema.issuePages.id, pageId)
		});
		expect(intactPage).toBeDefined();
		expect(JSON.parse(intactPage!.contentJson).title).toBe('Owner Note');
	});

	it('Bookbinder supports photo upload, audio upload, video embed URL, and Issue Reader loads them', async () => {
		const fixture = await createTestArtistFixture('media-band');
		const now = new Date();
		const issueId = crypto.randomUUID();
		const slug = `media-show-${issueId.slice(0, 6)}`;

		await db.insert(schema.issues).values({
			id: issueId,
			artistId: fixture.artistId,
			slug,
			city: 'Seattle',
			venue: 'Neumos',
			date: '2026-11-24',
			timezone: 'America/Los_Angeles',
			coverNote: 'All ages tonight',
			secretKey: 'mediakey',
			status: 'published',
			publishedAt: now,
			createdAt: now,
			updatedAt: now
		});

		const baseUrl = `http://localhost:4173/dashboard/bookbinder/${issueId}`;

		// 1. Add photo page via upload
		const photoForm = new FormData();
		photoForm.set('kind', 'photo');
		photoForm.set('title', 'Stage Rig');
		photoForm.set('body', 'Pedalboard close-up');
		photoForm.set(
			'photoFile',
			new File([TINY_JPEG], 'rig.jpg', { type: 'image/jpeg' })
		);
		const addPhoto = (await (bookbinderActions.addPage as any)({
			request: buildPostRequest(`${baseUrl}?/addPage`, fixture.cookie, photoForm),
			params: { id: issueId }
		})) as any;
		expect(addPhoto.success).toBe(true);

		// 2. Add audio page via upload
		const audioForm = new FormData();
		audioForm.set('kind', 'audio');
		audioForm.set('title', 'Rough Demo 01');
		audioForm.set('duration', '02:58');
		audioForm.set('body', '4-track bounce');
		audioForm.set(
			'audioFile',
			new File([TINY_MP3], 'rough.mp3', { type: 'audio/mpeg' })
		);
		const addAudio = (await (bookbinderActions.addPage as any)({
			request: buildPostRequest(`${baseUrl}?/addPage`, fixture.cookie, audioForm),
			params: { id: issueId }
		})) as any;
		expect(addAudio.success).toBe(true);

		// 3. Add video page via embedUrl / videoUrl
		const videoForm = new FormData();
		videoForm.set('kind', 'video');
		videoForm.set('title', 'Live at Neumos Clip');
		videoForm.set('embedUrl', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
		videoForm.set('body', 'Encore clip');
		const addVideo = (await (bookbinderActions.addPage as any)({
			request: buildPostRequest(`${baseUrl}?/addPage`, fixture.cookie, videoForm),
			params: { id: issueId }
		})) as any;
		expect(addVideo.success).toBe(true);

		// Verify Bookbinder load
		const bbData = (await (bookbinderLoad as any)({
			params: { id: issueId },
			request: new Request(baseUrl, { headers: { cookie: fixture.cookie } })
		})) as any;
		expect(bbData.pages).toHaveLength(3);
		// The configured app URL (local default in test), not the request's localhost:4173.
		expect(bbData.issueUrl).toBe(`http://localhost:5173/i/${slug}`);

		// Verify Issue Reader load
		const cookiesMap = new Map<string, string>();
		const readerData = (await (readerLoad as any)({
			params: { slug },
			cookies: { get: (k: string) => cookiesMap.get(k) },
			request: new Request(`http://localhost:4173/i/${slug}`)
		})) as any;

		expect(readerData.issuePages).toHaveLength(3);
		const [pPhoto, pAudio, pVideo] = readerData.issuePages;
		expect(JSON.parse(pPhoto.contentJson).imageUrl).toMatch(/^\/uploads\/.+\.webp$/);
		expect(JSON.parse(pAudio.contentJson).audioUrl).toMatch(/^\/uploads\/.+\.mp3$/);
		expect(JSON.parse(pVideo.contentJson).videoUrl).toBe(
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
		);
	});
});

describe('Bookbinder photo pile pages', () => {
	async function createPublishedIssue(label: string) {
		const fixture = await createTestArtistFixture(label);
		const now = new Date();
		const issueId = crypto.randomUUID();
		const slug = `pile-show-${issueId.slice(0, 6)}`;
		await db.insert(schema.issues).values({
			id: issueId,
			artistId: fixture.artistId,
			slug,
			city: 'Portland',
			venue: 'Doug Fir',
			date: '2026-12-02',
			timezone: 'America/Los_Angeles',
			coverNote: '',
			secretKey: 'pilekey',
			status: 'published',
			publishedAt: now,
			createdAt: now,
			updatedAt: now
		});
		return {
			fixture,
			issueId,
			baseUrl: `http://localhost:4173/dashboard/bookbinder/${issueId}`
		};
	}

	function jpeg(name: string): File {
		return new File([TINY_JPEG], name, { type: 'image/jpeg' });
	}

	async function readPage(issueId: string) {
		const pages = await db.query.issuePages.findMany({
			where: eq(schema.issuePages.issueId, issueId),
			orderBy: [asc(schema.issuePages.position)]
		});
		return pages.map((p) => ({ id: p.id, content: JSON.parse(p.contentJson) }));
	}

	it('stores several uploaded photos plus a URL on one photo page, in order', async () => {
		const { fixture, issueId, baseUrl } = await createPublishedIssue('pile-add');
		const form = new FormData();
		form.set('kind', 'photo');
		form.set('title', 'Load-in');
		form.append('photoFile', jpeg('one.jpg'));
		form.append('photoFile', jpeg('two.jpg'));
		form.append('photoFile', jpeg('three.jpg'));
		form.set('imageUrl', 'https://images.example.com/four.jpg');

		const res = (await (bookbinderActions.addPage as any)({
			request: buildPostRequest(`${baseUrl}?/addPage`, fixture.cookie, form),
			params: { id: issueId }
		})) as any;
		expect(res.success).toBe(true);

		const [page] = await readPage(issueId);
		expect(page.content.photos).toHaveLength(4);
		for (const photo of page.content.photos.slice(0, 3)) {
			expect(photo.url).toMatch(/^\/uploads\/.+\.webp$/);
		}
		expect(page.content.photos[3].url).toBe('https://images.example.com/four.jpg');
		expect(page.content.imageUrl).toBe(page.content.photos[0].url);
	});

	it('reorders, captions and removes photos when the page is updated', async () => {
		const { fixture, issueId, baseUrl } = await createPublishedIssue('pile-edit');
		const addForm = new FormData();
		addForm.set('kind', 'photo');
		addForm.append('photoFile', jpeg('a.jpg'));
		addForm.append('photoFile', jpeg('b.jpg'));
		addForm.append('photoFile', jpeg('c.jpg'));
		await (bookbinderActions.addPage as any)({
			request: buildPostRequest(`${baseUrl}?/addPage`, fixture.cookie, addForm),
			params: { id: issueId }
		});
		const [created] = await readPage(issueId);
		const [a, b, c] = created.content.photos.map((p: { url: string }) => p.url);

		// Keep c then a (b removed), with captions.
		const editForm = new FormData();
		editForm.set('pageId', created.id);
		editForm.set('kind', 'photo');
		editForm.append('keepPhotoUrl', c);
		editForm.append('keepPhotoCaption', '  Merch table  ');
		editForm.append('keepPhotoUrl', a);
		editForm.append('keepPhotoCaption', '');
		const res = (await (bookbinderActions.updatePage as any)({
			request: buildPostRequest(`${baseUrl}?/updatePage`, fixture.cookie, editForm),
			params: { id: issueId }
		})) as any;
		expect(res.success).toBe(true);

		const [updated] = await readPage(issueId);
		expect(updated.content.photos).toEqual([{ url: c, caption: 'Merch table' }, { url: a }]);
		expect(updated.content.imageUrl).toBe(c);
		expect(JSON.stringify(updated.content)).not.toContain(b);
		trackUploadUrl(b);
	});

	it('upgrades a legacy single-image page to a photos array on save', async () => {
		const { fixture, issueId, baseUrl } = await createPublishedIssue('pile-legacy');
		const pageId = crypto.randomUUID();
		await db.insert(schema.issuePages).values({
			id: pageId,
			issueId,
			position: 1,
			kind: 'photo',
			contentJson: JSON.stringify({ title: 'Old', imageUrl: 'https://images.example.com/old.jpg' }),
			createdAt: new Date()
		});

		const form = new FormData();
		form.set('pageId', pageId);
		form.set('kind', 'photo');
		form.set('title', 'Old');
		form.append('keepPhotoUrl', 'https://images.example.com/old.jpg');
		form.append('keepPhotoCaption', '');
		form.set('imageUrl', 'https://images.example.com/new.jpg');
		const res = (await (bookbinderActions.updatePage as any)({
			request: buildPostRequest(`${baseUrl}?/updatePage`, fixture.cookie, form),
			params: { id: issueId }
		})) as any;
		expect(res.success).toBe(true);

		const [page] = await readPage(issueId);
		expect(page.content.photos).toEqual([
			{ url: 'https://images.example.com/old.jpg' },
			{ url: 'https://images.example.com/new.jpg' }
		]);
	});

	it('rejects more than 12 photos, long captions and bad URLs', async () => {
		const { fixture, issueId, baseUrl } = await createPublishedIssue('pile-limits');
		const post = async (form: FormData) =>
			(await (bookbinderActions.addPage as any)({
				request: buildPostRequest(`${baseUrl}?/addPage`, fixture.cookie, form),
				params: { id: issueId }
			})) as any;

		const tooMany = new FormData();
		tooMany.set('kind', 'photo');
		for (let i = 0; i < 13; i++) {
			tooMany.append('keepPhotoUrl', `https://images.example.com/${i}.jpg`);
			tooMany.append('keepPhotoCaption', '');
		}
		const tooManyRes = await post(tooMany);
		expect(tooManyRes.status).toBe(400);
		expect(tooManyRes.data.error).toMatch(/at most 12/);

		const longCaption = new FormData();
		longCaption.set('kind', 'photo');
		longCaption.append('keepPhotoUrl', 'https://images.example.com/a.jpg');
		longCaption.append('keepPhotoCaption', 'x'.repeat(141));
		const longRes = await post(longCaption);
		expect(longRes.status).toBe(400);
		expect(longRes.data.error).toMatch(/140 characters/);

		const badUrl = new FormData();
		badUrl.set('kind', 'photo');
		badUrl.set('imageUrl', 'javascript:alert(1)');
		const badRes = await post(badUrl);
		expect(badRes.status).toBe(400);

		expect(await readPage(issueId)).toHaveLength(0);
	});
});
