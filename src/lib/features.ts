/**
 * Feature availability shared by server and UI (ADR 0007, decision 30).
 * Safe to import from the browser: no secrets, only names and copy.
 */
export type Mode = 'development' | 'test' | 'demo' | 'production';
export type FeatureName = 'payments' | 'email' | 'fanSignIn' | 'uploads';
export type PublicFeatures = Record<FeatureName, boolean> & {
	mode: Mode;
	/** Tip buttons open Venmo for real. True only in production (ADR 0008). */
	tipsOpenVenmo: boolean;
};

export const FEATURE_UNAVAILABLE: Record<FeatureName, string> = {
	payments: 'Tips are temporarily unavailable.',
	email: "We can't send email right now.",
	fanSignIn: 'Fan sign-in is temporarily unavailable.',
	uploads: 'Uploads are temporarily unavailable. You can still paste an image URL or embed.'
};

const DEMO_UNAVAILABLE: Partial<Record<FeatureName, string>> = {
	email: 'Email is turned off in the Demo, so sign-up and password resets are off too. Use the sample login instead.',
	uploads: 'Uploads are turned off in this Demo. You can still paste an image URL or embed.'
};

/**
 * Uploads-off wording for the video recorder, in place of the general uploads line
 * (which offers an image URL). The copy never promises what the page doesn't have:
 * `video` sits above a video link field (Bookbinder); `videoNoLink` has none (Quick Issue).
 */
export type FeatureNoticeVariant = 'video' | 'videoNoLink';

export const VIDEO_UPLOADS_UNAVAILABLE: Record<FeatureNoticeVariant, string> = {
	video: 'Video uploads are temporarily unavailable. You can still paste a YouTube, Vimeo or Bandcamp link below.',
	videoNoLink:
		'Video uploads are temporarily unavailable. You can publish without a video, then add a YouTube, Vimeo or Bandcamp link in the Bookbinder.'
};

const DEMO_VIDEO_UPLOADS_UNAVAILABLE: Record<FeatureNoticeVariant, string> = {
	video: 'Video uploads are turned off in this Demo. You can still paste a YouTube, Vimeo or Bandcamp link below.',
	videoNoLink:
		'Video uploads are turned off in this Demo. You can publish without a video, then add a YouTube, Vimeo or Bandcamp link in the Bookbinder.'
};

export function featureUnavailableMessage(name: FeatureName, mode?: Mode, variant?: FeatureNoticeVariant): string {
	if (name === 'uploads' && variant) {
		return mode === 'demo' ? DEMO_VIDEO_UPLOADS_UNAVAILABLE[variant] : VIDEO_UPLOADS_UNAVAILABLE[variant];
	}
	return (mode === 'demo' && DEMO_UNAVAILABLE[name]) || FEATURE_UNAVAILABLE[name];
}
