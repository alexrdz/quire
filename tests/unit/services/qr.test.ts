import { describe, it, expect } from 'vitest';
import { generateQrSvg, generateIssueScanQrSvg, generateArtistQrSvg } from '$lib/server/services/qr';

describe('QR Code Generation Service', () => {
	it('generates a valid SVG string from plain text', async () => {
		const svg = await generateQrSvg('https://quire.fm');
		expect(svg).toContain('<svg');
		expect(svg).toContain('</svg>');
		expect(svg).toContain('viewBox');
	});

	it('generates an issue scan QR code embedding secret key parameter', async () => {
		const svg = await generateIssueScanQrSvg('the-neon-velvet-philly', 'philly_secret_key_123');
		expect(svg).toContain('<svg');
		// QR code encodes /scan/the-neon-velvet-philly?k=philly_secret_key_123
		expect(svg.length).toBeGreaterThan(100);
	});

	it('generates an artist permanent back page QR code', async () => {
		const svg = await generateArtistQrSvg('https://quire.fm', 'the-neon-velvet');
		expect(svg).toContain('<svg');
	});
});
