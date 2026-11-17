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

export const signedScanTokenSchema = z
	.string()
	.regex(
		/^[a-z0-9-]+\.\d+\.[0-9a-f]{64}$/,
		'Invalid attendance scan token format'
	);

export type SignedScanToken = z.infer<typeof signedScanTokenSchema>;
