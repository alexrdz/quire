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
