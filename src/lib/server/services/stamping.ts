import crypto from 'node:crypto';
import { getConfig } from '$lib/server/config';
import { db, schema } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import {
	calculateStampWindow,
	isWithinStampWindow,
	attendanceTransition,
	type AttendanceState
} from '$domain/stamping';
import {
	createFanUserId,
	createIssueId,
	createScanTokenHash,
	type Result,
	type DomainError,
	ok,
	err
} from '$domain/types';
import { isPubliclyReadable } from '$domain/issue';

const COOKIE_SECRET = getConfig().core.cookieSecret;

/**
 * Signs an attendance scan token using HMAC SHA-256.
 * Format: `${issueSlug}.${timestamp}.${hmacHex}`
 */
export function signScanToken(issueSlug: string, scannedAt: Date = new Date()): string {
	const timestamp = scannedAt.getTime();
	const payload = `${issueSlug}.${timestamp}`;
	const signature = crypto
		.createHmac('sha256', COOKIE_SECRET)
		.update(payload)
		.digest('hex');

	return `${payload}.${signature}`;
}

export interface VerifiedScanToken {
	issueSlug: string;
	scannedAt: Date;
	tokenHash: string;
}

/**
 * Verifies an HMAC attendance scan token.
 */
export function verifyScanToken(token: string): Result<VerifiedScanToken, DomainError> {
	const parts = token.split('.');
	if (parts.length !== 3) {
		return err({
			code: 'MALFORMED_TOKEN',
			message: 'Invalid scan token format.'
		});
	}

	const [issueSlug, timestampStr, signature] = parts;
	const timestamp = Number(timestampStr);

	if (isNaN(timestamp)) {
		return err({
			code: 'INVALID_TIMESTAMP',
			message: 'Token timestamp is invalid.'
		});
	}

	const payload = `${issueSlug}.${timestampStr}`;
	const expectedSignature = crypto
		.createHmac('sha256', COOKIE_SECRET)
		.update(payload)
		.digest('hex');

	// Timing-safe signature check
	const isSignatureValid =
		signature.length === expectedSignature.length &&
		crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

	if (!isSignatureValid) {
		return err({
			code: 'INVALID_SIGNATURE',
			message: 'Scan token signature mismatch or forgery detected.'
		});
	}

	const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

	return ok({
		issueSlug,
		scannedAt: new Date(timestamp),
		tokenHash
	});
}

/**
 * Validates a scan attempt against the issue's database record and Stamp Window.
 * Returns signed token on success.
 */
export async function processIssueScan(
	issueSlug: string,
	secretKey: string,
	currentTime: Date = new Date()
): Promise<Result<{ token: string; issueId: string; redirectUrl: string }, DomainError>> {
	const issue = await db.query.issues.findFirst({
		where: eq(schema.issues.slug, issueSlug)
	});

	if (!issue) {
		return err({
			code: 'ISSUE_NOT_FOUND',
			message: 'No issue found matching the scanned QR code.'
		});
	}

	if (issue.status !== 'published') {
		return err({
			code: 'ISSUE_NOT_PUBLISHED',
			message: `This issue is ${issue.status} and cannot be scanned.`
		});
	}

	// Verify secret key (constant time comparison)
	const secretMatches =
		issue.secretKey.length === secretKey.length &&
		crypto.timingSafeEqual(Buffer.from(issue.secretKey), Buffer.from(secretKey));

	if (!secretMatches) {
		return err({
			code: 'INVALID_SECRET_KEY',
			message: 'Invalid scan secret key.'
		});
	}

	// Verify Stamp Window
	const window = {
		start: issue.stampWindowStart ?? new Date(0),
		end: issue.stampWindowEnd ?? new Date(0)
	};

	if (!isWithinStampWindow(currentTime, window)) {
		return err({
			code: 'OUTSIDE_STAMP_WINDOW',
			message: 'The physical QR code was scanned outside of the 48-hour Stamp Window.'
		});
	}

	// Issue token
	const token = signScanToken(issue.slug, currentTime);
	const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

	// Record scan in database
	await db.insert(schema.scans).values({
		id: crypto.randomUUID(),
		issueId: issue.id,
		tokenHash,
		scannedAt: currentTime
	});

	return ok({
		token,
		issueId: issue.id,
		redirectUrl: `/i/${encodeURIComponent(issue.slug)}`
	});
}

/**
 * Claims a Stamp for a fan, upgrading any existing Save.
 */
export async function claimStampForFan(
	fanUserId: string,
	issueId: string,
	scanToken: string
): Promise<Result<{ collectionId: string; kind: 'stamped' }, DomainError>> {
	const tokenVerification = verifyScanToken(scanToken);
	if (!tokenVerification.ok) {
		return err(tokenVerification.error);
	}

	const issue = await db.query.issues.findFirst({
		where: eq(schema.issues.id, issueId)
	});

	// A draft can't be stamped: it is not public (B1-T34).
	if (!issue || !isPubliclyReadable(issue)) {
		return err({ code: 'ISSUE_NOT_FOUND', message: 'Issue does not exist.' });
	}

	// Verify that the token corresponds to this issue
	if (tokenVerification.value.issueSlug !== issue.slug) {
		return err({
			code: 'TOKEN_ISSUE_MISMATCH',
			message: 'Attendance token does not match this issue.'
		});
	}

	// Check if already stamped
	const existing = await db.query.collections.findFirst({
		where: and(
			eq(schema.collections.fanUserId, fanUserId),
			eq(schema.collections.issueId, issueId)
		)
	});

	if (existing && existing.kind === 'stamped') {
		return ok({ collectionId: existing.id, kind: 'stamped' });
	}

	if (existing && existing.kind === 'saved') {
		// Replace Save with Stamp (EDGE-CASES.md decision 23)
		await db
			.update(schema.collections)
			.set({ kind: 'stamped' })
			.where(eq(schema.collections.id, existing.id));

		return ok({ collectionId: existing.id, kind: 'stamped' });
	}

	const newId = crypto.randomUUID();
	await db.insert(schema.collections).values({
		id: newId,
		fanUserId,
		issueId,
		kind: 'stamped',
		createdAt: new Date()
	});

	return ok({ collectionId: newId, kind: 'stamped' });
}

/**
 * Saves/bookmarks an issue for a fan (without physical verification).
 */
export async function saveIssueForFan(
	fanUserId: string,
	issueId: string
): Promise<Result<{ collectionId: string; kind: 'saved' | 'stamped' }, DomainError>> {
	// Only an Issue anyone may read can be saved: never a draft, nor an id that doesn't exist (B1-T34).
	const issue = await db.query.issues.findFirst({ where: eq(schema.issues.id, issueId) });
	if (!issue || !isPubliclyReadable(issue)) {
		return err({ code: 'ISSUE_NOT_FOUND', message: 'Issue does not exist.' });
	}

	const existing = await db.query.collections.findFirst({
		where: and(
			eq(schema.collections.fanUserId, fanUserId),
			eq(schema.collections.issueId, issueId)
		)
	});

	if (existing) {
		return ok({ collectionId: existing.id, kind: existing.kind as 'saved' | 'stamped' });
	}

	const newId = crypto.randomUUID();
	await db.insert(schema.collections).values({
		id: newId,
		fanUserId,
		issueId,
		kind: 'saved',
		createdAt: new Date()
	});

	return ok({ collectionId: newId, kind: 'saved' });
}
