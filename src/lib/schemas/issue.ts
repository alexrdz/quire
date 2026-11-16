import { z } from 'zod';

export const quickIssueSchema = z.object({
	city: z.string().min(1, 'City is required').max(100),
	venue: z.string().min(1, 'Venue is required').max(100),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
	timezone: z.string().default('America/New_York'),
	coverNote: z.string().max(300).default(''),
	approveFirst: z.boolean().default(false)
});

export type QuickIssueInput = z.infer<typeof quickIssueSchema>;

export const bookbinderPageSchema = z.object({
	id: z.string().optional(),
	position: z.number().int().nonnegative(),
	kind: z.enum(['text', 'image', 'audio', 'video', 'setlist', 'bespoke']),
	content: z.record(z.string(), z.unknown())
});

export const bookbinderIssueSchema = z.object({
	slug: z.string().min(1).max(100),
	city: z.string().min(1).max(100),
	venue: z.string().min(1).max(100),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	timezone: z.string().default('America/New_York'),
	coverNote: z.string().max(300).default(''),
	coverArtUrl: z.string().url().optional().or(z.literal('')),
	accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
	approveFirst: z.boolean().default(false),
	pages: z.array(bookbinderPageSchema).default([])
});

export type BookbinderIssueInput = z.infer<typeof bookbinderIssueSchema>;
