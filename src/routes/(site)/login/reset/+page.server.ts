import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { getConfig } from '$lib/server/config';
import { featureUnavailableMessage } from '$lib/features';
import { auth } from '$lib/server/auth';
import { consumeRateLimit } from '$lib/server/services/rate-limit';
import { passwordResetConfirmSchema, passwordResetRequestSchema } from '$schemas/auth';

const NON_ENUMERATING_RESET_MESSAGE =
	'If an account exists for that email, a reset link has been sent.';

export const load: ServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token')?.trim() || '';
	const urlError = url.searchParams.get('error')?.trim() || '';

	if (token) {
		return {
			mode: 'confirm' as const,
			token,
			tokenError: null
		};
	}

	const tokenError =
		urlError === 'INVALID_TOKEN'
			? 'This password reset link is invalid or has expired. Please request a new reset link.'
			: null;

	return {
		mode: 'request' as const,
		token: '',
		tokenError
	};
};

export const actions: Actions = {
	request: async ({ request, getClientAddress }) => {
		const { features, mode } = getConfig();
		if (!features.email) {
			return fail(503, {
				action: 'request' as const,
				error: featureUnavailableMessage('email', mode),
				email: ''
			});
		}

		const formData = await request.formData();
		const emailRaw = String(formData.get('email') || '');
		const parsed = passwordResetRequestSchema.safeParse({ email: emailRaw });

		if (!parsed.success) {
			return fail(400, {
				action: 'request' as const,
				error: parsed.error.issues[0]?.message || 'Please enter a valid email address.',
				email: emailRaw
			});
		}

		const resetLimit = await consumeRateLimit('passwordResetIp', getClientAddress());
		if (!resetLimit.allowed) {
			return fail(429, {
				action: 'request' as const,
				error: resetLimit.message,
				email: parsed.data.email
			});
		}

		try {
			await auth.api.requestPasswordReset({
				body: {
					email: parsed.data.email,
					redirectTo: '/login/reset'
				},
				headers: request.headers
			});
		} catch (err: unknown) {
			console.error('Password reset request warning:', err);
		}

		return {
			action: 'request' as const,
			sent: true,
			message: NON_ENUMERATING_RESET_MESSAGE
		};
	},

	confirm: async ({ request, getClientAddress }) => {
		const formData = await request.formData();
		const token = String(formData.get('token') || '').trim();
		const newPassword = String(formData.get('newPassword') || '');
		const confirmPassword = String(formData.get('confirmPassword') || '');

		const parsed = passwordResetConfirmSchema.safeParse({ token, newPassword });
		if (!parsed.success) {
			return fail(400, {
				action: 'confirm' as const,
				error:
					parsed.error.issues[0]?.message ||
					'Reset token and a new password of at least 8 characters are required.'
			});
		}

		if (confirmPassword !== newPassword) {
			return fail(400, {
				action: 'confirm' as const,
				error: 'Passwords do not match.'
			});
		}

		const confirmLimit = await consumeRateLimit('passwordResetIp', getClientAddress());
		if (!confirmLimit.allowed) {
			return fail(429, {
				action: 'confirm' as const,
				error: confirmLimit.message
			});
		}

		try {
			await auth.api.resetPassword({
				body: {
					newPassword: parsed.data.newPassword,
					token: parsed.data.token
				},
				headers: request.headers
			});
		} catch {
			return fail(400, {
				action: 'confirm' as const,
				error: 'This reset link is invalid or has expired. Please request a new reset link.'
			});
		}

		throw redirect(303, '/login?reset=success');
	}
};
