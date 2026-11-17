import {
	type ArtistId,
	type IssueId,
	type Result,
	type DomainError,
	ok,
	err
} from './types';

export const MIN_TIP_CENTS = 200; // $2.00
export const MAX_TIP_CENTS = 50000; // $500.00
export const PLATFORM_FEE_PERCENT = 0.05; // 5% Bandcamp-style
export const STRIPE_PERCENT = 0.029; // 2.9%
export const STRIPE_FIXED_CENTS = 30; // $0.30

/**
 * Canonical tip lifecycle statuses shared across domain, Zod schemas, DB, and UI.
 */
export const TipStatus = {
	Succeeded: 'succeeded',
	Refunded: 'refunded',
	Disputed: 'disputed'
} as const;

export type TipStatus = (typeof TipStatus)[keyof typeof TipStatus];

export const TIP_STATUSES = [
	TipStatus.Succeeded,
	TipStatus.Refunded,
	TipStatus.Disputed
] as const;

/**
 * Subset of TipStatus representing reversed tips absorbed by the artist (SPEC 5.4).
 */
export const TipReversalStatus = {
	Refunded: TipStatus.Refunded,
	Disputed: TipStatus.Disputed
} as const;

export type TipReversalStatus = (typeof TipReversalStatus)[keyof typeof TipReversalStatus];

export const TIP_REVERSAL_STATUSES = [
	TipReversalStatus.Refunded,
	TipReversalStatus.Disputed
] as const;

export interface TipLedgerFields {
	amountGross: number;
	feeStripe: number;
	feePlatform: number;
	amountNet: number;
	fanCoveredFees: boolean;
}

export interface SucceededTipRecord extends TipLedgerFields {
	status: typeof TipStatus.Succeeded;
	refundedAt: null;
}

export interface ReversedTipRecord extends TipLedgerFields {
	status: TipReversalStatus;
	refundedAt: Date;
}

export type RecordedTip = SucceededTipRecord | ReversedTipRecord;

export interface TipSummaryInput extends TipLedgerFields {
	status: TipStatus;
}

export interface TipSummaryTotals {
	tipCount: number;
	succeededCount: number;
	refundCount: number;
	disputeCount: number;
	grossCents: number;
	feesCents: number;
	reversalsCents: number;
	netCents: number;
}

export function isTipReversed(status: TipStatus): status is TipReversalStatus {
	return status === TipReversalStatus.Refunded || status === TipReversalStatus.Disputed;
}

/**
 * Computes the original pre-reversal net payout to an artist for a tip.
 */
export function calculateTipBaseNetCents(tip: {
	amountGross: number;
	feeStripe: number;
	feePlatform: number;
	fanCoveredFees: boolean;
}): number {
	return tip.fanCoveredFees
		? tip.amountGross - tip.feePlatform
		: Math.max(0, tip.amountGross - tip.feePlatform - tip.feeStripe);
}

/**
 * Computes the absorbed reversal deduction (refund or chargeback) in cents for a tip.
 */
export function calculateTipReversalCents(tip: TipSummaryInput): number {
	if (!isTipReversed(tip.status)) {
		return 0;
	}
	const baseNetCents = calculateTipBaseNetCents(tip);
	return Math.max(0, baseNetCents - tip.amountNet);
}

/**
 * Aggregates gross, fees, absorbed reversals, and net payout across a collection of tips.
 */
export function summarizeArtistTips(tips: ReadonlyArray<TipSummaryInput>): TipSummaryTotals {
	let succeededCount = 0;
	let refundCount = 0;
	let disputeCount = 0;
	let grossCents = 0;
	let feesCents = 0;
	let reversalsCents = 0;
	let netCents = 0;

	for (const tip of tips) {
		grossCents += tip.amountGross;
		feesCents += tip.feeStripe + tip.feePlatform;
		netCents += tip.amountNet;

		switch (tip.status) {
			case TipStatus.Succeeded:
				succeededCount += 1;
				break;
			case TipStatus.Refunded:
				refundCount += 1;
				reversalsCents += calculateTipReversalCents(tip);
				break;
			case TipStatus.Disputed:
				disputeCount += 1;
				reversalsCents += calculateTipReversalCents(tip);
				break;
		}
	}

	return {
		tipCount: tips.length,
		succeededCount,
		refundCount,
		disputeCount,
		grossCents,
		feesCents,
		reversalsCents,
		netCents
	};
}

/**
 * Formats integer cents as USD, placing any negative sign before the dollar symbol (-$1.09).
 */
export function formatUsdCents(cents: number): string {
	const sign = cents < 0 ? '-' : '';
	const dollars = (Math.abs(cents) / 100).toFixed(2);
	return `${sign}$${dollars}`;
}

export interface TipBreakdown {
	grossCents: number;
	feePlatformCents: number;
	feeStripeCents: number;
	netArtistCents: number;
	totalChargedCents: number;
	fanCoveredFees: boolean;
}

