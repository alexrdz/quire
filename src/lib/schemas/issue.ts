import { z } from 'zod';

export const pageKindSchema = z.enum([
	'text',
	'image',
	'photo',
	'audio',
	'video',
	'setlist',
	'bespoke'
]);
export type PageKind = z.infer<typeof pageKindSchema>;

export const mediaUrlSchema = z
	.string()
	.trim()
	.max(2048, 'Media URL is too long')
	.refine(
		(val) => {
			if (val.startsWith('/uploads/')) {
				return (
					val.length > '/uploads/'.length &&
					!val.includes('..') &&
					/^\/uploads\/[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/.test(val)
				);
			}
			try {
				const parsed = new URL(val);
				return parsed.protocol === 'http:' || parsed.protocol === 'https:';
			} catch {
				return false;
			}
		},
		{
			message: 'Media URL must be a valid http(s) URL or /uploads/ path'
		}
	);

export type MediaUrlInput = z.infer<typeof mediaUrlSchema>;

export const typePairingSchema = z.enum(['sans-serif', 'serif', 'mono']);
export type TypePairing = z.infer<typeof typePairingSchema>;

export const issueStatusSchema = z.enum(['draft', 'published', 'cancelled', 'archived']);
export type IssueStatus = z.infer<typeof issueStatusSchema>;

export const quickIssueSchema = z.object({
	city: z.string().trim().min(1, 'City is required').max(100),
	venue: z.string().trim().min(1, 'Venue is required').max(100),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
	timezone: z.string().trim().min(1).max(100).default('America/New_York'),
	coverNote: z.string().max(300).default(''),
	approveFirst: z.boolean().default(false)
});

export type QuickIssueInput = z.infer<typeof quickIssueSchema>;

export const bookbinderPageSchema = z.object({
	id: z.string().optional(),
	position: z.number().int().nonnegative(),
	kind: pageKindSchema,
	content: z.record(z.string(), z.unknown())
});

export type BookbinderPageInput = z.infer<typeof bookbinderPageSchema>;

export const bookbinderIssueSchema = z.object({
	slug: z.string().trim().min(1).max(100),
	city: z.string().trim().min(1).max(100),
	venue: z.string().trim().min(1).max(100),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	timezone: z.string().trim().min(1).max(100).default('America/New_York'),
	coverNote: z.string().max(300).default(''),
	coverArtUrl: mediaUrlSchema.optional().or(z.literal('')),
	accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
	typePairing: typePairingSchema.optional(),
	status: issueStatusSchema.optional(),
	approveFirst: z.boolean().default(false),
	pages: z.array(bookbinderPageSchema).default([])
});

export type BookbinderIssueInput = z.infer<typeof bookbinderIssueSchema>;

export const artistLinkSchema = z.object({
	label: z.string().trim().min(1, 'Link label is required').max(60),
	url: z.string().trim().url('Link URL must be a valid URL').max(500)
});

export const artistTemplateSchema = z.object({
	accentColor: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/, 'Accent color must be a 6-digit hex code')
		.default('#05D9E8'),
	typePairing: typePairingSchema.default('sans-serif'),
	coverArtUrl: mediaUrlSchema.optional().or(z.literal('')),
	bio: z.string().trim().max(1000).default(''),
	tipPresets: z
		.array(z.number().int().min(2).max(500))
		.length(3, 'Exactly 3 tip presets are required')
		.default([3, 5, 10]),
	links: z.array(artistLinkSchema).max(12).default([])
});

export type ArtistTemplateInput = z.infer<typeof artistTemplateSchema>;

export const issueLifecycleTransitionSchema = z.object({
	issueId: z.string().min(1, 'Issue ID is required'),
	targetStatus: z.enum(['published', 'cancelled', 'archived'])
});

export type IssueLifecycleTransitionInput = z.infer<typeof issueLifecycleTransitionSchema>;
