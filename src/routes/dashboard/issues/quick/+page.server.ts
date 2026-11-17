import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { db, schema } from '$lib/server/db';
import { eq, desc, asc } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import { ArtistAccountStatus } from '$domain/account';
import { calculateStampWindow } from '$domain/stamping';
import { generateIssueScanQrSvg } from '$lib/server/services/qr';
import { uploadFormFile } from '$lib/server/services/storage';
import { mediaUrlSchema, quickIssueSchema } from '$schemas/issue';

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

	if (artist.accountStatus === ArtistAccountStatus.Closed) {
		throw redirect(303, '/login?closed=1');
	}

	const lastIssue = await db.query.issues.findFirst({
		where: eq(schema.issues.artistId, artist.id),
		orderBy: [desc(schema.issues.date)],
		with: {
			issuePages: {
				orderBy: [asc(schema.issuePages.position)]
			}
		}
	});

	let lastSetlist = '';
	if (lastIssue?.issuePages) {
		const setlistPage = lastIssue.issuePages.find((p) => p.kind === 'setlist');
		if (setlistPage) {
			try {
				const parsed = JSON.parse(setlistPage.contentJson || '{}');
				if (Array.isArray(parsed.songs)) {
					lastSetlist = parsed.songs.join(', ');
				}
			} catch {}
		}
	}

	return {
		artist,
		lastIssue: lastIssue
			? {
					city: lastIssue.city,
					venue: lastIssue.venue,
					timezone: lastIssue.timezone,
					coverNote: lastIssue.coverNote || '',
					approveFirst: lastIssue.approveFirst,
					setlist: lastSetlist
				}
			: null
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
		if (artist.accountStatus === ArtistAccountStatus.Closed) {
			return fail(403, { error: 'This artist account has been closed.' });
		}

		const formData = await request.formData();
		const city = String(formData.get('city') || '');
		const venue = String(formData.get('venue') || '');
		const date = String(formData.get('date') || '');
		const timezone = String(formData.get('timezone') || 'America/New_York');
		const coverNote = String(formData.get('coverNote') || '');
		const setlistSongsRaw = String(formData.get('setlistSongs') || '').trim();
		const approveFirst = formData.get('approveFirst') === 'true';
		const saveModeRaw = String(formData.get('saveMode') || 'published').trim();
		const saveMode = saveModeRaw === 'draft' ? 'draft' : 'published';

		const photoFile = formData.get('photoFile');
		const photoUrlRaw = String(formData.get('photoUrl') || '').trim();
		const photoCaption = String(formData.get('photoCaption') || '').trim();

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

		let resolvedPhotoUrl = '';
		if (photoFile instanceof File && photoFile.size > 0) {
			const uploadRes = await uploadFormFile(photoFile, { kind: 'image' });
			if (!uploadRes.ok) {
				return fail(400, { error: uploadRes.error.message });
			}
			resolvedPhotoUrl = uploadRes.value.url;
		} else if (photoUrlRaw) {
			const urlCheck = mediaUrlSchema.safeParse(photoUrlRaw);
			if (!urlCheck.success) {
				return fail(400, {
					error: urlCheck.error.issues[0]?.message || 'Photo URL must be a valid http(s) URL or /uploads/ path'
				});
			}
			resolvedPhotoUrl = urlCheck.data;
		}

		const secretKey = crypto.randomBytes(16).toString('hex');
		const slugBase = `${artist.slug}-${city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
		let slug = `${slugBase}-${date}`;

		// Support multiple issues on the same date (SPEC.md §6.2: early and late sets)
		const existingSlug = await db.query.issues.findFirst({
			where: eq(schema.issues.slug, slug)
		});
		if (existingSlug) {
			slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
		}

		const issueId = crypto.randomUUID();
		const now = new Date();

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
			status: saveMode,
			stampWindowStart: windowResult.value.start,
			stampWindowEnd: windowResult.value.end,
			approveFirst: parse.data.approveFirst,
			publishedAt: saveMode === 'published' ? now : null,
			createdAt: now,
			updatedAt: now
		});

		let nextPosition = 1;
		if (setlistSongsRaw) {
			const songs = setlistSongsRaw
				.split(/[\n,]+/)
				.map((s) => s.trim())
				.filter(Boolean);
			if (songs.length > 0) {
				await db.insert(schema.issuePages).values({
					id: crypto.randomUUID(),
					issueId,
					position: nextPosition++,
					kind: 'setlist',
					contentJson: JSON.stringify({
						title: "Tonight's Setlist",
						songs
					}),
					createdAt: now
				});
			}
		}

		if (resolvedPhotoUrl) {
			await db.insert(schema.issuePages).values({
				id: crypto.randomUUID(),
				issueId,
				position: nextPosition++,
				kind: 'photo',
				contentJson: JSON.stringify({
					title: `${parse.data.city} Photo`,
					imageUrl: resolvedPhotoUrl,
					body: photoCaption || undefined
				}),
				createdAt: now
			});
		}

		if (saveMode === 'draft') {
			throw redirect(303, `/dashboard/bookbinder/${issueId}`);
		}

		// Generate physical sticker SVG QR code
		const qrSvg = await generateIssueScanQrSvg(url.origin, slug, secretKey);

		return {
			success: true,
			issueId,
			slug,
			city: parse.data.city,
			venue: parse.data.venue,
			date: parse.data.date,
			qrSvg,
			issueUrl: `/i/${slug}`,
			fullIssueUrl: `${url.origin}/i/${slug}`
		};
	}
};