export function calculateTipBreakdown(
	amountGrossCents: number,
	fanCoveredFees: boolean
): Result<TipBreakdown, DomainError> {
	if (!Number.isInteger(amountGrossCents)) {
		return err({
			code: 'INVALID_AMOUNT',
			message: 'Tip amount must be an integer in cents.'
		});
	}

	if (amountGrossCents < MIN_TIP_CENTS) {
		return err({
			code: 'AMOUNT_BELOW_MINIMUM',
			message: `Minimum tip is $${(MIN_TIP_CENTS / 100).toFixed(2)} USD.`
		});
	}

	if (amountGrossCents > MAX_TIP_CENTS) {
		return err({
			code: 'AMOUNT_ABOVE_MAXIMUM',
			message: `Maximum tip is $${(MAX_TIP_CENTS / 100).toFixed(2)} USD.`
		});
	}

	const feePlatformCents = Math.round(amountGrossCents * PLATFORM_FEE_PERCENT);

	if (fanCoveredFees) {
		// When fan covers fees, gross + Stripe fee is charged to fan
		// Stripe fee on gross: (gross * 0.029 + 30) / (1 - 0.029) or simple calculation
		const feeStripeCents = Math.round(amountGrossCents * STRIPE_PERCENT + STRIPE_FIXED_CENTS);
		const totalChargedCents = amountGrossCents + feeStripeCents;
		const netArtistCents = amountGrossCents - feePlatformCents;

		return ok({
			grossCents: amountGrossCents,
			feePlatformCents,
			feeStripeCents,
			netArtistCents,
			totalChargedCents,
			fanCoveredFees: true
		});
	} else {
		// Artist absorbs Stripe fee
		const feeStripeCents = Math.round(amountGrossCents * STRIPE_PERCENT + STRIPE_FIXED_CENTS);
		const totalChargedCents = amountGrossCents;
		const netArtistCents = Math.max(0, amountGrossCents - feePlatformCents - feeStripeCents);

		return ok({
			grossCents: amountGrossCents,
			feePlatformCents,
			feeStripeCents,
			netArtistCents,
			totalChargedCents,
			fanCoveredFees: false
		});
	}
}

/**
 * Tip Checkout Finite State Machine (FSM)
 * States: idle -> initiating -> awaiting_payment -> succeeded | failed -> reset (to idle)
 * Enforces Decision 18: No background retry, reset on signal loss.
 */
export type TipState =
	| { status: 'idle' }
	| {
			status: 'initiating';
			artistId: ArtistId;
			issueId: IssueId | null;
			grossCents: number;
			fanCoveredFees: boolean;
	  }
	| {
			status: 'awaiting_payment';
			artistId: ArtistId;
			issueId: IssueId | null;
			breakdown: TipBreakdown;
			paymentSessionId: string;
	  }
	| {
			status: 'succeeded';
			artistId: ArtistId;
			issueId: IssueId | null;
			breakdown: TipBreakdown;
			paymentId: string;
			completedAt: Date;
	  }
	| {
			status: 'failed';
			reason: string;
			failedAt: Date;
	  };

export type TipEvent =
	| {
			type: 'SELECT_AMOUNT';
			artistId: ArtistId;
			issueId: IssueId | null;
			grossCents: number;
			fanCoveredFees: boolean;
	  }
	| {
			type: 'SESSION_CREATED';
			breakdown: TipBreakdown;
			paymentSessionId: string;
	  }
	| {
			type: 'PAYMENT_SUCCEEDED';
			paymentId: string;
			completedAt?: Date;
	  }
	| {
			type: 'PAYMENT_FAILED';
			reason: string;
	  }
	| {
			type: 'RESET';
	  };

export function tipCheckoutTransition(
	currentState: TipState,
	event: TipEvent
): Result<TipState, DomainError> {
	switch (currentState.status) {
		case 'idle': {
			if (event.type === 'SELECT_AMOUNT') {
				const breakdownResult = calculateTipBreakdown(
					event.grossCents,
					event.fanCoveredFees
				);
				if (!breakdownResult.ok) {
					return err(breakdownResult.error);
				}
				return ok({
					status: 'initiating',
					artistId: event.artistId,
					issueId: event.issueId,
					grossCents: event.grossCents,
					fanCoveredFees: event.fanCoveredFees
				});
			}
			return err({
				code: 'INVALID_EVENT',
				message: `Cannot handle event '${event.type}' while in 'idle' state.`
			});
		}

		case 'initiating': {
			if (event.type === 'SESSION_CREATED') {
				return ok({
					status: 'awaiting_payment',
					artistId: currentState.artistId,
					issueId: currentState.issueId,
					breakdown: event.breakdown,
					paymentSessionId: event.paymentSessionId
				});
			}
			if (event.type === 'PAYMENT_FAILED') {
				return ok({
					status: 'failed',
					reason: event.reason,
					failedAt: new Date()
				});
			}
			if (event.type === 'RESET') {
				return ok({ status: 'idle' });
			}
			return err({
				code: 'INVALID_EVENT',
				message: `Cannot handle event '${event.type}' while in 'initiating' state.`
			});
		}

		case 'awaiting_payment': {
			if (event.type === 'PAYMENT_SUCCEEDED') {
				return ok({
					status: 'succeeded',
					artistId: currentState.artistId,
					issueId: currentState.issueId,
					breakdown: currentState.breakdown,
					paymentId: event.paymentId,
					completedAt: event.completedAt ?? new Date()
				});
			}
			if (event.type === 'PAYMENT_FAILED') {
				return ok({
					status: 'failed',
					reason: event.reason,
					failedAt: new Date()
				});
			}
			if (event.type === 'RESET') {
				return ok({ status: 'idle' });
			}
			return err({
				code: 'INVALID_EVENT',
				message: `Cannot handle event '${event.type}' while in 'awaiting_payment' state.`
			});
		}

		case 'succeeded':
		case 'failed': {
			if (event.type === 'RESET') {
				return ok({ status: 'idle' });
			}
			return err({
				code: 'TERMINAL_STATE',
				message: `Tip flow is in '${currentState.status}' state. Must be RESET to return to idle.`
			});
		}
	}
}
