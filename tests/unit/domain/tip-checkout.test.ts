import { describe, it, expect } from 'vitest';
import {
	calculateTipBreakdown,
	calculateTipReversalCents,
	formatUsdCents,
	isTipReversed,
	summarizeArtistTips,
	tipCheckoutTransition,
	TipReversalStatus,
	TipStatus,
	type TipState,
	MIN_TIP_CENTS,
	MAX_TIP_CENTS
} from '$domain/tipping';
import { createArtistId, createIssueId } from '$domain/types';

describe('Tip Calculation & Checkout FSM', () => {
	const artistId = createArtistId('artist-1');
	const issueId = createIssueId('issue-1');

	describe('Fee Calculation', () => {
		it('calculates 5% platform cut and Stripe fee when fan does not cover fees', () => {
			const gross = 1000; // $10.00
			const result = calculateTipBreakdown(gross, false);
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			// Platform cut: 5% of $10.00 = $0.50 (50 cents)
			expect(result.value.feePlatformCents).toBe(50);
			// Stripe fee: 2.9% of 1000 + 30 = 29 + 30 = 59 cents
			expect(result.value.feeStripeCents).toBe(59);
			// Net to artist: 1000 - 50 - 59 = 891 cents ($8.91)
			expect(result.value.netArtistCents).toBe(891);
			expect(result.value.totalChargedCents).toBe(1000);
		});

		it('calculates total charged when fan covers fees', () => {
			const gross = 1000; // $10.00
			const result = calculateTipBreakdown(gross, true);
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			expect(result.value.feePlatformCents).toBe(50);
			expect(result.value.feeStripeCents).toBe(59);
			// Total charged: 1000 + 59 = 1059 cents ($10.59)
			expect(result.value.totalChargedCents).toBe(1059);
			// Net to artist: 1000 - 50 = 950 cents ($9.50)
			expect(result.value.netArtistCents).toBe(950);
		});

		it('enforces $2 minimum boundary', () => {
			const result = calculateTipBreakdown(199, false);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('AMOUNT_BELOW_MINIMUM');
			}
		});

		it('enforces $500 maximum boundary', () => {
			const result = calculateTipBreakdown(50001, false);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('AMOUNT_ABOVE_MAXIMUM');
			}
		});
	});

	describe('Tip Checkout FSM', () => {
		it('runs through the full successful checkout cycle', () => {
			let state: TipState = { status: 'idle' };

			// 1. Select amount
			const selResult = tipCheckoutTransition(state, {
				type: 'SELECT_AMOUNT',
				artistId,
				issueId,
				grossCents: 1000,
				fanCoveredFees: false
			});
			expect(selResult.ok).toBe(true);
			if (!selResult.ok) return;
			state = selResult.value;
			expect(state.status).toBe('initiating');

			// 2. Session created
			const breakdown = calculateTipBreakdown(1000, false);
			if (!breakdown.ok) return;

			const sessResult = tipCheckoutTransition(state, {
				type: 'SESSION_CREATED',
				breakdown: breakdown.value,
				paymentSessionId: 'sess_123'
			});
			expect(sessResult.ok).toBe(true);
			if (!sessResult.ok) return;
			state = sessResult.value;
			expect(state.status).toBe('awaiting_payment');

			// 3. Payment succeeded
			const succResult = tipCheckoutTransition(state, {
				type: 'PAYMENT_SUCCEEDED',
				paymentId: 'pi_abc123'
			});
			expect(succResult.ok).toBe(true);
			if (!succResult.ok) return;
			state = succResult.value;
			expect(state.status).toBe('succeeded');

			// 4. Reset back to idle
			const resetResult = tipCheckoutTransition(state, { type: 'RESET' });
			expect(resetResult.ok).toBe(true);
			if (!resetResult.ok) return;
			expect(resetResult.value.status).toBe('idle');
		});

		it('enforces Decision 18: failed checkout resets cleanly with no background retries', () => {
			const breakdown = calculateTipBreakdown(1000, false);
			if (!breakdown.ok) return;

			const awaitingState: TipState = {
				status: 'awaiting_payment',
				artistId,
				issueId,
				breakdown: breakdown.value,
				paymentSessionId: 'sess_456'
			};

			const failResult = tipCheckoutTransition(awaitingState, {
				type: 'PAYMENT_FAILED',
				reason: 'Network disconnect / card declined'
			});
			expect(failResult.ok).toBe(true);
			if (!failResult.ok) return;
			expect(failResult.value.status).toBe('failed');

			// Can reset to idle
			const resetResult = tipCheckoutTransition(failResult.value, { type: 'RESET' });
			expect(resetResult.ok).toBe(true);
			if (!resetResult.ok) return;
			expect(resetResult.value.status).toBe('idle');
		});
	});

	describe('Reversal Accounting, Tip Summaries & USD Formatting', () => {
		it('distinguishes succeeded vs reversed tip statuses', () => {
			expect(isTipReversed(TipStatus.Succeeded)).toBe(false);
			expect(isTipReversed(TipReversalStatus.Refunded)).toBe(true);
			expect(isTipReversed(TipReversalStatus.Disputed)).toBe(true);
		});

		it('summarizes mixed succeeded, refunded, and disputed tips with absorbed fees', () => {
			const summary = summarizeArtistTips([
				// $10 succeeded (fan did not cover fees): net = 1000 - 50 - 59 = 891
				{
					amountGross: 1000,
					feePlatform: 50,
					feeStripe: 59,
					amountNet: 891,
					fanCoveredFees: false,
					status: TipStatus.Succeeded
				},
				// $10 refunded (artist absorbed fees: baseNet 891 - 1000 refund = -109 net; reversal = 1000)
				{
					amountGross: 1000,
					feePlatform: 50,
					feeStripe: 59,
					amountNet: -109,
					fanCoveredFees: false,
					status: TipReversalStatus.Refunded
				},
				// $20 disputed (fan covered Stripe fee: baseNet 1900 - 2000 dispute = -100 net; reversal = 2000)
				{
					amountGross: 2000,
					feePlatform: 100,
					feeStripe: 88,
					amountNet: -100,
					fanCoveredFees: true,
					status: TipReversalStatus.Disputed
				}
			]);

			expect(summary.tipCount).toBe(3);
			expect(summary.succeededCount).toBe(1);
			expect(summary.refundCount).toBe(1);
			expect(summary.disputeCount).toBe(1);
			expect(summary.grossCents).toBe(4000);
			expect(summary.feesCents).toBe(50 + 59 + 50 + 59 + 100 + 88);
			expect(summary.reversalsCents).toBe(3000);
			expect(summary.netCents).toBe(891 - 109 - 100);
		});

		it('returns 0 reversal cents for succeeded tips', () => {
			expect(
				calculateTipReversalCents({
					amountGross: 500,
					feePlatform: 25,
					feeStripe: 45,
					amountNet: 430,
					fanCoveredFees: false,
					status: TipStatus.Succeeded
				})
			).toBe(0);
		});

		it('formats positive, zero, and negative cent values cleanly', () => {
			expect(formatUsdCents(891)).toBe('$8.91');
			expect(formatUsdCents(0)).toBe('$0.00');
			expect(formatUsdCents(-109)).toBe('-$1.09');
		});
	});
});
