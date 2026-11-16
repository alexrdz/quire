import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import { calculateStampWindow } from '$domain/stamping';
import { generateIssueScanQrSvg } from '$lib/server/services/qr';
import { quickIssueSchema } from '$schemas/issue';

export const load: ServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (!session?.user) {
		throw redirect(303, '/login?redirect=/dashboard/issues/quick');
	}

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.userId, session.user.id)
	});

	if (!artist) {
		throw redirect(303, '/login');
	}

	return {
		artist
	};
};

export const actions: Actions = {
	default: async ({ request, url }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist) return fail(401, { error: 'Artist not found' });

		const formData = await request.formData();
		const city = String(formData.get('city') || '');
		const venue = String(formData.get('venue') || '');
		const date = String(formData.get('date') || '');
		const timezone = String(formData.get('timezone') || 'America/New_York');
		const coverNote = String(formData.get('coverNote') || '');
		const approveFirst = formData.get('approveFirst') === 'true';

		const parse = quickIssueSchema.safeParse({
			city,
			venue,
			date,
			timezone,
			coverNote,
			approveFirst
		});

		if (!parse.success) {
			return fail(400, { error: parse.error.issues[0]?.message || 'Validation error' });
		}

		// Calculate 48-hour stamp window
		const windowResult = calculateStampWindow(parse.data.date, parse.data.timezone);
		if (!windowResult.ok) {
			return fail(400, { error: windowResult.error.message });
		}

		const secretKey = crypto.randomBytes(16).toString('hex');
		const slugBase = `${artist.slug}-${city.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
		const slug = `${slugBase}-${date}`;

		const issueId = crypto.randomUUID();

		await db.insert(schema.issues).values({
			id: issueId,
			artistId: artist.id,
			slug,
			city: parse.data.city,
			venue: parse.data.venue,
			date: parse.data.date,
			timezone: parse.data.timezone,
			coverNote: parse.data.coverNote,
			secretKey,
			status: 'published',
			stampWindowStart: windowResult.value.start,
			stampWindowEnd: windowResult.value.end,
			approveFirst: parse.data.approveFirst,
			publishedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date()
		});

		// Generate physical sticker SVG QR code
		const qrSvg = await generateIssueScanQrSvg(url.origin, slug, secretKey);

		return {
			success: true,
			slug,
			city: parse.data.city,
			venue: parse.data.venue,
			date: parse.data.date,
			qrSvg,
			issueUrl: `/i/${slug}`
		};
	}
};
