import { test, expect } from '@playwright/test';
import { FEATURE_UNAVAILABLE } from '../../../src/lib/features';
import { postAction, signInWithPassword, type FieldValue } from '../helpers/actions';
import {
	addIssuePage,
	createProductionArtist,
	issueCountFor,
	issuePagesFor,
	resetProductionRateLimits,
	templateStateFor,
	type ProductionArtist
} from '../helpers/production-db';
import { FAKE_AUDIO, MALICIOUS_IMAGE_UPLOADS, TINY_PNG, localUploadFiles } from '../helpers/upload-files';

/**
 * PRODUCTION_PLAN Phase 5: malicious uploads are rejected in production.
 *
 * Production has no R2 keys, so uploads are off and there is no local fallback
 * (ADR 0007, decision 27). Every upload action must answer with the uploads-off
 * message, not a 500, for a valid image and for every malicious file alike,
 * and write nothing: no Issue, no page change, no cover art, no file on disk.
 * The malicious files are checked against the real validator in test mode
 * (tests/e2e/upload-hardening.spec.ts).
 */

let artist: ProductionArtist;
let photoPageId: string;
let audioPageId: string;

test.beforeAll(async () => {
	await resetProductionRateLimits();
	artist = await createProductionArtist({ displayName: 'Upload Check Band', venmoUsername: null });
	photoPageId = await addIssuePage(artist.issueId, 'photo', { title: 'Photos' });
	audioPageId = await addIssuePage(artist.issueId, 'audio', { title: 'Audio', audioUrl: 'https://example.com/a.mp3' });
});

const IMAGE_FILES: Array<[string, Exclude<FieldValue, string>]> = [
	['valid PNG', { name: 'ok.png', mimeType: 'image/png', buffer: TINY_PNG }],
	...MALICIOUS_IMAGE_UPLOADS.map((c) => [c.label, c.file] as [string, Exclude<FieldValue, string>])
];

/** Each upload action with the fields it needs to reach the upload. */
function uploadActions(file: Exclude<FieldValue, string>, audio = false): Array<[string, Record<string, FieldValue>]> {
	if (audio) {
		return [
			[`/dashboard/bookbinder/${artist.issueId}?/updatePage`, { pageId: audioPageId, kind: 'audio', title: 'Audio', audioFile: file }],
			[`/dashboard/bookbinder/${artist.issueId}?/addPage`, { kind: 'audio', title: 'Audio', audioFile: file }],
			['/dashboard/template?/addTemplatePage', { kind: 'audio', title: 'Audio', audioFile: file }]
		];
	}
	return [
		[
			'/dashboard/issues/quick',
			{
				city: 'Uploadville',
				venue: 'The Refusal',
				date: '2026-11-20',
				timezone: 'America/New_York',
				saveMode: 'published',
				photoFile: file
			}
		],
		['/dashboard/template?/saveTemplate', { accentColor: '#05D9E8', coverArtFile: file }],
		['/dashboard/template?/addTemplatePage', { kind: 'photo', title: 'Photos', photoFile: file }],
		[`/dashboard/bookbinder/${artist.issueId}?/updatePage`, { pageId: photoPageId, kind: 'photo', title: 'Photos', photoFile: file }],
		[`/dashboard/bookbinder/${artist.issueId}?/addPage`, { kind: 'photo', title: 'Photos', photoFile: file }]
	];
}

test('every upload action answers uploads-off and writes nothing, for every file', async ({ page, baseURL }) => {
	test.setTimeout(90_000);
	await signInWithPassword(page, artist.email, artist.password);

	const issuesBefore = await issueCountFor(artist.artistId);
	const pagesBefore = await issuePagesFor(artist.issueId);
	const templateBefore = await templateStateFor(artist.artistId);
	const filesBefore = localUploadFiles();

	const cases: Array<[string, Exclude<FieldValue, string>, boolean]> = [
		...IMAGE_FILES.map(([label, file]) => [label, file, false] as [string, Exclude<FieldValue, string>, boolean]),
		['valid-looking audio', { name: 'song.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00') }, true],
		[FAKE_AUDIO.label, FAKE_AUDIO.file, true]
	];
	for (const [label, file, audio] of cases) {
		for (const [path, fields] of uploadActions(file, audio)) {
			const result = await postAction(page.request, baseURL!, path, fields);
			const where = `${path} with ${label}`;
			expect(result.httpStatus, where).toBeLessThan(500);
			expect(result, where).toMatchObject({ type: 'failure', status: 400 });
			expect(result.data, where).toContain(FEATURE_UNAVAILABLE.uploads);
		}
	}

	expect(await issueCountFor(artist.artistId)).toBe(issuesBefore);
	expect(await issuePagesFor(artist.issueId)).toEqual(pagesBefore);
	expect(await templateStateFor(artist.artistId)).toEqual(templateBefore);
	expect(localUploadFiles()).toEqual(filesBefore);
});

test('URLs and embeds still work with uploads off', async ({ page, baseURL }) => {
	await signInWithPassword(page, artist.email, artist.password);
	const result = await postAction(page.request, baseURL!, `/dashboard/bookbinder/${artist.issueId}?/updatePage`, {
		pageId: photoPageId,
		kind: 'photo',
		title: 'Photos',
		imageUrl: 'https://images.unsplash.com/photo-1'
	});
	expect(result, 'a pasted image URL is saved').toMatchObject({ type: 'success' });
	const pages = await issuePagesFor(artist.issueId);
	expect(pages.find((p) => p.id === photoPageId)?.contentJson).toContain('https://images.unsplash.com/photo-1');
});
