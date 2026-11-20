import crypto from 'node:crypto';
import { fail, type Actions, type ServerLoad } from '@sveltejs/kit';
import { db, schema } from '$lib/server/db';
import { eq, asc, and } from 'drizzle-orm';
import { requireArtist, requireArtistAction, isDenied } from '$lib/server/guards';
import { checkAccentContrast } from '$domain/theme';
import { artistTemplateSchema, mediaUrlSchema } from '$schemas/issue';
import { uploadFormFile, type MediaKindFilter } from '$lib/server/services/storage';
import {
	EMAIL_CONFIRMATION_REQUIRED,
	formHasFileUpload,
	isEmailConfirmed
} from '$lib/server/email/verification';
import { z } from 'zod';

const templatePageKindSchema = z.enum(['text', 'audio', 'photo', 'video']);
type TemplatePageKind = z.infer<typeof templatePageKindSchema>;

const DEFAULT_TITLES: Record<TemplatePageKind, string> = {
	text: 'Band Liner Notes',
	audio: 'Unreleased Audio Demo',
	photo: 'Tour Photo Story',
	video: 'Live Video Session'
};

interface TemplatePageContent {
	title?: string;
	body?: string;
	duration?: string;
	audioUrl?: string;
	imageUrl?: string;
	videoUrl?: string;
}

function parsePageContentJson(jsonStr: string): TemplatePageContent {
	try {
		const parsed = JSON.parse(jsonStr || '{}');
		return parsed && typeof parsed === 'object' ? (parsed as TemplatePageContent) : {};
	} catch {
		return {};
	}
}

function parseTipPreset(raw: FormDataEntryValue | null, fallback: number): number {
	const trimmed = String(raw ?? '').trim();
	if (!trimmed) return fallback;
	const num = Number(trimmed);
	return Number.isFinite(num) ? Math.round(num) : NaN;
}

async function resolveMediaInput(
	formData: FormData,
	options: {
		fileField?: string;
		urlField: string;
		kind?: MediaKindFilter;
		fallbackUrl?: string;
	}
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
	if (options.fileField) {
		const candidate = formData.get(options.fileField);
		if (candidate instanceof File && candidate.size > 0) {
			const uploaded = await uploadFormFile(candidate, { kind: options.kind ?? 'any' });
			if (!uploaded.ok) {
				return { ok: false, error: uploaded.error.message };
			}
			return { ok: true, url: uploaded.value.url };
		}
	}

	const rawUrl = formData.has(options.urlField)
		? String(formData.get(options.urlField) ?? '').trim()
		: (options.fallbackUrl ?? '').trim();

	if (!rawUrl) {
		return { ok: true, url: '' };
	}

	const validated = mediaUrlSchema.safeParse(rawUrl);
	if (!validated.success) {
		return {
			ok: false,
			error: validated.error.issues[0]?.message || 'Invalid media URL.'
		};
	}

	return { ok: true, url: validated.data };
}

function buildPageContentJson(params: {
	kind: TemplatePageKind;
	title: string;
	body: string;
	duration?: string;
	audioUrl?: string;
	imageUrl?: string;
	videoUrl?: string;
}): string {
	const { kind, title, body, duration, audioUrl, imageUrl, videoUrl } = params;
	const payload: TemplatePageContent = {
		title: title || DEFAULT_TITLES[kind],
		body
	};

	if (kind === 'audio') {
		payload.duration = duration || '03:42';
		if (audioUrl) payload.audioUrl = audioUrl;
	} else if (kind === 'photo' && imageUrl) {
		payload.imageUrl = imageUrl;
	} else if (kind === 'video' && videoUrl) {
		payload.videoUrl = videoUrl;
	}

	return JSON.stringify(payload);
}

