import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '$lib/server/config';

/**
 * Runs the service guards against a production config with every integration
 * missing (tier 2), while keeping the local test database usable.
 */
const state = vi.hoisted(() => ({ override: null as null | ((base: Config) => Config) }));

vi.mock('$lib/server/config', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/config')>();
	return {
		...actual,
		getConfig: () => {
			const base = actual.getConfig();
			return state.override ? state.override(base) : base;
		}
	};
});

const productionWithoutIntegrations = (base: Config): Config => ({
	...base,
	mode: 'production',
	isDeployed: true,
	features: { payments: false, email: false, fanSignIn: false, uploads: false },
	live: { payments: false, email: false, fanSignIn: false, uploads: false }
});

describe('service guards in production without integrations', () => {
	beforeEach(() => {
		state.override = productionWithoutIntegrations;
	});

	it('refuses tips instead of simulating them', async () => {
		const { createTipCheckout } = await import('$lib/server/services/payments');
		const result = await createTipCheckout({
			artistId: 'any',
			amountGrossCents: 500,
			returnUrl: 'https://quire.live/a/x'
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('PAYMENTS_UNAVAILABLE');
	});

	it('refuses email instead of logging it', async () => {
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});
		const { sendTransactionalEmail } = await import('$lib/server/email');
		const result = await sendTransactionalEmail({
			to: 'band@example.com',
			subject: 'Reset',
			html: '<p>secret-link</p>',
			text: 'secret-link'
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('EMAIL_UNAVAILABLE');
		expect(info).not.toHaveBeenCalled();
		info.mockRestore();
	});

	it('suppresses email silently in the Demo', async () => {
		state.override = (base) => ({ ...productionWithoutIntegrations(base), mode: 'demo' });
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});
		const { sendTransactionalEmail } = await import('$lib/server/email');
		const result = await sendTransactionalEmail({
			to: 'band@example.com',
			subject: 'Reset',
			html: '<p>secret-link</p>',
			text: 'secret-link'
		});
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.mode).toBe('suppressed');
		expect(info).not.toHaveBeenCalled();
		info.mockRestore();
	});

	it('refuses uploads instead of writing to local disk', async () => {
		const { uploadFormFile } = await import('$lib/server/services/storage');
		const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });
		const result = await uploadFormFile(file, { kind: 'image' });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('UPLOADS_UNAVAILABLE');
	});
});
