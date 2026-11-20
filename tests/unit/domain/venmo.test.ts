import { describe, expect, it } from 'vitest';
import {
	buildVenmoPayUrl,
	buildVenmoProfileUrl,
	formatVenmoAmount,
	parseTipDollars,
	parseVenmoUsername,
	tipNote,
	type VenmoUsername
} from '$domain/venmo';

const username = (raw: string): VenmoUsername => {
	const parsed = parseVenmoUsername(raw);
	if (!parsed.ok) throw new Error(parsed.error.message);
	return parsed.value;
};

describe('parseVenmoUsername', () => {
	it.each([
		['the-neon-velvet', 'the-neon-velvet'],
		['@the-neon-velvet', 'the-neon-velvet'],
		['  @Neon_Velvet  ', 'Neon_Velvet'],
		['abcde', 'abcde'],
		['a'.repeat(30), 'a'.repeat(30)]
	])('accepts %j as %j', (raw, expected) => {
		const result = parseVenmoUsername(raw);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe(expected);
	});

	it.each([
		['', 'VENMO_USERNAME_REQUIRED'],
		['   ', 'VENMO_USERNAME_REQUIRED'],
		['@', 'VENMO_USERNAME_REQUIRED'],
		['abcd', 'VENMO_USERNAME_LENGTH'],
		['a'.repeat(31), 'VENMO_USERNAME_LENGTH'],
		['neon velvet', 'VENMO_USERNAME_CHARACTERS'],
		['neon.velvet', 'VENMO_USERNAME_CHARACTERS'],
		['@@neonvelvet', 'VENMO_USERNAME_CHARACTERS'],
		['neon/velvet?x=1', 'VENMO_USERNAME_CHARACTERS'],
		['vélvet-band', 'VENMO_USERNAME_CHARACTERS']
	])('rejects %j with %s', (raw, code) => {
		const result = parseVenmoUsername(raw);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe(code);
	});
});

describe('formatVenmoAmount', () => {
	it.each([
		[500, '5.00'],
		[1, '0.01'],
		[1050, '10.50'],
		[50000, '500.00']
	])('formats %i cents as %s', (cents, expected) => {
		expect(formatVenmoAmount(cents)).toBe(expected);
	});

	it.each([0, -100, 1.5, Number.NaN])('rejects %s', (cents) => {
		expect(() => formatVenmoAmount(cents)).toThrow(RangeError);
	});
});

describe('Venmo URLs', () => {
	it('builds the profile URL', () => {
		expect(buildVenmoProfileUrl(username('@the-neon-velvet'))).toBe(
			'https://venmo.com/u/the-neon-velvet'
		);
	});

	it('builds a pay URL with the amount and an encoded note', () => {
		expect(
			buildVenmoPayUrl({
				username: username('the-neon-velvet'),
				amountCents: 500,
				note: tipNote('The Neon Velvet')
			})
		).toBe(
			'https://venmo.com/the-neon-velvet?txn=pay&amount=5.00&note=Tip%20for%20The%20Neon%20Velvet%20via%20Quire'
		);
	});

	it('encodes characters that would break the query string', () => {
		const url = new URL(
			buildVenmoPayUrl({
				username: username('band_1'),
				amountCents: 1250,
				note: tipNote('Rock & Roll #1 ?=')
			})
		);
		expect(url.searchParams.get('txn')).toBe('pay');
		expect(url.searchParams.get('amount')).toBe('12.50');
		expect(url.searchParams.get('note')).toBe('Tip for Rock & Roll #1 ?= via Quire');
		expect([...url.searchParams.keys()]).toEqual(['txn', 'amount', 'note']);
	});
});

describe('tipNote', () => {
	it('names only the Artist', () => {
		expect(tipNote('The Neon Velvet')).toBe('Tip for The Neon Velvet via Quire');
	});

	it('collapses whitespace and caps long names', () => {
		expect(tipNote('  The\n Neon   Velvet ')).toBe('Tip for The Neon Velvet via Quire');
		expect(tipNote('x'.repeat(200))).toBe(`Tip for ${'x'.repeat(80)} via Quire`);
	});

	it('falls back when the name is empty', () => {
		expect(tipNote('   ')).toBe('Tip for the artist via Quire');
	});
});

/**
 * P5V-T02: the custom tip field is type="number", so Svelte binds a number, or
 * null when it is empty or not a number. The parse must take either and never throw.
 */
describe('parseTipDollars (custom tip amount)', () => {
	it.each([
		[20, 2000],
		[12.5, 1250],
		[2, 200],
		[500, 50000],
		[12.05, 1205],
		[0.5 + 4.5, 500],
		['20', 2000],
		['12.5', 1250],
		['12.50', 1250],
		[' 7.25 ', 725]
	])('accepts %j as %i cents', (input, cents) => {
		expect(parseTipDollars(input)).toBe(cents);
	});

	it.each([
		[500.01, 'above $500'],
		[1.99, 'below $2'],
		[0, 'zero'],
		[-5, 'negative'],
		[12.345, 'more than two decimal places'],
		['12.345', 'more than two decimal places'],
		[Number.NaN, 'NaN'],
		[Number.POSITIVE_INFINITY, 'infinite'],
		[1e21, 'exponent form'],
		['', 'empty'],
		['   ', 'blank'],
		['e', 'not a number'],
		['1e2', 'exponent notation'],
		['12,50', 'comma decimal'],
		['$20', 'currency sign'],
		['.', 'a lone point'],
		[null, 'what Svelte binds for an empty or invalid number field'],
		[undefined, 'undefined']
	])('gives no amount for %j (%s), without throwing', (input: unknown, _reason: string) => {
		expect(() => parseTipDollars(input)).not.toThrow();
		expect(parseTipDollars(input)).toBeNull();
	});

	it('every whole-cent amount from $2 to $500 round-trips exactly', () => {
		for (let cents = 200; cents <= 50000; cents += 1) {
			const asNumber = Number((cents / 100).toFixed(2));
			expect(parseTipDollars(asNumber), String(asNumber)).toBe(cents);
		}
	});

	it('a custom amount builds the same link format as a preset', () => {
		const user = username('quire-sample-band');
		const note = tipNote('The Neon Velvet');
		const custom = buildVenmoPayUrl({ username: user, amountCents: parseTipDollars(12.5)!, note });
		expect(custom).toBe('https://venmo.com/quire-sample-band?txn=pay&amount=12.50&note=Tip%20for%20The%20Neon%20Velvet%20via%20Quire');
		const preset = buildVenmoPayUrl({ username: user, amountCents: 1000, note });
		expect(preset.replace('amount=10.00', 'amount=12.50')).toBe(custom);
	});
});
