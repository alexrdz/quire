import { error, fail, type Actions, type ServerLoad } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { db, schema } from '$lib/server/db';
import { eq, and, asc } from 'drizzle-orm';
import { requireArtist, requireArtistAction, type GuardEvent, isDenied } from '$lib/server/guards';
import { buildIssueUrl, generateIssueScanQrSvg } from '$lib/server/services/qr';
import { uploadFormFile } from '$lib/server/services/storage';
import { calculateStampWindow } from '$domain/stamping';
import {
	archiveIssue,
	cancelIssue,
	publishIssue,
	type Issue
} from '$domain/issue';
import { createArtistId, createIssueId } from '$domain/types';
import { issueStatusSchema, mediaUrlSchema, photoEntriesSchema } from '$schemas/issue';
import { MAX_PHOTOS_PER_PAGE } from '$domain/photo-pile';
import {
	EMAIL_CONFIRMATION_REQUIRED,
	formHasFileUpload,
	isEmailConfirmed
} from '$lib/server/email/verification';

const BOOKBINDER_PAGE_KINDS = new Set(['text', 'setlist', 'photo', 'audio', 'video'] as const);
type BookbinderPageKind = 'text' | 'setlist' | 'photo' | 'audio' | 'video';

/** The guarded Artist plus the Issue they own, or a failure to return as is. */
async function requireOwnedIssue(event: GuardEvent, issueId: string | undefined) {
	const guard = await requireArtistAction(event);
	if (isDenied(guard)) return { errorResponse: guard } as const;
	const { user, artist } = guard;

	if (!issueId) {
		return { errorResponse: fail(400, { error: 'Issue ID is required' }) } as const;
	}

	const issue = await db.query.issues.findFirst({
		where: and(eq(schema.issues.id, issueId), eq(schema.issues.artistId, artist.id))
	});
	if (!issue) {
		return { errorResponse: fail(403, { error: 'Issue not found or unauthorized' }) } as const;
	}

	return { user, artist, issue } as const;
}

function toDomainIssue(
	existing: typeof schema.issues.$inferSelect,
	fallbackWindow: { start: Date; end: Date }
): Issue {
	const base = {
		id: createIssueId(existing.id),
		artistId: createArtistId(existing.artistId),
		slug: existing.slug,
		city: existing.city,
		venue: existing.venue,
		date: existing.date,
		timezone: existing.timezone,
		coverNote: existing.coverNote,
		approveFirst: existing.approveFirst
	};

	switch (existing.status) {
		case 'draft':
			return { ...base, status: 'draft' };
		case 'published':
			return {
				...base,
				status: 'published',
				secretKey: existing.secretKey,
				stampWindow: {
					start: existing.stampWindowStart ?? fallbackWindow.start,
					end: existing.stampWindowEnd ?? fallbackWindow.end
				},
				publishedAt: existing.publishedAt ?? existing.createdAt
			};
		case 'cancelled':
			return {
				...base,
				status: 'cancelled',
				cancelledAt: existing.updatedAt
			};
		case 'archived':
			return {
				...base,
				status: 'archived',
				archivedAt: existing.archivedAt ?? existing.updatedAt,
				previousStatus: 'published'
			};
	}
}

