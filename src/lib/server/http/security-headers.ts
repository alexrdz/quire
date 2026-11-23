/**
 * Security headers for every response from `hooks.server.ts` (PRODUCTION_PLAN 3.4).
 *
 * The CSP is built at runtime from the config, because the R2 public origin
 * (R2_PUBLIC_URL) is a deploy variable rather than a build constant.
 * SvelteKit's `kit.csp` (mode 'auto', in svelte.config.js) owns only `script-src`.
 * It adds a per-response nonce for its inline hydration script, and
 * `withSecurityHeaders` keeps those script tokens while replacing every other directive.
 * Responses SvelteKit didn't render (endpoints, /api/auth, the 503 page,
 * redirects) get the same policy with `script-src 'self'`.
 *
 * Static assets are served by Netlify's CDN without running this hook; netlify.toml
 * gives them nosniff and the referrer policy.
 */
import type { Mode } from '$lib/features';
import { getConfig } from '$lib/server/config';

export interface CspInput {
	mode: Mode;
	/** Origin of R2_PUBLIC_URL, or null when it isn't set. */
	mediaOrigin: string | null;
	/** The request path: the Issue reader may be framed by Quire itself (see below). */
	pathname?: string;
	/**
	 * Where the browser PUTs video bytes (ADR 0010): the R2 S3 endpoint, or null
	 * without R2. `withSecurityHeaders` reads it from the R2 config when it is left out.
	 */
	uploadOrigin?: string | null;
}

/** R2 account ids are 32 hex characters; anything else never reaches a header. */
const R2_ACCOUNT_ID = /^[0-9a-f]{32}$/i;

/**
 * The origin presigned video PUTs go to (ADR 0010): the account's R2 S3 endpoint,
 * the same one `storage.ts` gives its S3 client (path-style, so the bucket is in
 * the path, not the host). Null when the account id is malformed.
 */
export function r2UploadOrigin(accountId: string): string | null {
	return R2_ACCOUNT_ID.test(accountId) ? `https://${accountId.toLowerCase()}.r2.cloudflarestorage.com` : null;
}

/** The R2 upload origin from the deploy's R2 config, or null without R2. */
export function configuredUploadOrigin(): string | null {
	const r2 = getConfig().integrations.r2;
	return r2 ? r2UploadOrigin(r2.accountId) : null;
}

/**
 * The Bookbinder's live phone preview shows `/i/<slug>` in an iframe, so reader
 * pages accept Quire itself as a parent (`frame-ancestors 'self'`). Every other
 * page refuses all framing, and no page can be framed by another site.
 */
export function allowsSameOriginFraming(pathname: string | undefined): boolean {
	return pathname === '/i' || Boolean(pathname?.startsWith('/i/'));
}

export type CspDirectives = Record<string, string[]>;

/** Embeds the Issue reader renders (see `(zine)/i/[slug]/+page.svelte`). */
export const FRAME_SOURCES = [
	// The Bookbinder's live reader preview.
	"'self'",
	'https://www.youtube-nocookie.com',
	'https://www.youtube.com',
	'https://player.vimeo.com',
	'https://bandcamp.com',
	// The reader embeds any `*.bandcamp.com/EmbeddedPlayer` URL, not only the apex.
	'https://*.bandcamp.com'
];

/** Fan Google sign-in: the form POST to `?/googleSignIn` answers with a 303 to Google. */
export const GOOGLE_SIGN_IN_ORIGIN = 'https://accounts.google.com';

export function buildCspDirectives({ mode, mediaOrigin, pathname, uploadOrigin = null }: CspInput): CspDirectives {
	const media = mediaOrigin ? [mediaOrigin] : [];
	// Direct-to-R2 video uploads (ADR 0010): only the upload origin, never all of R2.
	const upload = uploadOrigin ? [uploadOrigin] : [];
	return {
		'default-src': ["'self'"],
		'script-src': ["'self'"],
		// 'unsafe-inline' is for styles only: the allowed runtime custom-property
		// style attributes (--accent, --cover-art, progress) and Svelte transitions
		// need it. Scripts never get 'unsafe-inline'.
		'style-src': ["'self'", "'unsafe-inline'"],
		'img-src': [
			"'self'",
			'data:',
			'blob:',
			...media,
			'https://i.ytimg.com',
			// Sample and landing art. The landing page's Zine Simulator uses it in
			// production too, so it isn't limited to non-production modes.
			'https://images.unsplash.com'
		],
		'media-src': ["'self'", 'blob:', ...media],
		'frame-src': FRAME_SOURCES,
		// Vite's dev server reconnects over a websocket; production keeps 'self' only.
		'connect-src': mode === 'development' ? ["'self'", 'ws:', 'wss:', ...upload] : ["'self'", ...upload],
		'form-action': ["'self'", GOOGLE_SIGN_IN_ORIGIN],
		'frame-ancestors': allowsSameOriginFraming(pathname) ? ["'self'"] : ["'none'"],
		'object-src': ["'none'"],
		'base-uri': ["'self'"]
	};
}

export function serializeCsp(directives: CspDirectives): string {
	return Object.entries(directives)
		.map(([name, values]) => [name, ...values].join(' '))
		.join('; ');
}

/** The `script-src` tokens SvelteKit put in its own header (its nonce or hashes), if any. */
export function kitScriptSources(header: string | null): string[] | null {
	if (!header) return null;
	for (const part of header.split(';')) {
		const [name, ...values] = part.trim().split(/\s+/);
		if (name === 'script-src' && values.length > 0) return values;
	}
	return null;
}

export function buildCspHeader(input: CspInput, kitHeader: string | null = null): string {
	const directives = buildCspDirectives(input);
	const kitScripts = kitScriptSources(kitHeader);
	if (kitScripts) directives['script-src'] = kitScripts;
	return serializeCsp(directives);
}

export const STATIC_SECURITY_HEADERS: Readonly<Record<string, string>> = {
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'strict-origin-when-cross-origin'
};

/**
 * Sets the CSP and the other security headers. Responses with immutable headers
 * (`Response.redirect`, proxied fetches) are copied first, so nothing skips them.
 */
export function withSecurityHeaders(response: Response, input: CspInput): Response {
	const csp = buildCspHeader(
		{ ...input, uploadOrigin: input.uploadOrigin === undefined ? configuredUploadOrigin() : input.uploadOrigin },
		response.headers.get('content-security-policy')
	);
	const apply = (headers: Headers) => {
		headers.set('content-security-policy', csp);
		for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS)) headers.set(name, value);
	};

	try {
		apply(response.headers);
		return response;
	} catch {
		const copy = new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: new Headers(response.headers)
		});
		apply(copy.headers);
		return copy;
	}
}
