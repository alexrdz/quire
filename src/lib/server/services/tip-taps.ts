/**
 * Tip Taps (ADR 0008, PRODUCTION_PLAN V.4).
 *
 * A Tip Tap means a Fan tapped a tip button. It is not a payment: the payment
 * happens in Venmo, and Quire cannot see whether it went through. Taps are
 * counted, never summed into money, and carry no Fan identity.
 *
 * Recording is best-effort. `recordTipTap` never throws: invalid input, an
 * unknown Artist or Issue, a double tap, a rate limit or a database error all
 * return `recorded: false`, and the Fan still gets Venmo.
 */
import crypto from 'node:crypto';
import { and, count, eq } from 'drizzle-orm';
import { ArtistAccountStatus } from '$domain/account';
import { tipTapSchema, type TipTapInput } from '$schemas/tipping';
import { db, schema } from '../db';
import { claimOnceWithin, consumeRateLimits } from './rate-limit';
import { isPubliclyReadable } from '$domain/issue';

export type TipTapSkipReason = 'invalid' | 'not_found' | 'duplicate' | 'rate_limited' | 'error';

export type TipTapResult =
	| { recorded: true; tapId: string }
	| { recorded: false; reason: TipTapSkipReason };

export interface TipTapContext {
	/** Signed tip-device cookie id (rate limit and double-tap key). */
	deviceId: string;
	/** From `event.getClientAddress()`. */
	clientAddress: string;
	now?: Date;
}

/**
 * Records one Tip Tap. Artist and Issue ids are looked up from the slugs; ids
 * sent by the client are never used.
 */
export async function recordTipTap(raw: unknown, ctx: TipTapContext): Promise<TipTapResult> {
	const parsed = tipTapSchema.safeParse(raw);
	if (!parsed.success) return { recorded: false, reason: 'invalid' };
	const input: TipTapInput = parsed.data;
	const now = ctx.now ?? new Date();

	try {
		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, input.artistSlug),
			columns: { id: true, venmoUsername: true, accountStatus: true }
		});
		if (!artist || !artist.venmoUsername || artist.accountStatus === ArtistAccountStatus.Closed) {
			return { recorded: false, reason: 'not_found' };
		}

		let issueId: string | null = null;
		if (input.issueSlug) {
			const issue = await db.query.issues.findFirst({
				where: and(eq(schema.issues.slug, input.issueSlug), eq(schema.issues.artistId, artist.id)),
				columns: { id: true, status: true }
			});
			// No Tip Tap against a draft: it is not public (B1-T34).
			if (!issue || !isPubliclyReadable(issue)) return { recorded: false, reason: 'not_found' };
			issueId = issue.id;
		}

		// A double tap on the same button counts once, and does not use up the limits.
		const repeatKey = `${ctx.deviceId}|${artist.id}|${issueId ?? 'general'}|${input.amountCents}`;
		if (!(await claimOnceWithin('tipTapRepeat', repeatKey, now))) {
			return { recorded: false, reason: 'duplicate' };
		}

		const limit = await consumeRateLimits(
			[
				['tipDevice', ctx.deviceId],
				['tipIp', ctx.clientAddress]
			],
			now
		);
		if (!limit.allowed) return { recorded: false, reason: 'rate_limited' };

		const tapId = crypto.randomUUID();
		await db.insert(schema.tipTaps).values({
			id: tapId,
			artistId: artist.id,
			issueId,
			amountSelectedCents: input.amountCents,
			createdAt: now
		});
		return { recorded: true, tapId };
	} catch (error) {
		console.error('[tip-taps] Could not record a tip tap.', error);
		return { recorded: false, reason: 'error' };
	}
}

export interface TipTapCounts {
	total: number;
	/** Taps from the Back Page General tip button. */
	general: number;
	/** Taps per Issue id. */
	byIssue: Record<string, number>;
}

/** Tap counts for an Artist's dashboard. Counts only: never amounts. */
export async function countTipTaps(artistId: string): Promise<TipTapCounts> {
	const rows = await db
		.select({ issueId: schema.tipTaps.issueId, taps: count() })
		.from(schema.tipTaps)
		.where(eq(schema.tipTaps.artistId, artistId))
		.groupBy(schema.tipTaps.issueId);

	const counts: TipTapCounts = { total: 0, general: 0, byIssue: {} };
	for (const row of rows) {
		const taps = Number(row.taps);
		counts.total += taps;
		if (row.issueId === null) counts.general += taps;
		else counts.byIssue[row.issueId] = taps;
	}
	return counts;
}
