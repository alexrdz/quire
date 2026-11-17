import { z } from 'zod';
import { MODERATION_ACTIONS, NOTE_STATUSES } from '$domain/wall';

export const noteStatusSchema = z.enum(NOTE_STATUSES);
export const moderationActionSchema = z.enum(MODERATION_ACTIONS);

export const submitNoteSchema = z.object({
	artistId: z.string().min(1).optional(),
	issueId: z.string().nullable().optional(),
	body: z
		.string()
		.trim()
		.min(1, 'Note cannot be empty')
		.max(500, 'Note cannot exceed 500 characters')
		.refine((val) => !/(https?:\/\/|www\.|\.com|\.org|\.net|\.io|\.gg|\.me\b)/i.test(val), {
			message: 'Links and URLs are not permitted on the Wall.'
		})
		.refine((val) => !/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(val), {
			message: 'Email addresses are not permitted on the Wall.'
		})
		.refine((val) => !/(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/.test(val), {
			message: 'Phone numbers are not permitted on the Wall.'
		})
});

export type SubmitNoteInput = z.infer<typeof submitNoteSchema>;

export const replyNoteSchema = z.object({
	noteId: z.string().min(1, 'Note ID is required'),
	body: z
		.string()
		.trim()
		.min(1, 'Reply cannot be empty')
		.max(300, 'Reply cannot exceed 300 characters')
});

export type ReplyNoteInput = z.infer<typeof replyNoteSchema>;

export const noteIdSchema = z.object({
	noteId: z.string().min(1, 'Note ID is required')
});

export type NoteIdInput = z.infer<typeof noteIdSchema>;

export const flagNoteSchema = noteIdSchema;

export type FlagNoteInput = z.infer<typeof flagNoteSchema>;

export const moderateNoteSchema = z.object({
	noteId: z.string().min(1, 'Note ID is required'),
	action: moderationActionSchema
});

export type ModerateNoteInput = z.infer<typeof moderateNoteSchema>;

export const blockFanSchema = z.object({
	fanUserId: z.string().min(1, 'Fan user ID is required'),
	artistId: z.string().min(1).optional()
});

export type BlockFanInput = z.infer<typeof blockFanSchema>;

export const unblockFanSchema = blockFanSchema;

export type UnblockFanInput = BlockFanInput;
