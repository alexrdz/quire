import crypto from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { hashPassword, makeSignature } from 'better-auth/crypto';
import type { Config } from '$lib/server/config';

/**
 * VPV-T03: the per-Issue sticker QR and the Issue URL are built from the
 * configured app URL. A forged Host, X-Forwarded-Host or Origin (or a
 * deploy-preview domain) must never reach a printed sticker.
 */
const state = vi.hoisted(() => ({ override: null as null | ((base: Config) => Config) }));

vi.mock('$lib/server/config', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/config')>();
	return {
		...actual,
		getConfig: () => {
			const base = actual.getConfig();
			return state.override ? state.override(base) : base;
		}
	};
});

const { db, schema } = await import('$lib/server/db');
const { authSecret } = await import('$lib/server/auth');
const { seedDatabase } = await import('$lib/server/seed');
const { buildIssueScanUrl, buildIssueUrl, generateQrSvg } = await import(
	'$lib/server/services/qr'
);
const quick = await import('../../../src/routes/(site)/dashboard/issues/quick/+page.server');
const bookbinder = await import('../../../src/routes/(site)/dashboard/bookbinder/[id]/+page.server');

const EVIL = 'evil.example';
const LOCAL_APP_URL = 'http://localhost:5173';
const APP_URLS: Array<[string | null, string]> = [
	[null, LOCAL_APP_URL],
	['https://quire.live', 'https://quire.live']
];

interface Fixture {
	userId: string;
	artistId: string;
	cookie: string;
}
const created: Fixture[] = [];

async function createArtist(): Promise<Fixture> {
	const userId = crypto.randomUUID();
	const artistId = crypto.randomUUID();
	const suffix = crypto.randomUUID().slice(0, 6);
	const sessionToken = `test_qr_session_${crypto.randomUUID()}`;
	const now = new Date();

	await db.insert(schema.users).values({
		id: userId,
		name: `QR Band ${suffix}`,
		email: `qr-band-${suffix}@example.com`,
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
		password: await hashPassword('qr-band-password-123'),
		createdAt: now,
		updatedAt: now
	});
	await db.insert(schema.sessions).values({
		id: crypto.randomUUID(),
		userId,
		token: sessionToken,
		expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
		createdAt: now,
		updatedAt: now
	});
	await db.insert(schema.artists).values({
		id: artistId,
		userId,
		slug: `qr-band-${suffix}`,
		displayName: `QR Band ${suffix}`,
		createdAt: now,
		updatedAt: now
	});

	const signature = await makeSignature(sessionToken, authSecret);
	const fixture = { userId, artistId, cookie: `better-auth.session_token=${sessionToken}.${signature}` };
	created.push(fixture);
	return fixture;
}

const forgedHeaders = (cookie: string) => ({
	cookie,
	host: EVIL,
	'x-forwarded-host': EVIL,
	'x-forwarded-proto': 'https',
	origin: `https://${EVIL}`
});

function useAppUrl(appUrl: string | null) {
	state.override = appUrl ? (base) => ({ ...base, core: { ...base.core, appUrl } }) : null;
}

async function publishQuickIssue(fixture: Fixture) {
	const form = new FormData();
	form.set('city', 'Philadelphia');
	form.set('venue', "Johnny Brenda's");
	form.set('date', '2026-11-20');
	form.set('timezone', 'America/New_York');
	form.set('setlistSongs', 'Static Bloom, Velvet Wire');
	form.set('saveMode', 'published');
	const href = `https://${EVIL}/dashboard/issues/quick`;
	return (await (quick.actions.default as any)({
		request: new Request(href, { method: 'POST', headers: forgedHeaders(fixture.cookie), body: form }),
		url: new URL(href)
	})) as any;
}

async function secretKeyOf(issueId: string): Promise<string> {
	const issue = await db.query.issues.findFirst({ where: eq(schema.issues.id, issueId) });
	if (!issue) throw new Error('issue missing');
	return issue.secretKey;
}

beforeAll(async () => {
	await seedDatabase();
});

afterEach(async () => {
	state.override = null;
	while (created.length > 0) {
		const f = created.pop()!;
		const issues = await db.query.issues.findMany({ where: eq(schema.issues.artistId, f.artistId) });
		for (const issue of issues) {
			await db.delete(schema.issuePages).where(eq(schema.issuePages.issueId, issue.id));
		}
		await db.delete(schema.issues).where(eq(schema.issues.artistId, f.artistId));
		await db.delete(schema.artists).where(eq(schema.artists.id, f.artistId));
		await db.delete(schema.sessions).where(eq(schema.sessions.userId, f.userId));
		await db.delete(schema.accounts).where(eq(schema.accounts.userId, f.userId));
		await db.delete(schema.users).where(eq(schema.users.id, f.userId));
	}
});

describe('Issue URL builders', () => {
	it.each(APP_URLS)('use the configured app URL (%s)', (appUrl, expectedBase) => {
		useAppUrl(appUrl);
		expect(buildIssueUrl('philly-show')).toBe(`${expectedBase}/i/philly-show`);
		expect(buildIssueScanUrl('philly-show', 'key_123')).toBe(
			`${expectedBase}/scan/philly-show?k=key_123`
		);
	});

	it('drops a trailing slash on the configured URL', () => {
		useAppUrl('https://quire.live/');
		expect(buildIssueUrl('philly-show')).toBe('https://quire.live/i/philly-show');
	});
});

describe('Issue QR ignores the request Host', () => {
	it.each(APP_URLS)('Quick Issue publish encodes the app URL (%s)', async (appUrl, expectedBase) => {
		useAppUrl(appUrl);
		const fixture = await createArtist();
		const result = await publishQuickIssue(fixture);

		expect(result.success).toBe(true);
		expect(result.fullIssueUrl).toBe(`${expectedBase}/i/${result.slug}`);

		const secretKey = await secretKeyOf(result.issueId);
		const expectedScan = `${expectedBase}/scan/${result.slug}?k=${secretKey}`;
		// QR output is deterministic, so an identical SVG means an identical payload.
		expect(result.qrSvg).toBe(await generateQrSvg(expectedScan));
		expect(result.qrSvg).not.toBe(
			await generateQrSvg(`https://${EVIL}/scan/${result.slug}?k=${secretKey}`)
		);
		expect(JSON.stringify(result)).not.toContain(EVIL);
	});

	it.each(APP_URLS)('Bookbinder load encodes the app URL (%s)', async (appUrl, expectedBase) => {
		useAppUrl(appUrl);
		const fixture = await createArtist();
		const published = await publishQuickIssue(fixture);
		const href = `https://${EVIL}/dashboard/bookbinder/${published.issueId}`;

		const data = (await (bookbinder.load as any)({
			params: { id: published.issueId },
			request: new Request(href, { headers: forgedHeaders(fixture.cookie) }),
			url: new URL(href)
		})) as any;

		expect(data.issueUrl).toBe(`${expectedBase}/i/${published.slug}`);
		const secretKey = await secretKeyOf(published.issueId);
		expect(data.issueQrSvg).toBe(
			await generateQrSvg(`${expectedBase}/scan/${published.slug}?k=${secretKey}`)
		);
		expect(JSON.stringify({ issueUrl: data.issueUrl, qr: data.issueQrSvg })).not.toContain(EVIL);
	});
});
