import QRCode from 'qrcode';
import { getConfig } from '../config';

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
 * The base for every URL that leaves the request: printed QR codes, links shown
 * for copying, and anything stored. Always the configured app URL
 * (BETTER_AUTH_URL / PUBLIC_APP_URL, or the local default in development and
 * test), never the request's Host: a deploy-preview domain or a spoofed Host
 * header must not end up on a printed sticker.
 */
export function appBaseUrl(): string {
	return getConfig().core.appUrl.replace(/\/$/, '');
}

/** The public Issue reader URL: `<appUrl>/i/[issueSlug]`. */
export function buildIssueUrl(issueSlug: string): string {
	return `${appBaseUrl()}/i/${encodeURIComponent(issueSlug)}`;
}

/** The sticker scan URL with the secret key: `<appUrl>/scan/[issueSlug]?k=[secretKey]`. */
export function buildIssueScanUrl(issueSlug: string, secretKey: string): string {
	return `${appBaseUrl()}/scan/${encodeURIComponent(issueSlug)}?k=${encodeURIComponent(secretKey)}`;
}

/**
 * Generates the physical QR code sticker SVG for a specific issue, encoding
 * `buildIssueScanUrl`. It takes no base URL, so a caller cannot pass the request origin.
 */
export async function generateIssueScanQrSvg(
	issueSlug: string,
	secretKey: string,
	options?: GenerateQrOptions
): Promise<string> {
	return generateQrSvg(buildIssueScanUrl(issueSlug, secretKey), options);
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
