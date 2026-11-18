import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';

// Outside a SvelteKit request there is no page state; the bar only reads `page.form`.
vi.mock('$app/state', () => ({ page: { form: null } }));

const { default: EmailConfirmBar } = await import('$lib/components/dashboard/EmailConfirmBar.svelte');

describe('EmailConfirmBar (PRODUCTION_PLAN 2.4)', () => {
	it('asks the artist to confirm and offers a resend that posts to the dashboard', () => {
		const { body } = render(EmailConfirmBar, {
			props: { email: 'band@example.com', canResend: true, unavailableMessage: null }
		});
		expect(body).toContain('Confirm your email to publish');
		expect(body).toContain('band@example.com');
		expect(body).toMatch(/<form[^>]*method="POST"[^>]*action="\/dashboard\?\/resendVerification"/);
		expect(body).not.toMatch(/<button[^>]*disabled/);
		expect(body).not.toMatch(/style="/);
	});

	it('says email cannot be sent and disables resend when email is off', () => {
		const { body } = render(EmailConfirmBar, {
			props: {
				email: 'band@example.com',
				canResend: false,
				unavailableMessage: "We can't send email right now."
			}
		});
		expect(body).toMatch(/We can(&#39;|')t send email right now\./);
		expect(body).toMatch(/<button[^>]*disabled/);
	});
});
