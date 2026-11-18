import crypto from 'node:crypto';
import { z } from 'zod';
import { type Result, type DomainError, ok, err } from '$domain/types';
import {
	buildEmailVerificationTemplate,
	buildPasswordResetTemplate,
	buildPayoutAccountChangeTemplate,
	buildSlugPetitionConfirmationTemplate,
	buildSlugPetitionDecisionTemplate,
	buildVenmoChangeConfirmationTemplate,
	buildVenmoChangedNoticeTemplate
} from './templates';

import { allowsStandIn, getConfig } from '../config';

import { FEATURE_UNAVAILABLE } from '$lib/features';

const sendEmailSchema = z.object({
	to: z.string().email('Valid recipient email is required'),
	subject: z.string().min(1, 'Email subject is required').max(200),
	html: z.string().min(1, 'Email HTML body is required'),
	text: z.string().min(1, 'Email text body is required')
});

const verificationEmailInputSchema = z.object({
	to: z.string().email('Valid recipient email is required'),
	artistName: z.string().min(1).max(120),
	verificationUrl: z.string().url('Valid verification URL is required')
});

const passwordResetInputSchema = z.object({
	to: z.string().email('Valid recipient email is required'),
	artistName: z.string().min(1).max(120),
	resetUrl: z.string().url('Valid password reset URL is required')
});

const payoutChangeInputSchema = z.object({
	to: z.string().email('Valid recipient email is required'),
	artistName: z.string().min(1).max(120),
	confirmationUrl: z.string().url('Valid confirmation URL is required'),
	newStripeAccountId: z.string().min(1).max(128)
});

const slugPetitionEmailInputSchema = z.object({
	to: z.string().email('Valid recipient email is required'),
	petitionerName: z.string().min(1).max(120),
	requestedSlug: z.string().min(2).max(60),
	existingArtistClosed: z.boolean()
});

const slugPetitionDecisionEmailInputSchema = z.object({
	to: z.string().email('Valid recipient email is required'),
	petitionerName: z.string().min(1).max(120),
	requestedSlug: z.string().min(2).max(60),
	decision: z.enum(['approved', 'rejected']),
	note: z.string().max(500).optional()
});

export interface EmailSendReceipt {
	id: string;
	mode: 'resend' | 'dev_console' | 'suppressed';
}

interface ResendLikeClient {
	emails: {
		send(payload: {
			from: string;
			to: string[];
			subject: string;
			html: string;
			text: string;
		}): Promise<{ data: { id: string } | null; error: { message: string; name?: string } | null }>;
	};
}

let cachedResendClient: { apiKey: string; client: ResendLikeClient } | null = null;

function getResendApiKey(): string | null {
	const config = getConfig();
	return config.live.email ? (config.integrations.resend?.apiKey ?? null) : null;
}

function getFromEmail(): string {
	return getConfig().fromEmail;
}

async function resolveResendClient(apiKey: string): Promise<ResendLikeClient | null> {
	if (cachedResendClient && cachedResendClient.apiKey === apiKey) {
		return cachedResendClient.client;
	}

	const moduleName = 'resend';
	try {
		const mod = (await import(/* @vite-ignore */ moduleName)) as {
			Resend?: new (key: string) => ResendLikeClient;
		};
		if (mod?.Resend) {
			const client = new mod.Resend(apiKey);
			cachedResendClient = { apiKey, client };
			return client;
		}
	} catch {
		// Fall back to direct Resend REST API when the optional package is not linked locally.
	}

	return null;
}

async function sendViaResendHttp(
	apiKey: string,
	payload: { from: string; to: string[]; subject: string; html: string; text: string }
): Promise<Result<EmailSendReceipt, DomainError>> {
	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(payload)
	});

	const body = (await response.json().catch(() => ({}))) as {
		id?: string;
		message?: string;
		name?: string;
	};

	if (!response.ok || !body.id) {
		return err({
			code: 'EMAIL_SEND_FAILED',
			message: body.message || `Resend API error (HTTP ${response.status})`
		});
	}

	return ok({ id: body.id, mode: 'resend' });
}

/**
 * Sends a transactional email via Resend when RESEND_API_KEY is configured.
 * Without it: development and test log the email to the console, the Demo
 * suppresses it silently, and production returns EMAIL_UNAVAILABLE without logging (ADR 0007).
 */
export async function sendTransactionalEmail(input: {
	to: string;
	subject: string;
	html: string;
	text: string;
}): Promise<Result<EmailSendReceipt, DomainError>> {
	const parsed = sendEmailSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_EMAIL_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid email parameters.'
		});
	}

	const apiKey = getResendApiKey();
	const from = getFromEmail();

	if (!apiKey) {
		const { mode } = getConfig();
		if (mode === 'demo') {
			// The Demo never sends or logs email (ADR 0007).
			return ok({ id: `demo_email_${crypto.randomUUID()}`, mode: 'suppressed' });
		}
		if (!allowsStandIn('email', mode)) {
			// Production: no console fallback, so bodies, tokens and links are never logged.
			return err({ code: 'EMAIL_UNAVAILABLE', message: FEATURE_UNAVAILABLE.email });
		}
		// Development and test only.
		const devId = `dev_email_${crypto.randomUUID()}`;
		console.info(
			`[email:dev-fallback] RESEND_API_KEY not configured. Simulated send id=${devId} to=${parsed.data.to} subject="${parsed.data.subject}"`
		);
		console.info(`[email:dev-fallback:body]\n${parsed.data.text}`);
		return ok({ id: devId, mode: 'dev_console' });
	}

	const payload = {
		from,
		to: [parsed.data.to],
		subject: parsed.data.subject,
		html: parsed.data.html,
		text: parsed.data.text
	};

	try {
		const sdkClient = await resolveResendClient(apiKey);
		if (sdkClient) {
			const { data, error: sdkError } = await sdkClient.emails.send(payload);
			if (sdkError || !data?.id) {
				return err({
					code: 'EMAIL_SEND_FAILED',
					message: sdkError?.message || 'Resend SDK returned an empty response.'
				});
			}
			return ok({ id: data.id, mode: 'resend' });
		}

		return await sendViaResendHttp(apiKey, payload);
	} catch (error) {
		return err({
			code: 'EMAIL_SEND_FAILED',
			message: `Failed to send transactional email via Resend: ${error instanceof Error ? error.message : String(error)}`
		});
	}
}

