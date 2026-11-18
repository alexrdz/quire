<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Box, Cluster, Container, Stack } from '$lib/components/layout';

	/**
	 * "Confirm your email to publish" bar (PRODUCTION_PLAN 2.4, decision 31).
	 * Shown on every dashboard page until the band email is confirmed. The resend
	 * action lives on /dashboard and is rate-limited per artist.
	 */
	interface Props {
		email: string;
		canResend: boolean;
		unavailableMessage: string | null;
	}

	let { email, canResend, unavailableMessage }: Props = $props();

	let sending = $state(false);
	let feedback = $state<{ kind: 'sent' | 'error'; text: string } | null>(null);

	// Without JavaScript the form posts to /dashboard and the result arrives as the page form.
	const pageFeedback = $derived.by(() => {
		const form = page.form as { verificationEmailSent?: boolean; accountError?: string } | null;
		if (form?.verificationEmailSent) return { kind: 'sent' as const, text: `Sent. Check ${email}.` };
		if (typeof form?.accountError === 'string') return { kind: 'error' as const, text: form.accountError };
		return null;
	});

	const shown = $derived(feedback ?? pageFeedback);
</script>

<Box as="aside" padding="none" border="none" class="email-confirm-bar" aria-label="Confirm your email">
	<Container width="lg" padding="none">
		<Cluster justify="between" align="center" gap="sm" class="email-confirm-bar-inner">
			<Stack gap="3xs">
				<strong class="email-confirm-bar-title">Confirm your email to publish</strong>
				<p class="email-confirm-bar-text">
					We sent a confirmation link to <span class="font-mono">{email}</span>. You can build drafts now;
					publishing an Issue, uploading media and adding your Venmo open up once it is confirmed.
				</p>
				{#if !canResend && unavailableMessage}
					<p class="email-confirm-bar-text" role="status">
						{unavailableMessage} The confirmation email can't be resent until email is back.
					</p>
				{/if}
				{#if shown}
					<p
						class="email-confirm-bar-feedback"
						data-kind={shown.kind}
						role={shown.kind === 'error' ? 'alert' : 'status'}
					>
						{shown.text}
					</p>
				{/if}
			</Stack>

			<form
				method="POST"
				action="/dashboard?/resendVerification"
				use:enhance={() => {
					sending = true;
					return async ({ result }) => {
						sending = false;
						if (result.type === 'success') {
							feedback = { kind: 'sent', text: `Sent. Check ${email}.` };
						} else if (result.type === 'failure') {
							feedback = {
								kind: 'error',
								text: String(result.data?.accountError ?? 'Could not send the email. Try again later.')
							};
						} else {
							feedback = { kind: 'error', text: 'Could not send the email. Try again later.' };
						}
					};
				}}
			>
				<button type="submit" class="email-confirm-bar-button" disabled={!canResend || sending}>
					{sending ? 'Sending...' : 'Resend email'}
				</button>
			</form>
		</Cluster>
	</Container>
</Box>
