import { z } from 'zod';

/**
 * Direct video uploads (ADR 0010). The browser declares the type and size it is
 * about to PUT; finalize names the pending key it PUT to. Type, size and key are
 * checked again against the stored bytes, so these only shape the request.
 */
export const VIDEO_UPLOAD_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

export const presignVideoUploadSchema = z.object({
	contentType: z.enum(VIDEO_UPLOAD_TYPES, {
		error: 'This video type is not supported. Please upload MP4, WebM or MOV.'
	}),
	size: z.number().int().positive('The video is empty.')
});

export const finalizeVideoUploadSchema = z.object({
	key: z.string().min(1).max(200)
});

export type PresignVideoUploadInput = z.infer<typeof presignVideoUploadSchema>;
export type FinalizeVideoUploadInput = z.infer<typeof finalizeVideoUploadSchema>;
