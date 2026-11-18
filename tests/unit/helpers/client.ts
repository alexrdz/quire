import crypto from 'node:crypto';

/**
 * A `getClientAddress` for fake request events. Each call returns a fresh,
 * random documentation-range address, so rate-limit counters from one test (or
 * an earlier run against the same local database) never leak into another.
 */
export function uniqueClientAddress(): () => string {
	const bytes = crypto.randomBytes(2);
	const address = `198.51.${bytes[0]}.${bytes[1]}`;
	return () => address;
}
