/**
 * Brand helper for nominal/branded types.
 * Prevents accidental transposition of IDs and sensitive strings.
 */
declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type ArtistId = Brand<string, 'ArtistId'>;
export type IssueId = Brand<string, 'IssueId'>;
export type FanUserId = Brand<string, 'FanUserId'>;
export type ScanTokenHash = Brand<string, 'ScanTokenHash'>;
export type NoteId = Brand<string, 'NoteId'>;
export type TipId = Brand<string, 'TipId'>;

export function createArtistId(id: string): ArtistId {
	return id as ArtistId;
}

export function createIssueId(id: string): IssueId {
	return id as IssueId;
}

export function createFanUserId(id: string): FanUserId {
	return id as FanUserId;
}

export function createScanTokenHash(hash: string): ScanTokenHash {
	return hash as ScanTokenHash;
}

export function createNoteId(id: string): NoteId {
	return id as NoteId;
}

export function createTipId(id: string): TipId {
	return id as TipId;
}

/**
 * Result type for pure domain operations.
 */
export type Result<T, E = DomainError> =
	| { ok: true; value: T }
	| { ok: false; error: E };

export interface DomainError {
	code: string;
	message: string;
	details?: unknown;
}

export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

export function err<E = DomainError>(error: E): Result<never, E> {
	return { ok: false, error };
}

/**
 * Money value object in cents to prevent floating point inaccuracies.
 */
export interface Money {
	amountCents: number;
	currency: 'USD';
}

export function createMoney(amountCents: number): Result<Money> {
	if (!Number.isInteger(amountCents)) {
		return err({ code: 'INVALID_AMOUNT', message: 'Amount in cents must be an integer' });
	}
	if (amountCents < 0) {
		return err({ code: 'NEGATIVE_AMOUNT', message: 'Amount cannot be negative' });
	}
	return ok({ amountCents, currency: 'USD' });
}
