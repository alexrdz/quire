import { test, expect } from '@playwright/test';

/** The demo-mode project really runs the Demo (P4L-T03): mode, stand-ins and sample data. */
test('reports Demo mode, healthy, with stand-ins and simulated tips', async ({ request }) => {
	const response = await request.get('/healthz');
	expect(response.status()).toBe(200);
	const body = await response.json();
	expect(body).toMatchObject({ ok: true, mode: 'demo', core: 'ok', db: 'ok' });
	expect(body.features).toMatchObject({ mode: 'demo', tipsOpenVenmo: false, email: false, uploads: true });
});
