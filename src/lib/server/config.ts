/**
 * Runtime mode and configuration (ADR 0007, decision 30).
 *
 * This is the only module that reads environment variables for secrets,
 * the database and integrations. Everything else asks `getConfig()`.
 *
 * Two failure tiers:
 * Stripe (`payments`) is dormant (ADR 0008): its keys are optional and ignored.
 *
 * - Core (auth secret, scan-token secret, database, app URL): when invalid in a
 *   deployed mode (production or Demo), the whole site serves a 503 page.
 * - Features (email, Fan sign-in, uploads): when an integration key is
 *   missing in production, only that feature switches off. In development, test
 *   and the Demo some features fall back to local stand-ins (ADR 0003, ADR 0004).
 *
 * This module must never throw at import time: the 503 hook and the build both
 * import it while the configuration may still be broken.
 */
import crypto from 'node:crypto';
import { z } from 'zod';

import type { FeatureName, Mode, PublicFeatures } from '../features';

export type { FeatureName, Mode, PublicFeatures };
export type Env = Record<string, string | undefined>;

export const MIN_SECRET_LENGTH = 32;

/**
 * ADR 0008: tips go straight to the Artist's Venmo. The Stripe code and keys are
 * kept but nothing reaches Stripe and no Stripe key is required in any mode.
 */
export const STRIPE_DORMANT = true;

/** Development and test only. Never accepted in the Demo or production. */
const DEV_AUTH_SECRET = 'quire_development_auth_secret_do_not_deploy_0000';
const DEV_COOKIE_SECRET = 'quire_development_scan_token_secret_do_not_deploy';
const DEV_DATABASE_URL = 'file:local.db';
const DEV_APP_URL = 'http://localhost:5173';
/**
 * Local e2e preview only (QUIRE_E2E_LOCAL_PREVIEW, see `localPreviewFor`). Never
 * accepted by the normal Demo or production rules: these values are public.
 */
const LOCAL_PREVIEW_AUTH_SECRET = 'quire_e2e_local_preview_auth_secret_000000000000';
const LOCAL_PREVIEW_COOKIE_SECRET = 'quire_e2e_local_preview_cookie_secret_00000000000';
export const LOCAL_PREVIEW_FLAG = 'QUIRE_E2E_LOCAL_PREVIEW';
/** Netlify sets these on every build and function; any one of them means "not local". */
const NETLIFY_MARKERS = ['NETLIFY', 'CONTEXT', 'DEPLOY_URL'] as const;
const DEFAULT_FROM_EMAIL = 'Quire <noreply@quire.live>';
const DEFAULT_R2_BUCKET = 'quire-media';

/**
 * Where each feature may run on a local stand-in instead of the real service.
 * Outside these modes the feature needs its real keys or it is off.
 */
const STAND_IN_MODES: Record<FeatureName, readonly Mode[]> = {
	payments: ['development', 'test', 'demo'],
	email: ['development', 'test'],
	fanSignIn: ['development', 'test', 'demo'],
	uploads: ['development', 'test', 'demo']
};

/** Modes where sample data, `/demo` and the sample logins exist (ADR 0007). Never production. */
export const SAMPLE_DATA_MODES: readonly Mode[] = ['development', 'test', 'demo'];

/** True when this mode may run the local stand-in for a feature. Always false in production. */
export function allowsStandIn(name: FeatureName, mode: Mode): boolean {
	return STAND_IN_MODES[name].includes(mode);
}

/** True when this mode may seed sample data and serve `/demo`. Always false in production. */
export function allowsSampleData(mode: Mode): boolean {
	return SAMPLE_DATA_MODES.includes(mode);
}

export interface CoreConfig {
	ok: boolean;
	/** Names of the variables that are missing or invalid. Never their values. */
	issues: string[];
	authSecret: string;
	cookieSecret: string;
	databaseUrl: string;
	databaseAuthToken: string | undefined;
	appUrl: string;
}

export interface StripeSettings {
	secretKey: string | null;
	webhookSecret: string | null;
	publishableKey: string | null;
}

export interface Integrations {
	stripe: StripeSettings;
	resend: { apiKey: string; fromEmail: string } | null;
	google: { clientId: string; clientSecret: string } | null;
	r2: {
		accountId: string;
		accessKeyId: string;
		secretAccessKey: string;
		bucketName: string;
		publicUrl: string | null;
	} | null;
}

/**
 * The local e2e preview exception (PRODUCTION_PLAN 4.2, P4L-T03): lets the Demo and
 * production modes run locally on a file database with fixed test secrets.
 */
