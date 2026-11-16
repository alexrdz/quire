import QRCode from 'qrcode';

export interface GenerateQrOptions {
	margin?: number;
	width?: number;
	color?: {
		dark?: string;
		light?: string;
	};
}

/**
 * Generates an SVG string representation of a QR code.
 */
export async function generateQrSvg(text: string, options?: GenerateQrOptions): Promise<string> {
	return QRCode.toString(text, {
		type: 'svg',
		margin: options?.margin ?? 2,
		width: options?.width ?? 256,
		color: {
			dark: options?.color?.dark ?? '#090710',
			light: options?.color?.light ?? '#FFFFFF'
		}
	});
}

/**
 * Generates the physical QR code sticker SVG for a specific issue.
 * Encodes the dedicated scan URL with the secret key parameter:
 * `/scan/[issueSlug]?k=[secretKey]`
 */
export async function generateIssueScanQrSvg(
	baseUrl: string,
	issueSlug: string,
	secretKey: string,
	options?: GenerateQrOptions
): Promise<string> {
	const scanUrl = `${baseUrl.replace(/\/$/, '')}/scan/${encodeURIComponent(issueSlug)}?k=${encodeURIComponent(secretKey)}`;
	return generateQrSvg(scanUrl, options);
}

/**
 * Generates the permanent Artist Back Page QR code SVG:
 * `/a/[artistSlug]`
 */
export async function generateArtistQrSvg(
	baseUrl: string,
	artistSlug: string,
	options?: GenerateQrOptions
): Promise<string> {
	const artistUrl = `${baseUrl.replace(/\/$/, '')}/a/${encodeURIComponent(artistSlug)}`;
	return generateQrSvg(artistUrl, options);
}