async function resolvePageContentJson(
	formData: FormData,
	kind: BookbinderPageKind,
	isCreate: boolean
): Promise<{ ok: true; contentJson: string } | { ok: false; error: string }> {
	const title = String(formData.get('title') || '').trim();
	const body = String(formData.get('body') || '').trim();
	const songsRaw = String(formData.get('songs') || '').trim();
	const duration = String(formData.get('duration') || '03:42').trim();

	if (kind === 'setlist') {
		const songs = songsRaw
			? songsRaw
					.split(/[\n,]+/)
					.map((s) => s.trim())
					.filter(Boolean)
			: isCreate
				? ['Opening Track', 'New Single', 'Crowd Favorite', 'Encore']
				: [];

		return {
			ok: true,
			contentJson: JSON.stringify({
				title: title || undefined,
				songs
			})
		};
	}

	if (kind === 'photo') {
		// Photos already on the page, in the order the artist arranged them.
		const keptUrls = formData.getAll('keepPhotoUrl').map((v) => String(v).trim());
		const keptCaptions = formData.getAll('keepPhotoCaption').map((v) => String(v));
		const keptRaw = keptUrls.flatMap((url, i) =>
			url ? [{ url, caption: keptCaptions[i] || undefined }] : []
		);
		const newFiles = formData
			.getAll('photoFile')
			.filter((f): f is File => f instanceof File && f.size > 0);
		const imageUrlRaw = String(formData.get('imageUrl') || '').trim();
		const addedRaw = imageUrlRaw ? [{ url: imageUrlRaw }] : [];

		const totalPhotos = keptRaw.length + newFiles.length + addedRaw.length;
		if (totalPhotos > MAX_PHOTOS_PER_PAGE) {
			return {
				ok: false,
				error: `A photo page holds at most ${MAX_PHOTOS_PER_PAGE} photos.`
			};
		}

		// Validate everything the artist typed before spending any upload.
		const keptCheck = photoEntriesSchema.safeParse(keptRaw);
		const addedCheck = photoEntriesSchema.safeParse(addedRaw);
		for (const check of [keptCheck, addedCheck]) {
			if (!check.success) {
				return {
					ok: false,
					error:
						check.error.issues[0]?.message ||
						'Photo URL must be a valid http(s) URL or /uploads/ path'
				};
			}
		}
		if (!keptCheck.success || !addedCheck.success) {
			return { ok: false, error: 'Invalid photo data.' };
		}

		const uploaded: { url: string }[] = [];
		for (const file of newFiles) {
			const uploadRes = await uploadFormFile(file, { kind: 'image' });
			if (!uploadRes.ok) {
				return { ok: false, error: uploadRes.error.message };
			}
			uploaded.push({ url: uploadRes.value.url });
		}

		const photos = [...keptCheck.data, ...uploaded, ...addedCheck.data].map((p) =>
			'caption' in p && p.caption ? { url: p.url, caption: p.caption } : { url: p.url }
		);

		return {
			ok: true,
			contentJson: JSON.stringify({
				title: title || undefined,
				body: body || undefined,
				photos: photos.length > 0 ? photos : undefined,
				// First photo mirrored as `imageUrl` so single-photo readers keep working.
				imageUrl: photos[0]?.url
			})
		};
	}

	if (kind === 'audio') {
		const audioFile = formData.get('audioFile');
		const audioUrlRaw = String(formData.get('audioUrl') || '').trim();
		let resolvedAudioUrl = '';

		if (audioFile instanceof File && audioFile.size > 0) {
			const uploadRes = await uploadFormFile(audioFile, { kind: 'audio' });
			if (!uploadRes.ok) {
				return { ok: false, error: uploadRes.error.message };
			}
			resolvedAudioUrl = uploadRes.value.url;
		} else if (audioUrlRaw) {
			const urlCheck = mediaUrlSchema.safeParse(audioUrlRaw);
			if (!urlCheck.success) {
				return {
					ok: false,
					error:
						urlCheck.error.issues[0]?.message ||
						'Audio URL must be a valid http(s) URL or /uploads/ path'
				};
			}
			resolvedAudioUrl = urlCheck.data;
		}

		return {
			ok: true,
			contentJson: JSON.stringify({
				title: title || undefined,
				body: body || undefined,
				duration: duration || '03:42',
				audioUrl: resolvedAudioUrl || undefined
			})
		};
	}

	if (kind === 'video') {
		const videoFile = formData.get('videoFile');
		const videoUrlRaw = String(formData.get('videoUrl') || formData.get('embedUrl') || '').trim();
		const videoOrientation = String(formData.get('videoOrientation') || '').trim();
		let resolvedVideoUrl = '';

		if (videoFile instanceof File && videoFile.size > 0) {
			const uploadRes = await uploadFormFile(videoFile, { kind: 'video' });
			if (!uploadRes.ok) {
				return { ok: false, error: uploadRes.error.message };
			}
			resolvedVideoUrl = uploadRes.value.url;
		} else if (videoUrlRaw) {
			const urlCheck = mediaUrlSchema.safeParse(videoUrlRaw);
			if (!urlCheck.success) {
				return {
					ok: false,
					error:
						urlCheck.error.issues[0]?.message ||
						'Video URL must be a valid http(s) URL or /uploads/ path'
				};
			}
			resolvedVideoUrl = urlCheck.data;
		}

		return {
			ok: true,
			contentJson: JSON.stringify({
				title: title || undefined,
				body: body || undefined,
				videoUrl: resolvedVideoUrl || undefined,
				orientation: videoOrientation === 'portrait' || videoOrientation === 'landscape' ? videoOrientation : undefined
			})
		};
	}

	return {
		ok: true,
		contentJson: JSON.stringify({
			title: title || undefined,
			body: body || undefined
		})
	};
}

