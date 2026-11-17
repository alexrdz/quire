import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { render } from 'svelte/server';
import { db, schema } from '$lib/server/db';
import { load as backPageLoad } from '../../../src/routes/(site)/a/[slug]/+page.server';

vi.mock('$app/forms', () => ({
	enhance: () => ({ destroy() {} })
}));

const createdUserIds: string[] = [];

afterEach(async () => {
	while (createdUserIds.length > 0) {
		const userId = createdUserIds.pop()!;
		await db.delete(schema.users).where(eq(schema.users.id, userId));
	}
});

describe('Artist Back Page Monthly Collapsing (/a/[slug])', () => {
	it('groups multiple months newest-first and renders only the latest month expanded', async () => {
		const suffix = crypto.randomBytes(4).toString('hex');
		const userId = crypto.randomUUID();
		const artistId = crypto.randomUUID();
		const slug = `midnight-echo-${suffix}`;
		const now = new Date();
		createdUserIds.push(userId);

		await db.insert(schema.users).values({
			id: userId,
			name: 'Midnight Echo',
			email: `echo-${suffix}@example.com`,
			emailVerified: true,
			accountType: 'artist',
			createdAt: now,
			updatedAt: now
		});

		await db.insert(schema.artists).values({
			id: artistId,
			userId,
			slug,
			displayName: 'Midnight Echo',
			bio: 'Post-punk quartet',
			verified: true,
			accountStatus: 'active',
			createdAt: now,
			updatedAt: now
		});

		const issueSpecs = [
			{ id: crypto.randomUUID(), date: '2026-10-14', city: 'Brooklyn', venue: 'Elsewhere', status: 'published' as const },
			{ id: crypto.randomUUID(), date: '2026-10-03', city: 'Philadelphia', venue: 'Johnny Brenda', status: 'published' as const },
			{ id: crypto.randomUUID(), date: '2026-09-20', city: 'Chicago', venue: 'Empty Bottle', status: 'cancelled' as const },
			{ id: crypto.randomUUID(), date: '2026-08-11', city: 'Seattle', venue: 'Tractor Tavern', status: 'published' as const }
		];

		for (const item of issueSpecs) {
			await db.insert(schema.issues).values({
				id: item.id,
				artistId,
				slug: `${slug}-${item.date}-${crypto.randomBytes(2).toString('hex')}`,
				city: item.city,
				venue: item.venue,
				date: item.date,
				timezone: 'America/New_York',
				status: item.status,
				secretKey: `sec_${crypto.randomUUID()}`,
				stampWindowStart: now,
				stampWindowEnd: new Date(now.getTime() + 86400_000),
				publishedAt: now,
				createdAt: now,
				updatedAt: now
			});
		}

		const data = (await backPageLoad({
			params: { slug },
			request: new Request(`http://localhost/a/${slug}`)
		} as unknown as Parameters<typeof backPageLoad>[0])) as Record<string, unknown> & {
			groupedIssues: Array<{ key: string; month: string; issues: Array<{ city: string }> }>;
		};

		expect(data.groupedIssues.map((g) => g.month)).toEqual([
			'October 2026',
			'September 2026',
			'August 2026'
		]);
		expect(data.groupedIssues[0]?.issues).toHaveLength(2);

		const { default: BackPageComponent } = await import('../../../src/routes/(site)/a/[slug]/+page.svelte');
		const rendered = render(BackPageComponent, {
			props: {
				data: data as never,
				form: null
			}
		});

		const detailsMatches = rendered.html.match(/<details\b[^>]*class="month-accordion[^"]*"[^>]*>/g) ?? [];
		expect(detailsMatches).toHaveLength(3);
		expect(detailsMatches[0]).toContain('open');
		expect(detailsMatches[1]).not.toContain('open');
		expect(detailsMatches[2]).not.toContain('open');

		expect(rendered.html).toContain('October 2026');
		expect(rendered.html).toContain('2 shows');
		expect(rendered.html).toContain('September 2026');
		expect(rendered.html).toContain('1 show');
		expect(rendered.html).toContain('August 2026');
	});
});
