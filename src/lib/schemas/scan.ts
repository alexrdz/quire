import { z } from 'zod';

export const scanQuerySchema = z.object({
	k: z.string().min(1, 'Scan secret key parameter "k" is required')
});

export type ScanQueryInput = z.infer<typeof scanQuerySchema>;

export const claimStampSchema = z.object({
	issueId: z.string().min(1, 'Issue ID is required')
});

export type ClaimStampInput = z.infer<typeof claimStampSchema>;

export const saveIssueSchema = z.object({
	issueId: z.string().min(1, 'Issue ID is required')
});

export type SaveIssueInput = z.infer<typeof saveIssueSchema>;