export async function sendVerificationEmail(input: {
	to: string;
	artistName: string;
	verificationUrl: string;
}): Promise<Result<EmailSendReceipt, DomainError>> {
	const parsed = verificationEmailInputSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_EMAIL_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid verification email input.'
		});
	}

	const template = buildEmailVerificationTemplate({
		artistName: parsed.data.artistName,
		verificationUrl: parsed.data.verificationUrl
	});

	return sendTransactionalEmail({
		to: parsed.data.to,
		...template
	});
}

export async function sendPasswordResetEmail(input: {
	to: string;
	artistName: string;
	resetUrl: string;
}): Promise<Result<EmailSendReceipt, DomainError>> {
	const parsed = passwordResetInputSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_EMAIL_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid password reset email input.'
		});
	}

	const template = buildPasswordResetTemplate({
		artistName: parsed.data.artistName,
		resetUrl: parsed.data.resetUrl
	});

	return sendTransactionalEmail({
		to: parsed.data.to,
		...template
	});
}

/**
 * Sends SPEC 6.4 payout account change confirmation email.
 * Protects shared bandmate logins from unauthorized payout destination changes.
 */
export async function sendPayoutAccountChangeConfirmationEmail(input: {
	to: string;
	artistName: string;
	confirmationUrl: string;
	newStripeAccountId: string;
}): Promise<Result<EmailSendReceipt, DomainError>> {
	const parsed = payoutChangeInputSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_EMAIL_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid payout change email input.'
		});
	}

	const template = buildPayoutAccountChangeTemplate({
		artistName: parsed.data.artistName,
		confirmationUrl: parsed.data.confirmationUrl,
		newStripeAccountId: parsed.data.newStripeAccountId
	});

	return sendTransactionalEmail({
		to: parsed.data.to,
		...template
	});
}

export async function sendSlugPetitionConfirmationEmail(input: {
	to: string;
	petitionerName: string;
	requestedSlug: string;
	existingArtistClosed: boolean;
}): Promise<Result<EmailSendReceipt, DomainError>> {
	const parsed = slugPetitionEmailInputSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_EMAIL_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid handle petition email input.'
		});
	}

	const template = buildSlugPetitionConfirmationTemplate({
		petitionerName: parsed.data.petitionerName,
		requestedSlug: parsed.data.requestedSlug,
		existingArtistClosed: parsed.data.existingArtistClosed
	});

	return sendTransactionalEmail({
		to: parsed.data.to,
		...template
	});
}

export async function sendSlugPetitionDecisionEmail(input: {
	to: string;
	petitionerName: string;
	requestedSlug: string;
	decision: 'approved' | 'rejected';
	note?: string;
}): Promise<Result<EmailSendReceipt, DomainError>> {
	const parsed = slugPetitionDecisionEmailInputSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_EMAIL_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid handle petition decision email input.'
		});
	}

	const template = buildSlugPetitionDecisionTemplate({
		petitionerName: parsed.data.petitionerName,
		requestedSlug: parsed.data.requestedSlug,
		decision: parsed.data.decision,
		note: parsed.data.note
	});

	return sendTransactionalEmail({
		to: parsed.data.to,
		...template
	});
}

const venmoChangeConfirmationInputSchema = z.object({
	to: z.string().email('Valid recipient email is required'),
	artistName: z.string().min(1).max(120),
	oldUsername: z.string().min(1).max(64),
	newUsername: z.string().min(1).max(64).nullable(),
	confirmationUrl: z.string().url('Valid confirmation URL is required')
});

/** Single-use link to confirm a Venmo username change or removal (ADR 0008). */
export async function sendVenmoChangeConfirmationEmail(input: {
	to: string;
	artistName: string;
	oldUsername: string;
	newUsername: string | null;
	confirmationUrl: string;
}): Promise<Result<EmailSendReceipt, DomainError>> {
	const parsed = venmoChangeConfirmationInputSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_EMAIL_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid Venmo change email input.'
		});
	}
	return sendTransactionalEmail({
		to: parsed.data.to,
		...buildVenmoChangeConfirmationTemplate(parsed.data)
	});
}

const venmoChangedNoticeInputSchema = z.object({
	to: z.string().email('Valid recipient email is required'),
	artistName: z.string().min(1).max(120),
	newUsername: z.string().min(1).max(64).nullable()
});

/** Notice after a Venmo username change or removal is applied (ADR 0008). */
export async function sendVenmoChangedNoticeEmail(input: {
	to: string;
	artistName: string;
	newUsername: string | null;
}): Promise<Result<EmailSendReceipt, DomainError>> {
	const parsed = venmoChangedNoticeInputSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_EMAIL_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid Venmo notice email input.'
		});
	}
	return sendTransactionalEmail({
		to: parsed.data.to,
		...buildVenmoChangedNoticeTemplate(parsed.data)
	});
}
