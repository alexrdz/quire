import { expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

/**
 * Raw SvelteKit form-action calls and password sign-in for e2e specs.
 *
 * `postAction` sends what an enhanced form sends (the `x-sveltekit-action`
 * header and a same-origin Origin), so the answer is SvelteKit's JSON
 * ({ type: 'failure' | 'redirect' | 'success', status, data | location })
 * instead of a rendered page. Uploads are files in `fields`.
 */
export type FieldValue = string | { name: string; mimeType: string; buffer: Buffer };

export interface ActionResult {
	httpStatus: number;
	type: string;
	status: number;
	location?: string;
	/** The devalue-encoded action data, as text: check messages with `toContain`. */
	data: string;
}

export async function postAction(
	request: APIRequestContext,
	baseURL: string,
	pathAndAction: string,
	fields: Record<string, FieldValue> = {}
): Promise<ActionResult> {
	const response: APIResponse = await request.post(pathAndAction, {
		headers: { origin: baseURL, 'x-sveltekit-action': 'true', accept: 'application/json' },
		multipart: fields,
		maxRedirects: 0
	});
	const httpStatus = response.status();
	const text = await response.text();
	let body: { type?: string; status?: number; location?: string; data?: string } = {};
	try {
		body = JSON.parse(text);
	} catch {
		// Not an action response (e.g. a 500 page): keep the text for the assertion message.
		body = { type: 'non-json', data: text };
	}
	return {
		httpStatus,
		type: body.type ?? 'unknown',
		status: body.status ?? httpStatus,
		location: body.location,
		data: typeof body.data === 'string' ? body.data : JSON.stringify(body.data ?? '')
	};
}

/** Signs in through the real /login form and waits for the dashboard. */
export async function signInWithPassword(page: Page, email: string, password: string): Promise<void> {
	await page.goto('/login');
	await page.locator('#email').fill(email);
	await page.locator('#password').fill(password);
	await page.locator('button.btn-band-submit').click();
	await expect(page).toHaveURL(/\/dashboard/);
}