export interface LocalPreview {
	/** QUIRE_E2E_LOCAL_PREVIEW=true was set. */
	requested: boolean;
	/** Requested, and every guard held. Only then does the exception apply. */
	honored: boolean;
	/** Why a requested flag was ignored. Names variables, never values. */
	ignoredBecause: string[];
}

export interface Config {
	mode: Mode;
	localPreview: LocalPreview;
	/** True for the Demo and production: real deployments that must be fully configured. */
	isDeployed: boolean;
	core: CoreConfig;
	/** Real integration credentials, present only when complete. */
	integrations: Integrations;
	/** Whether each feature is usable at all (real service or allowed stand-in). */
	features: Record<FeatureName, boolean>;
	/** Whether each feature is backed by its real service. */
	live: Record<FeatureName, boolean>;
	fromEmail: string;
	/** Sample data is loaded on first request in development and the Demo unless disabled. */
	autoSeed: boolean;
	/**
	 * Origin of R2_PUBLIC_URL (e.g. `https://media.quire.live`), or null. Read on its
	 * own, without the R2 keys, so the CSP still allows media already stored there.
	 */
	mediaOrigin: string | null;
}

const optionalString = z
	.string()
	.optional()
	.transform((value) => {
		const trimmed = value?.trim();
		return trimmed ? trimmed : undefined;
	});

const envSchema = z.object({
	NODE_ENV: optionalString,
	VITEST: optionalString,
	DEMO_MODE: optionalString,
	DISABLE_AUTO_SEED: optionalString,
	BETTER_AUTH_SECRET: optionalString,
	BETTER_AUTH_URL: optionalString,
	PUBLIC_APP_URL: optionalString,
	COOKIE_SECRET: optionalString,
	DATABASE_URL: optionalString,
	DATABASE_AUTH_TOKEN: optionalString,
	GOOGLE_CLIENT_ID: optionalString,
	GOOGLE_CLIENT_SECRET: optionalString,
	STRIPE_SECRET_KEY: optionalString,
	STRIPE_WEBHOOK_SECRET: optionalString,
	STRIPE_PUBLISHABLE_KEY: optionalString,
	RESEND_API_KEY: optionalString,
	RESEND_FROM_EMAIL: optionalString,
	R2_ACCOUNT_ID: optionalString,
	R2_ACCESS_KEY_ID: optionalString,
	R2_SECRET_ACCESS_KEY: optionalString,
	R2_BUCKET_NAME: optionalString,
	R2_PUBLIC_URL: optionalString,
	QUIRE_E2E_LOCAL_PREVIEW: optionalString
});

type ParsedEnv = z.infer<typeof envSchema>;

/**
 * Fails closed: anything not explicitly development or test is production,
 * so a deploy that forgets NODE_ENV never gets development stand-ins.
 */
export function resolveMode(env: Env): Mode {
	if (env.DEMO_MODE?.trim().toLowerCase() === 'true') return 'demo';
	const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
	if (nodeEnv === 'test' || Boolean(env.VITEST?.trim())) return 'test';
	if (nodeEnv === 'development') return 'development';
	return 'production';
}

function isPlaceholderSecret(value: string): boolean {
	return /change_me|do_not_deploy|development_secret/i.test(value);
}

function checkSecret(name: string, value: string | undefined, issues: string[]): string | null {
	if (!value || value.length < MIN_SECRET_LENGTH || isPlaceholderSecret(value)) {
		issues.push(name);
		return null;
	}
	return value;
}

function checkUrl(value: string | undefined): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:' ? value.replace(/\/$/, '') : null;
	} catch {
		return null;
	}
}

/** Unusable in practice: random per process, so nothing signed with it can be forged or reused. */
function ephemeralSecret(): string {
	return crypto.randomBytes(32).toString('hex');
}

/**
 * Decides whether the local e2e preview flag applies. All of these must hold,
 * otherwise the flag is ignored and the normal fail-closed rules apply:
 * - DATABASE_URL starts with `file:` (a local file, never a remote database);
 * - NETLIFY, CONTEXT and DEPLOY_URL are all unset (Netlify sets them on every
 *   build and function, so this never runs on a deployed site). A variable that
 *   is present but empty still counts as set.
 */
