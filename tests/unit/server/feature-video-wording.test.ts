import { describe, expect, it } from 'vitest';
import {
	FEATURE_UNAVAILABLE,
	VIDEO_UPLOADS_UNAVAILABLE,
	featureUnavailableMessage,
	type FeatureName,
	type FeatureNoticeVariant,
	type Mode
} from '$lib/features';

/**
 * B1-T25: with uploads off, the video recorder says video, not "paste an image URL",
 * and the photo and audio controls keep their wording.
 */

const MODES: Mode[] = ['development', 'test', 'production', 'demo'];
const VARIANTS: FeatureNoticeVariant[] = ['video', 'videoNoLink'];

describe('uploads-off wording for the video recorder', () => {
	it('says video and points to a link, never an image URL', () => {
		for (const mode of MODES) {
			for (const variant of VARIANTS) {
				const text = featureUnavailableMessage('uploads', mode, variant);
				expect(text, `${mode} ${variant}`).toMatch(/^Video uploads are /);
				expect(text, `${mode} ${variant}`).toMatch(/YouTube, Vimeo or Bandcamp link/);
				expect(text, `${mode} ${variant}`).not.toMatch(/image/i);
			}
		}
	});

	it('next to a link field it offers the link; without one it says where to add it', () => {
		expect(featureUnavailableMessage('uploads', 'production', 'video')).toBe(
			'Video uploads are temporarily unavailable. You can still paste a YouTube, Vimeo or Bandcamp link below.'
		);
		expect(featureUnavailableMessage('uploads', 'production', 'videoNoLink')).toBe(
			'Video uploads are temporarily unavailable. You can publish without a video, then add a YouTube, Vimeo or Bandcamp link in the Bookbinder.'
		);
		expect(featureUnavailableMessage('uploads', 'demo', 'video')).toBe(
			'Video uploads are turned off in this Demo. You can still paste a YouTube, Vimeo or Bandcamp link below.'
		);
		expect(featureUnavailableMessage('uploads', 'demo', 'videoNoLink')).toBe(
			'Video uploads are turned off in this Demo. You can publish without a video, then add a YouTube, Vimeo or Bandcamp link in the Bookbinder.'
		);
	});

	it('only the Demo mentions the Demo', () => {
		for (const variant of VARIANTS) {
			expect(featureUnavailableMessage('uploads', 'demo', variant)).toMatch(/turned off in this Demo/);
			for (const mode of ['development', 'test', 'production'] as Mode[]) {
				expect(featureUnavailableMessage('uploads', mode, variant)).toBe(VIDEO_UPLOADS_UNAVAILABLE[variant]);
				expect(featureUnavailableMessage('uploads', mode, variant)).not.toMatch(/Demo/);
			}
		}
	});

	it('leaves the photo and audio wording, and every other feature, as it was', () => {
		expect(featureUnavailableMessage('uploads', 'production')).toBe(
			'Uploads are temporarily unavailable. You can still paste an image URL or embed.'
		);
		expect(featureUnavailableMessage('uploads', 'demo')).toBe(
			'Uploads are turned off in this Demo. You can still paste an image URL or embed.'
		);
		for (const name of ['payments', 'email', 'fanSignIn'] as FeatureName[]) {
			expect(featureUnavailableMessage(name, 'production', 'video')).toBe(FEATURE_UNAVAILABLE[name]);
		}
	});
});
