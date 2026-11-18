import { describe, expect, it } from 'vitest';
import {
	buildVenmoPayUrl,
	buildVenmoProfileUrl,
	formatVenmoAmount,
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
