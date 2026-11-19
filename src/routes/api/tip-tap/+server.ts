import type { RequestHandler } from './$types';
import { getOrCreateTipDeviceId } from '$lib/server/services/rate-limit';
import { recordTipTap } from '$lib/server/services/tip-taps';

/**
 * Records a Tip Tap (ADR 0008, PRODUCTION_PLAN V.4).
 *
 * Called by the tip button with `navigator.sendBeacon` (or `fetch` with
 * keepalive) at the moment the Fan taps. Opening Venmo never waits for this:
 * the button is a real link, and the beacon is fire-and-forget. The endpoint
 * always answers quickly and never throws; a tap that cannot be counted is
 * simply not counted.
 *
 * Body: JSON `{ artistSlug, issueSlug | null, amountCents }`. Only slugs are
 * accepted; artist and Issue ids are derived on the server.
 */
const MAX_BODY_BYTES = 1024;

const STATUS: Record<string, number> = {
	invalid: 400,
	not_found: 404,
	duplicate: 200,
	rate_limited: 429,
	error: 503
};

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	let body: unknown = null;
	try {
		const text = await request.text();
		if (text.length <= MAX_BODY_BYTES) body = JSON.parse(text);
	} catch {
		body = null;
	}

	let clientAddress = 'unknown';
	try {
		clientAddress = getClientAddress();
	} catch {
		// Without an address the per-device limit still applies.
	}

	const result = await recordTipTap(body, {
		deviceId: getOrCreateTipDeviceId(cookies),
		clientAddress
	});

	return Response.json(
		result.recorded ? { recorded: true } : { recorded: false, reason: result.reason },
		{ status: result.recorded ? 201 : (STATUS[result.reason] ?? 400), headers: { 'cache-control': 'no-store' } }
	);
};