export const load: ServerLoad = async (event) => {
	const { artist } = await requireArtist(event);

	const templatePages = await db.query.templatePages.findMany({
		where: eq(schema.templatePages.artistId, artist.id),
		orderBy: [asc(schema.templatePages.position)]
	});

	let tipPresets: number[] = [3, 5, 10];
	try {
		const parsed = JSON.parse(artist.tipPresetsJson || '[3, 5, 10]');
		if (Array.isArray(parsed) && parsed.length > 0) {
			tipPresets = parsed.slice(0, 3).map((n) => Number(n) || 5);
		}
	} catch {}

	let links: Array<{ label: string; url: string }> = [];
	try {
		const parsed = JSON.parse(artist.linksJson || '[]');
		if (Array.isArray(parsed)) links = parsed;
	} catch {}

	return {
		artist,
		templatePages,
		tipPresets,
		links
	};
};

export const actions: Actions = {
	saveTemplate: async (event) => {
		const { request } = event;
		const authResult = await requireArtistAction(event);
		if (isDenied(authResult)) return authResult;
		const { artist } = authResult;

		const formData = await request.formData();
		// Decision 31: uploads wait for a confirmed band email; URLs and embeds still work.
		if (!isEmailConfirmed(authResult.user) && formHasFileUpload(formData)) {
			return fail(403, { error: EMAIL_CONFIRMATION_REQUIRED.upload });
		}

		// 1. Resolve Cover Art (direct image upload takes precedence over URL input)
		const coverMedia = await resolveMediaInput(formData, {
			fileField: 'coverArtFile',
			urlField: 'coverArtUrl',
			kind: 'image'
		});
		if (!coverMedia.ok) {
			return fail(400, { error: coverMedia.error });
		}

		// 2. Enforce WCAG 2.1 AA contrast for --accent against --bg-void (#090710)
		const rawAccentColor = String(formData.get('accentColor') || '#05D9E8').trim();
		const contrastResult = checkAccentContrast(rawAccentColor);
		const safeAccentColor = contrastResult.ok ? contrastResult.hex : contrastResult.suggestedHex;

		// 3. Parse Tip Presets and Back Page Links
		const tipPresets = [
			parseTipPreset(formData.get('preset1'), 3),
			parseTipPreset(formData.get('preset2'), 5),
			parseTipPreset(formData.get('preset3'), 10)
		];

		const linkLabels = formData.getAll('linkLabel').map((v) => String(v).trim());
		const linkUrls = formData.getAll('linkUrl').map((v) => String(v).trim());
		const links: Array<{ label: string; url: string }> = [];
		const linkCount = Math.max(linkLabels.length, linkUrls.length);
		for (let i = 0; i < linkCount; i++) {
			const label = linkLabels[i] ?? '';
			const url = linkUrls[i] ?? '';
			if (label || url) {
				links.push({ label, url });
			}
		}

		// 4. Validate entire template payload via artistTemplateSchema
		const parsedTemplate = artistTemplateSchema.safeParse({
			accentColor: safeAccentColor,
			typePairing: String(formData.get('typePairing') || 'sans-serif').trim(),
			coverArtUrl: coverMedia.url,
			bio: String(formData.get('bio') || '').trim(),
			tipPresets,
			links
		});

		if (!parsedTemplate.success) {
			return fail(400, {
				error: parsedTemplate.error.issues[0]?.message || 'Invalid template configuration.'
			});
		}

		await db
			.update(schema.artists)
			.set({
				accentColor: parsedTemplate.data.accentColor,
				typePairing: parsedTemplate.data.typePairing,
				coverArtUrl: parsedTemplate.data.coverArtUrl || null,
				bio: parsedTemplate.data.bio,
				tipPresetsJson: JSON.stringify(parsedTemplate.data.tipPresets),
				linksJson: JSON.stringify(parsedTemplate.data.links),
				updatedAt: new Date()
			})
			.where(eq(schema.artists.id, artist.id));

		return {
			success: true,
			...(contrastResult.ok
				? {}
				: {
						contrastAdjusted: true,
						adjustedFrom: contrastResult.hex || rawAccentColor,
						adjustedTo: parsedTemplate.data.accentColor,
						contrastRatio: contrastResult.ratio
					})
		};
	},

	addTemplatePage: async (event) => {
		const { request } = event;
		const authResult = await requireArtistAction(event);
		if (isDenied(authResult)) return authResult;
		const { artist } = authResult;

		const formData = await request.formData();
		// Decision 31: uploads wait for a confirmed band email; URLs and embeds still work.
		if (!isEmailConfirmed(authResult.user) && formHasFileUpload(formData)) {
			return fail(403, { error: EMAIL_CONFIRMATION_REQUIRED.upload });
		}
		const kindResult = templatePageKindSchema.safeParse(
			String(formData.get('kind') || 'text').trim()
		);
		if (!kindResult.success) {
			return fail(400, { error: 'Unsupported recurring page type.' });
		}
		const kind = kindResult.data;

		const title = String(formData.get('title') || '').trim();
		const body = String(formData.get('body') || '').trim();
		const duration = String(formData.get('duration') || '03:42').trim();

		let audioUrl = '';
		let imageUrl = '';
		let videoUrl = '';

		if (kind === 'audio') {
			const media = await resolveMediaInput(formData, {
				fileField: 'audioFile',
				urlField: 'audioUrl',
				kind: 'audio'
			});
			if (!media.ok) return fail(400, { error: media.error });
			audioUrl = media.url;
		} else if (kind === 'photo') {
			const media = await resolveMediaInput(formData, {
				fileField: 'photoFile',
				urlField: 'imageUrl',
				kind: 'image'
			});
			if (!media.ok) return fail(400, { error: media.error });
			imageUrl = media.url;
		} else if (kind === 'video') {
			const media = await resolveMediaInput(formData, {
				urlField: 'videoUrl'
			});
			if (!media.ok) return fail(400, { error: media.error });
			videoUrl = media.url;
		}

		const existing = await db.query.templatePages.findMany({
			where: eq(schema.templatePages.artistId, artist.id)
		});
		const nextPosition = existing.reduce((max, p) => Math.max(max, p.position), 0) + 1;

		await db.insert(schema.templatePages).values({
			id: crypto.randomUUID(),
			artistId: artist.id,
			position: nextPosition,
			kind,
			contentJson: buildPageContentJson({
				kind,
				title,
				body,
				duration,
				audioUrl,
				imageUrl,
				videoUrl
			}),
			createdAt: new Date()
		});

		return { pageAdded: true };
	},

	editTemplatePage: async (event) => {
		const { request } = event;
		const authResult = await requireArtistAction(event);
		if (isDenied(authResult)) return authResult;
		const { artist } = authResult;

		const formData = await request.formData();
		// Decision 31: uploads wait for a confirmed band email; URLs and embeds still work.
		if (!isEmailConfirmed(authResult.user) && formHasFileUpload(formData)) {
			return fail(403, { error: EMAIL_CONFIRMATION_REQUIRED.upload });
		}
		const pageId = String(formData.get('pageId') || '').trim();
		if (!pageId) return fail(400, { error: 'Page ID is required.' });

		const existingPage = await db.query.templatePages.findFirst({
			where: and(
				eq(schema.templatePages.id, pageId),
				eq(schema.templatePages.artistId, artist.id)
			)
		});
		if (!existingPage) {
			return fail(404, { error: 'Recurring page not found.' });
		}

		const requestedKind = formData.has('kind')
			? String(formData.get('kind') || '').trim()
			: existingPage.kind;
		const kindResult = templatePageKindSchema.safeParse(requestedKind);
		if (!kindResult.success) {
			return fail(400, { error: 'Unsupported recurring page type.' });
		}
		const kind = kindResult.data;

		const existingContent = parsePageContentJson(existingPage.contentJson);
		const title = formData.has('title')
			? String(formData.get('title') || '').trim()
			: (existingContent.title ?? '');
		const body = formData.has('body')
			? String(formData.get('body') || '').trim()
			: (existingContent.body ?? '');
		const duration = formData.has('duration')
			? String(formData.get('duration') || '03:42').trim()
			: (existingContent.duration ?? '03:42');

		let audioUrl = existingContent.audioUrl ?? '';
		let imageUrl = existingContent.imageUrl ?? '';
		let videoUrl = existingContent.videoUrl ?? '';

		if (kind === 'audio') {
			const media = await resolveMediaInput(formData, {
				fileField: 'audioFile',
				urlField: 'audioUrl',
				kind: 'audio',
				fallbackUrl: existingContent.audioUrl
			});
			if (!media.ok) return fail(400, { error: media.error });
			audioUrl = media.url;
		} else if (kind === 'photo') {
			const media = await resolveMediaInput(formData, {
				fileField: 'photoFile',
				urlField: 'imageUrl',
				kind: 'image',
				fallbackUrl: existingContent.imageUrl
			});
			if (!media.ok) return fail(400, { error: media.error });
			imageUrl = media.url;
		} else if (kind === 'video') {
			const media = await resolveMediaInput(formData, {
				urlField: 'videoUrl',
				fallbackUrl: existingContent.videoUrl
			});
			if (!media.ok) return fail(400, { error: media.error });
			videoUrl = media.url;
		}

		await db
			.update(schema.templatePages)
			.set({
				kind,
				contentJson: buildPageContentJson({
					kind,
					title,
					body,
					duration,
					audioUrl,
					imageUrl,
					videoUrl
				})
			})
			.where(
				and(
					eq(schema.templatePages.id, pageId),
					eq(schema.templatePages.artistId, artist.id)
				)
			);

		return { pageUpdated: true };
	},

	moveTemplatePage: async (event) => {
		const { request } = event;
		const authResult = await requireArtistAction(event);
		if (isDenied(authResult)) return authResult;
		const { artist } = authResult;

		const formData = await request.formData();
		const pageId = String(formData.get('pageId') || '').trim();
		const direction = String(formData.get('direction') || 'up').trim();
		if (!pageId) return fail(400, { error: 'Page ID is required.' });
		if (direction !== 'up' && direction !== 'down') {
			return fail(400, { error: 'Direction must be up or down.' });
		}

		const pages = await db.query.templatePages.findMany({
			where: eq(schema.templatePages.artistId, artist.id),
			orderBy: [asc(schema.templatePages.position)]
		});

		const idx = pages.findIndex((p) => p.id === pageId);
		if (idx === -1) return fail(404, { error: 'Recurring page not found.' });

		const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
		if (swapIdx < 0 || swapIdx >= pages.length) {
			return { pageMoved: true };
		}

		const current = pages[idx];
		const neighbor = pages[swapIdx];

		const nextCurrentPosition =
			current.position === neighbor.position ? swapIdx + 1 : neighbor.position;
		const nextNeighborPosition =
			current.position === neighbor.position ? idx + 1 : current.position;

		await db
			.update(schema.templatePages)
			.set({ position: nextCurrentPosition })
			.where(
				and(
					eq(schema.templatePages.id, current.id),
					eq(schema.templatePages.artistId, artist.id)
				)
			);

		await db
			.update(schema.templatePages)
			.set({ position: nextNeighborPosition })
			.where(
				and(
					eq(schema.templatePages.id, neighbor.id),
					eq(schema.templatePages.artistId, artist.id)
				)
			);

		return { pageMoved: true };
	},

	deleteTemplatePage: async (event) => {
		const { request } = event;
		const authResult = await requireArtistAction(event);
		if (isDenied(authResult)) return authResult;
		const { artist } = authResult;

		const formData = await request.formData();
		const pageId = String(formData.get('pageId') || '').trim();
		if (!pageId) return fail(400, { error: 'Page ID is required.' });

		await db
			.delete(schema.templatePages)
			.where(
				and(
					eq(schema.templatePages.id, pageId),
					eq(schema.templatePages.artistId, artist.id)
				)
			);

		return { pageDeleted: true };
	}
};