export const load: ServerLoad = async (event) => {
	const { params } = event;
	const { artist } = await requireArtist(event);

	const issue = await db.query.issues.findFirst({
		where: and(eq(schema.issues.id, params.id!), eq(schema.issues.artistId, artist.id)),
		with: {
			issuePages: {
				orderBy: [asc(schema.issuePages.position)]
			}
		}
	});

	if (!issue) {
		throw error(404, 'Issue not found or unauthorized');
	}

	// Printed on stickers: built from the configured app URL, never the request Host.
	const issueQrSvg = await generateIssueScanQrSvg(issue.slug, issue.secretKey);

	return {
		artist,
		issue,
		pages: issue.issuePages,
		issueQrSvg,
		issueUrl: buildIssueUrl(issue.slug)
	};
};

export const actions: Actions = {
	save: async (event) => {
		const { request, params } = event;
		const owned = await requireOwnedIssue(event, params.id);
		if ('errorResponse' in owned) return owned.errorResponse;
		const existing = owned.issue;

		const formData = await request.formData();
		const coverNote = String(formData.get('coverNote') || '');
		const city = String(formData.get('city') || '').trim();
		const venue = String(formData.get('venue') || '').trim();
		const date = String(formData.get('date') || '').trim();
		const rawStatus = String(formData.get('status') || existing.status).trim();
		const approveFirst = formData.get('approveFirst') === 'true';

		const nextCity = city || existing.city;
		const nextVenue = venue || existing.venue;
		const nextDate = date || existing.date;

		if (!nextCity || !nextVenue) {
			return fail(400, { error: 'City and venue are required.' });
		}

		const statusCheck = issueStatusSchema.safeParse(rawStatus);
		if (!statusCheck.success) {
			return fail(400, { error: 'Invalid issue status.' });
		}
		const requestedStatus = statusCheck.data;

		const windowCalc = calculateStampWindow(nextDate, existing.timezone);
		if (!windowCalc.ok) {
			return fail(400, { error: windowCalc.error.message });
		}

		let nextPublishedAt = existing.publishedAt;
		let nextArchivedAt = existing.archivedAt;

		if (requestedStatus !== existing.status) {
			const domainIssue = toDomainIssue(existing, windowCalc.value);

			if (requestedStatus === 'draft') {
				return fail(400, {
					error: `Cannot transition an issue with status '${existing.status}' back to 'draft'.`
				});
			} else if (requestedStatus === 'published') {
				// Decision 31: publishing waits for a confirmed band email.
				if (!isEmailConfirmed(owned.user)) {
					return fail(403, { error: EMAIL_CONFIRMATION_REQUIRED.publish });
				}
				const res = publishIssue(domainIssue, {
					secretKey: existing.secretKey,
					stampWindow: windowCalc.value
				});
				if (!res.ok) {
					return fail(400, { error: res.error.message });
				}
				nextPublishedAt = res.value.publishedAt;
			} else if (requestedStatus === 'cancelled') {
				const res = cancelIssue(domainIssue);
				if (!res.ok) {
					return fail(400, { error: res.error.message });
				}
			} else if (requestedStatus === 'archived') {
				const res = archiveIssue(domainIssue);
				if (!res.ok) {
					return fail(400, { error: res.error.message });
				}
				nextArchivedAt = res.value.archivedAt;
			}
		}

		await db
			.update(schema.issues)
			.set({
				coverNote,
				city: nextCity,
				venue: nextVenue,
				date: nextDate,
				status: requestedStatus,
				approveFirst,
				stampWindowStart: windowCalc.value.start,
				stampWindowEnd: windowCalc.value.end,
				publishedAt: nextPublishedAt,
				archivedAt: nextArchivedAt,
				updatedAt: new Date()
			})
			.where(and(eq(schema.issues.id, existing.id), eq(schema.issues.artistId, owned.artist.id)));

		return { success: true };
	},

	updatePage: async (event) => {
		const { request, params } = event;
		const owned = await requireOwnedIssue(event, params.id);
		if ('errorResponse' in owned) return owned.errorResponse;

		const formData = await request.formData();
		if (!isEmailConfirmed(owned.user) && formHasFileUpload(formData)) {
			return fail(403, { error: EMAIL_CONFIRMATION_REQUIRED.upload });
		}
		const pageId = String(formData.get('pageId') || '').trim();
		const rawKind = String(formData.get('kind') || 'text').trim();

		if (!pageId) {
			return fail(400, { error: 'Page ID is required.' });
		}

		const existingPage = await db.query.issuePages.findFirst({
			where: and(eq(schema.issuePages.id, pageId), eq(schema.issuePages.issueId, owned.issue.id))
		});
		if (!existingPage) {
			return fail(404, { error: 'Page not found for this issue.' });
		}

		const kind = BOOKBINDER_PAGE_KINDS.has(rawKind as BookbinderPageKind)
			? (rawKind as BookbinderPageKind)
			: (existingPage.kind as BookbinderPageKind);

		const resolved = await resolvePageContentJson(formData, kind, false);
		if (!resolved.ok) {
			return fail(400, { error: resolved.error });
		}

		await db
			.update(schema.issuePages)
			.set({ contentJson: resolved.contentJson })
			.where(and(eq(schema.issuePages.id, pageId), eq(schema.issuePages.issueId, owned.issue.id)));

		return { success: true };
	},

	movePage: async (event) => {
		const { request, params } = event;
		const owned = await requireOwnedIssue(event, params.id);
		if ('errorResponse' in owned) return owned.errorResponse;

		const formData = await request.formData();
		const pageId = String(formData.get('pageId') || '').trim();
		const direction = String(formData.get('direction') || 'up');

		const pages = await db.query.issuePages.findMany({
			where: eq(schema.issuePages.issueId, owned.issue.id),
			orderBy: [asc(schema.issuePages.position)]
		});

		const idx = pages.findIndex((p) => p.id === pageId);
		if (idx === -1) return fail(404, { error: 'Page not found for this issue.' });

		const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
		if (swapIdx < 0 || swapIdx >= pages.length) return { success: true };

		const current = pages[idx];
		const neighbor = pages[swapIdx];

		await db
			.update(schema.issuePages)
			.set({ position: neighbor.position })
			.where(
				and(eq(schema.issuePages.id, current.id), eq(schema.issuePages.issueId, owned.issue.id))
			);
		await db
			.update(schema.issuePages)
			.set({ position: current.position })
			.where(
				and(eq(schema.issuePages.id, neighbor.id), eq(schema.issuePages.issueId, owned.issue.id))
			);

		return { success: true };
	},

	addPage: async (event) => {
		const { request, params } = event;
		const owned = await requireOwnedIssue(event, params.id);
		if ('errorResponse' in owned) return owned.errorResponse;

		const formData = await request.formData();
		if (!isEmailConfirmed(owned.user) && formHasFileUpload(formData)) {
			return fail(403, { error: EMAIL_CONFIRMATION_REQUIRED.upload });
		}
		const rawKind = String(formData.get('kind') || 'text').trim();
		if (!BOOKBINDER_PAGE_KINDS.has(rawKind as BookbinderPageKind)) {
			return fail(400, { error: `Unsupported page type '${rawKind}'.` });
		}
		const kind = rawKind as BookbinderPageKind;

		const resolved = await resolvePageContentJson(formData, kind, true);
		if (!resolved.ok) {
			return fail(400, { error: resolved.error });
		}

		const pages = await db.query.issuePages.findMany({
			where: eq(schema.issuePages.issueId, owned.issue.id),
			orderBy: [asc(schema.issuePages.position)]
		});
		const maxPosition = pages.reduce((max, p) => Math.max(max, p.position), 0);

		await db.insert(schema.issuePages).values({
			id: crypto.randomUUID(),
			issueId: owned.issue.id,
			position: maxPosition + 1,
			kind,
			contentJson: resolved.contentJson,
			createdAt: new Date()
		});

		return { success: true };
	},

	deletePage: async (event) => {
		const { request, params } = event;
		const owned = await requireOwnedIssue(event, params.id);
		if ('errorResponse' in owned) return owned.errorResponse;

		const formData = await request.formData();
		const pageId = String(formData.get('pageId') || '').trim();
		if (!pageId) {
			return fail(400, { error: 'Page ID is required.' });
		}

		const existingPage = await db.query.issuePages.findFirst({
			where: and(eq(schema.issuePages.id, pageId), eq(schema.issuePages.issueId, owned.issue.id))
		});
		if (!existingPage) {
			return fail(404, { error: 'Page not found for this issue.' });
		}

		await db
			.delete(schema.issuePages)
			.where(and(eq(schema.issuePages.id, pageId), eq(schema.issuePages.issueId, owned.issue.id)));

		return { success: true };
	}
};
