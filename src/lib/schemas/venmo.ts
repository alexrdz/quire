import { z } from 'zod';

/**
 * Venmo username setup and change (ADR 0008). The username itself is validated
 * by `parseVenmoUsername` in `$domain/venmo`, so these schemas only shape the form.
 */
export const venmoSetupSchema = z.object({
	venmoUsername: z.string().max(64, 'That Venmo username is too long.')
});

/** Changing or removing an existing username needs the band password again. */
export const venmoChangeRequestSchema = z.object({
	venmoUsername: z.string().max(64, 'That Venmo username is too long.'),
	confirmPassword: z
		.string()
		.min(1, 'Re-enter your band password to change the Venmo username.')
		.max(256)
});

export const venmoRemoveRequestSchema = z.object({
	confirmPassword: z
		.string()
		.min(1, 'Re-enter your band password to remove the Venmo username.')
		.max(256)
});

/** Raw tokens are 32 random bytes as hex (64 characters). */
export const venmoChangeTokenSchema = z.object({
	token: z
		.string()
		.trim()
		.regex(/^[a-f0-9]{64}$/, 'This confirmation link is not valid.')
});
