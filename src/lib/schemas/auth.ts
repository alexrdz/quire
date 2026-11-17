import { z } from 'zod';
import { isReservedArtistSlug } from '$domain/theme';

export const accountTypeSchema = z.enum(['artist', 'fan']);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const artistSlugSchema = z
	.string()
	.trim()
	.toLowerCase()
	.min(2, 'Artist handle must be at least 2 characters')
	.max(60, 'Artist handle cannot exceed 60 characters')
	.regex(
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
		'Artist handle can only contain lowercase letters, numbers, and single hyphens'
	)
	.refine((val) => !isReservedArtistSlug(val), {
		message: 'That artist handle is reserved'
	});

export type ArtistSlugInput = z.infer<typeof artistSlugSchema>;

export const safeRedirectPathSchema = z
	.string()
	.trim()
	.refine((val) => val.startsWith('/') && !val.startsWith('//'), {
		message: 'Redirect path must be a relative application path'
	})
	.default('/dashboard');

export const emailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.email('Please enter a valid email address')
	.max(254, 'Email address is too long');

export const artistLoginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, 'Password is required').max(256),
	redirectTo: safeRedirectPathSchema.optional()
});

export type ArtistLoginInput = z.infer<typeof artistLoginSchema>;

export const artistSignupSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, 'Artist or band name is required')
		.max(100, 'Artist or band name cannot exceed 100 characters'),
	slug: artistSlugSchema.optional(),
	email: emailSchema,
	password: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.max(256, 'Password cannot exceed 256 characters'),
	redirectTo: safeRedirectPathSchema.optional()
});

export type ArtistSignupInput = z.infer<typeof artistSignupSchema>;

export const passwordResetRequestSchema = z.object({
	email: emailSchema
});

export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z.object({
	token: z.string().trim().min(1, 'Reset token is required').max(512),
	newPassword: z
		.string()
		.min(8, 'New password must be at least 8 characters')
		.max(256, 'Password cannot exceed 256 characters')
});

export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;

export const emailVerificationQuerySchema = z.object({
	token: z.string().trim().min(1, 'Verification token is required').max(512),
	callbackURL: safeRedirectPathSchema.optional()
});

export type EmailVerificationQueryInput = z.infer<typeof emailVerificationQuerySchema>;