export function localPreviewFor(rawEnv: Env): LocalPreview {
	const requested = rawEnv[LOCAL_PREVIEW_FLAG]?.trim().toLowerCase() === 'true';
	if (!requested) return { requested: false, honored: false, ignoredBecause: [] };
	const ignoredBecause: string[] = [];
	if (!rawEnv.DATABASE_URL?.trim().startsWith('file:')) {
		ignoredBecause.push('DATABASE_URL is not a file: URL');
	}
	for (const name of NETLIFY_MARKERS) {
		if (rawEnv[name] !== undefined) ignoredBecause.push(`${name} is set (a Netlify build or function)`);
	}
	return { requested, honored: ignoredBecause.length === 0, ignoredBecause };
}

function parseCore(env: ParsedEnv, mode: Mode, localPreview: LocalPreview): CoreConfig {
	const issues: string[] = [];
	const local = mode === 'development' || mode === 'test';

	if (local) {
		const rawUrl = env.DATABASE_URL;
		// Tests always use the local file database, never a remote one.
		const databaseUrl =
			mode === 'test' && (!rawUrl || rawUrl.startsWith('libsql://')) ? DEV_DATABASE_URL : rawUrl ?? DEV_DATABASE_URL;
		const isFileDb = databaseUrl.startsWith('file:');
		const databaseAuthToken = isFileDb ? undefined : env.DATABASE_AUTH_TOKEN;
		if (!isFileDb && !databaseAuthToken) issues.push('DATABASE_AUTH_TOKEN');

		return {
			ok: issues.length === 0,
			issues,
			authSecret: env.BETTER_AUTH_SECRET ?? DEV_AUTH_SECRET,
			cookieSecret: env.COOKIE_SECRET ?? DEV_COOKIE_SECRET,
			databaseUrl,
			databaseAuthToken,
			appUrl: checkUrl(env.BETTER_AUTH_URL ?? env.PUBLIC_APP_URL) ?? DEV_APP_URL
		};
	}

	// Demo and production: every core value must be real, except under the honored
	// local preview, where unset secrets take fixed test values and the database
	// is a local file. The app URL is still required.
	const preview = localPreview.honored;
	const authSecret = checkSecret(
		'BETTER_AUTH_SECRET',
		env.BETTER_AUTH_SECRET ?? (preview ? LOCAL_PREVIEW_AUTH_SECRET : undefined),
		issues
	);
	const cookieSecret = checkSecret(
		'COOKIE_SECRET',
		env.COOKIE_SECRET ?? (preview ? LOCAL_PREVIEW_COOKIE_SECRET : undefined),
		issues
	);
	if (authSecret && cookieSecret && authSecret === cookieSecret) {
		issues.push('COOKIE_SECRET (must differ from BETTER_AUTH_SECRET)');
	}

	if (preview) {
		const appUrl = checkUrl(env.BETTER_AUTH_URL ?? env.PUBLIC_APP_URL);
		if (!appUrl) issues.push('BETTER_AUTH_URL');
		return {
			ok: issues.length === 0,
			issues,
			authSecret: authSecret ?? ephemeralSecret(),
			cookieSecret: cookieSecret ?? ephemeralSecret(),
			// localPreviewFor checked it is a file: URL.
			databaseUrl: env.DATABASE_URL ?? '',
			databaseAuthToken: undefined,
			appUrl: appUrl ?? ''
		};
	}

	const databaseUrl = env.DATABASE_URL;
	const remoteDb = Boolean(databaseUrl && /^(libsql|https?|wss?):\/\//.test(databaseUrl));
	if (!remoteDb) issues.push('DATABASE_URL');
	if (!env.DATABASE_AUTH_TOKEN) issues.push('DATABASE_AUTH_TOKEN');

	const appUrl = checkUrl(env.BETTER_AUTH_URL ?? env.PUBLIC_APP_URL);
	if (!appUrl) issues.push('BETTER_AUTH_URL');

	return {
		ok: issues.length === 0,
		issues,
		authSecret: authSecret ?? ephemeralSecret(),
		cookieSecret: cookieSecret ?? ephemeralSecret(),
		databaseUrl: remoteDb && databaseUrl ? databaseUrl : '',
		databaseAuthToken: env.DATABASE_AUTH_TOKEN,
		appUrl: appUrl ?? ''
	};
}

function parseIntegrations(env: ParsedEnv): Integrations {
	const secretKey =
		env.STRIPE_SECRET_KEY && /^(sk|rk)_/.test(env.STRIPE_SECRET_KEY) ? env.STRIPE_SECRET_KEY : null;
	const webhookSecret =
		env.STRIPE_WEBHOOK_SECRET && env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')
			? env.STRIPE_WEBHOOK_SECRET
			: null;
	const publishableKey =
		env.STRIPE_PUBLISHABLE_KEY && env.STRIPE_PUBLISHABLE_KEY.startsWith('pk_')
			? env.STRIPE_PUBLISHABLE_KEY
			: null;

	const fromEmail = env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;

	return {
		stripe: { secretKey, webhookSecret, publishableKey },
		resend: env.RESEND_API_KEY ? { apiKey: env.RESEND_API_KEY, fromEmail } : null,
		google:
			env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
				? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
				: null,
		r2:
			env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY
				? {
						accountId: env.R2_ACCOUNT_ID,
						accessKeyId: env.R2_ACCESS_KEY_ID,
						secretAccessKey: env.R2_SECRET_ACCESS_KEY,
						bucketName: env.R2_BUCKET_NAME ?? DEFAULT_R2_BUCKET,
						publicUrl: checkUrl(env.R2_PUBLIC_URL)
					}
				: null
	};
}

function originOf(value: string | undefined): string | null {
	const url = checkUrl(value);
	return url ? new URL(url).origin : null;
}

/** Pure: builds a config from an env object. Used directly by unit tests and `scripts/check-env.ts`. */
export function parseConfig(rawEnv: Env): Config {
	const env = envSchema.parse(rawEnv);
	const mode = resolveMode(rawEnv);
	const integrations = parseIntegrations(env);
	const localPreview = localPreviewFor(rawEnv);

	const live: Record<FeatureName, boolean> = {
		// Stripe is dormant (ADR 0008): never live, whatever keys are set. Tips go to Venmo.
		payments: STRIPE_DORMANT ? false : Boolean(integrations.stripe.secretKey && integrations.stripe.webhookSecret),
		// The Demo never sends real email, even if a key is present.
		email: Boolean(integrations.resend) && mode !== 'demo',
		fanSignIn: Boolean(integrations.google),
		uploads: Boolean(integrations.r2)
	};

	const features = Object.fromEntries(
		(Object.keys(live) as FeatureName[]).map((name) => [
			name,
			live[name] || STAND_IN_MODES[name].includes(mode)
		])
	) as Record<FeatureName, boolean>;

	return {
		mode,
		localPreview,
		isDeployed: mode === 'demo' || mode === 'production',
		core: parseCore(env, mode, localPreview),
		integrations,
		features,
		live,
		fromEmail: env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL,
		autoSeed: mode !== 'production' && env.DISABLE_AUTO_SEED?.toLowerCase() !== 'true',
		mediaOrigin: originOf(env.R2_PUBLIC_URL)
	};
}

let envFileLoaded = false;
let cached: Config | null = null;

function loadEnvFileOnce(): void {
	if (envFileLoaded) return;
	envFileLoaded = true;
	if (resolveMode(process.env) === 'test') return;
	// The local e2e preview is hermetic: a developer's .env (remote keys, R2) never leaks in.
	if (localPreviewFor(process.env).requested) return;
	try {
		process.loadEnvFile?.('.env');
	} catch {
		// No .env file: deployed environments set variables directly.
	}
}

/**
 * The current configuration. Re-read on every call in test mode so tests can
 * change `process.env` between cases; cached everywhere else.
 */
export function getConfig(): Config {
	loadEnvFileOnce();
	if (cached) return cached;
	const config = parseConfig(process.env);
	logLocalPreviewOnce(config);
	if (config.mode !== 'test') cached = config;
	return config;
}

let localPreviewLogged = false;

function logLocalPreviewOnce({ localPreview, mode }: Config): void {
	if (localPreviewLogged || !localPreview.requested) return;
	localPreviewLogged = true;
	if (localPreview.honored) {
		console.warn(
			`[config] ${LOCAL_PREVIEW_FLAG}: local e2e preview in ${mode} mode (file database, test secrets). Never deploy this.`
		);
	} else {
		console.warn(
			`[config] ${LOCAL_PREVIEW_FLAG} ignored: ${localPreview.ignoredBecause.join('; ')}. The normal ${mode} rules apply.`
		);
	}
}

export function isFeatureEnabled(name: FeatureName): boolean {
	return getConfig().features[name];
}

/**
 * Whether tip buttons open the real Venmo app/site (ADR 0008). Production only:
 * elsewhere the sample usernames may belong to real people, so tips are simulated.
 */
export function tipsOpenVenmo(mode: Mode): boolean {
	return mode === 'production';
}

export function getPublicFeatures(): PublicFeatures {
	const { features, mode } = getConfig();
	return { ...features, mode, tipsOpenVenmo: tipsOpenVenmo(mode) };
}

/** Clears the cache. Tests only. */
export function resetConfigForTests(): void {
	cached = null;
}
