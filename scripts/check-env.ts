/**
 * Build-time configuration check (ADR 0007, Phase 0.2).
 *
 * Fails the build when a deployed mode (production or the Demo) is missing core
 * configuration, so a misconfigured deploy never goes live and serves 503s.
 * Missing integration keys only warn: those features switch off on their own.
 *
 * Usage: pnpm check:env   (reads process.env, plus .env when present)
 */
import { parseConfig, tipsOpenVenmo, type FeatureName } from '../src/lib/server/config';

try {
	process.loadEnvFile?.('.env');
} catch {
	// Deploy environments set variables directly.
}

/** Features whose keys this check reports. Stripe (`payments`) is dormant (ADR 0008) and never required. */
const FEATURE_KEYS: Partial<Record<FeatureName, string>> = {
	email: 'RESEND_API_KEY',
	fanSignIn: 'GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET',
	uploads: 'R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY'
};

const config = parseConfig(process.env);

console.log(`[check-env] mode: ${config.mode}`);

console.log('[check-env] payments: Stripe dormant (ADR 0008); STRIPE_* keys are optional and ignored');
console.log(`[check-env] tips: ${tipsOpenVenmo(config.mode) ? 'open Venmo' : 'simulated (Venmo opens only in production)'}`);

for (const name of Object.keys(FEATURE_KEYS) as FeatureName[]) {
	const state = config.live[name] ? 'live' : config.features[name] ? 'stand-in' : 'OFF';
	const hint = config.live[name]
		? ''
		: config.mode === 'demo' && name === 'email'
			? ' (always off in the Demo)'
			: ` (set ${FEATURE_KEYS[name]})`;
	console.log(`[check-env] ${name}: ${state}${hint}`);
}

if (config.mode === 'demo' && config.integrations.resend) {
	console.warn('[check-env] RESEND_API_KEY is set but the Demo never sends email; it will be ignored.');
}

if (!config.core.ok) {
	const message = `[check-env] Core configuration invalid: ${config.core.issues.join(', ')}`;
	if (config.isDeployed) {
		console.error(`${message}. Refusing to build a ${config.mode} deploy.`);
		process.exit(1);
	}
	console.warn(`${message}. Allowed in ${config.mode} mode.`);
}

console.log('[check-env] OK');
