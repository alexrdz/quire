import { test, expect } from '@playwright/test';
import { resetRateLimits } from './helpers/db';

test.describe('Sign out is POST-only (PRODUCTION_PLAN 2.2)', () => {
	test.beforeAll(async () => {
		await resetRateLimits();
	});

	test('GET /logout returns 405', async ({ request }) => {
		const response = await request.get('/logout', { maxRedirects: 0 });
		expect(response.status()).toBe(405);
	});

	test('GET /logout with an open-redirect payload still returns 405 and redirects nowhere', async ({ request }) => {
		const response = await request.get('/logout?redirect=//evil.com', { maxRedirects: 0 });
		expect(response.status()).toBe(405);
		expect(response.headers()['location']).toBeUndefined();
	});

	test('the dashboard Sign Out button posts the form and signs the artist out', async ({ page }) => {
		await page.goto('/login');
		await page.locator('#email').fill('demo@neonvelvet.band');
		await page.locator('#password').fill('neonvelvet123');
		await page.locator('button.btn-band-submit').click();
		await expect(page).toHaveURL(/\/dashboard/);

		await page.getByRole('button', { name: 'Sign Out' }).click();
		await expect(page).toHaveURL(/\/$/);

		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login/);
	});
});
