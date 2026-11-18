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

const REDIRECT_BASE = 'https://quire.invalid';
const MAX_REDIRECT_DECODE_PASSES = 3;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

/** Decodes repeatedly so double-encoded payloads are checked too. Null if it is not valid encoding. */
function fullyDecode(value: string): string | null {
	let current = value;
	for (let pass = 0; pass < MAX_REDIRECT_DECODE_PASSES; pass++) {
		let next: string;
		try {
			next = decodeURIComponent(current);
		} catch {
			return null;
		}
		if (next === current) return current;
		current = next;
	}
	return current;
}

function isUnsafePathForm(value: string): boolean {
	return (
		!value.startsWith('/') ||
		value.startsWith('//') ||
		value.includes('\\') ||
		CONTROL_CHARACTERS.test(value)
	);
}

/**
 * The one redirect checker (PRODUCTION_PLAN 2.1). A redirect target must be a
 * same-site path: a single leading `/`, no `//` or `/\`, no backslashes and no
 * control characters, before or after percent-decoding.
 */
export function isSafeRedirectPath(value: string): boolean {
	if (value.length === 0 || value.length > 2048) return false;
	const decoded = fullyDecode(value);
	if (decoded === null) return false;
	if (isUnsafePathForm(value) || isUnsafePathForm(decoded)) return false;
	try {
		return new URL(value, REDIRECT_BASE).origin === REDIRECT_BASE;
	} catch {
		return false;
	}
}

export const safeRedirectPathSchema = z
	.string()
	.trim()
	.refine(isSafeRedirectPath, {
		message: 'Redirect path must be a relative application path'
	})
	.default('/dashboard');

/** Parses an untrusted redirect target, falling back to `fallback` when it is missing or unsafe. */
export function resolveSafeRedirect(raw: unknown, fallback: string): string {
	if (typeof raw !== 'string' || raw.trim() === '') return fallback;
	const parsed = safeRedirectPathSchema.safeParse(raw);
	return parsed.success ? parsed.data : fallback;
}

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

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Current password is required').max(256),
		newPassword: z
			.string()
			.min(8, 'New password must be at least 8 characters')
			.max(256, 'Password cannot exceed 256 characters'),
		confirmNewPassword: z.string().min(1, 'Please confirm your new password').max(256),
		revokeOtherSessions: z.boolean().default(true)
	})
	.refine((data) => data.newPassword === data.confirmNewPassword, {
		message: 'New password and confirmation do not match',
		path: ['confirmNewPassword']
	});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const changeBandEmailSchema = z.object({
	newEmail: emailSchema,
	currentPassword: z.string().min(1, 'Current password is required to update band email').max(256)
});

export type ChangeBandEmailInput = z.infer<typeof changeBandEmailSchema>;

export const closeArtistAccountSchema = z.object({
	confirmPassword: z.string().min(1, 'Password is required to close your account').max(256),
	confirmPhrase: z.literal('CLOSE', {
		message: 'Type CLOSE in all caps to confirm closing this artist account'
	})
});

export type CloseArtistAccountInput = z.infer<typeof closeArtistAccountSchema>;

export const slugPetitionSchema = z.object({
	requestedSlug: artistSlugSchema,
	petitionerName: z
		.string()
		.trim()
		.min(1, 'Your band or artist name is required')
		.max(100, 'Band name cannot exceed 100 characters'),
	petitionerEmail: emailSchema,
	evidenceUrl: z
		.string()
		.trim()
		.url('Please enter a valid URL (e.g. Bandcamp, Spotify, or official site)')
		.max(500)
		.optional()
		.or(z.literal('')),
	rationale: z
		.string()
		.trim()
		.min(15, 'Please briefly explain your claim to this handle (at least 15 characters)')
		.max(1000, 'Rationale cannot exceed 1000 characters')
});

export type SlugPetitionInput = z.infer<typeof slugPetitionSchema>;
