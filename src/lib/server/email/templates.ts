export interface EmailTemplate {
	subject: string;
	html: string;
	text: string;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function wrapEmailLayout(title: string, bodyHtml: string, footerNote: string): string {
	const safeTitle = escapeHtml(title);
	const safeFooter = escapeHtml(footerNote);

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeTitle}</title>
</head>
<body style="margin:0;padding:24px;background-color:#090710;color:#ffffff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background-color:#151124;border:1px solid #2b2442;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:28px 28px 16px 28px;border-bottom:1px solid #2b2442;">
        <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#05D9E8;font-weight:700;">QUIRE</div>
        <h1 style="margin:10px 0 0 0;font-size:20px;line-height:1.3;color:#ffffff;">${safeTitle}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;font-size:15px;line-height:1.6;color:#e4e4e7;">
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px 24px 28px;border-top:1px solid #2b2442;font-size:12px;line-height:1.5;color:#a1a1aa;">
        ${safeFooter}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildEmailVerificationTemplate(params: {
	artistName: string;
	verificationUrl: string;
}): EmailTemplate {
	const safeName = escapeHtml(params.artistName);
	const safeUrl = escapeHtml(params.verificationUrl);

	const subject = 'Verify your Quire artist email address';
	const html = wrapEmailLayout(
		'Verify your email address',
		`<p style="margin:0 0 16px 0;">Hello ${safeName},</p>
<p style="margin:0 0 20px 0;">Confirm this email address to secure your Quire artist account and enable payout notifications.</p>
<p style="margin:0 0 24px 0;">
  <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background-color:#05D9E8;color:#090710;font-weight:700;text-decoration:none;border-radius:8px;">Verify Email Address</a>
</p>
<p style="margin:0;font-size:13px;color:#a1a1aa;word-break:break-all;">Or open this link directly:<br />${safeUrl}</p>`,
		'If you did not create a Quire artist account, you can safely ignore this message.'
	);

	const text = [
		`Hello ${params.artistName},`,
		'',
		'Confirm this email address to secure your Quire artist account and enable payout notifications:',
		params.verificationUrl,
		'',
		'If you did not create a Quire artist account, you can safely ignore this message.'
	].join('\n');

	return { subject, html, text };
}

export function buildPasswordResetTemplate(params: {
	artistName: string;
	resetUrl: string;
}): EmailTemplate {
	const safeName = escapeHtml(params.artistName);
	const safeUrl = escapeHtml(params.resetUrl);

	const subject = 'Reset your Quire artist password';
	const html = wrapEmailLayout(
		'Password reset request',
		`<p style="margin:0 0 16px 0;">Hello ${safeName},</p>
<p style="margin:0 0 20px 0;">We received a request to reset the password for your shared Quire artist login. Use the button below to choose a new password.</p>
<p style="margin:0 0 24px 0;">
  <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background-color:#01FFC3;color:#090710;font-weight:700;text-decoration:none;border-radius:8px;">Reset Password</a>
</p>
<p style="margin:0;font-size:13px;color:#a1a1aa;word-break:break-all;">Or open this link directly:<br />${safeUrl}</p>`,
		'If you did not request a password reset, no changes were made. Consider rotating your shared band login if unexpected requests continue.'
	);

	const text = [
		`Hello ${params.artistName},`,
		'',
		'We received a request to reset the password for your Quire artist login.',
		`Reset your password here: ${params.resetUrl}`,
		'',
		'If you did not request a password reset, you can safely ignore this email.'
	].join('\n');

	return { subject, html, text };
}

export function buildPayoutAccountChangeTemplate(params: {
	artistName: string;
	confirmationUrl: string;
	newStripeAccountId: string;
}): EmailTemplate {
	const safeName = escapeHtml(params.artistName);
	const safeUrl = escapeHtml(params.confirmationUrl);
	const safeAccount = escapeHtml(params.newStripeAccountId);

	const subject = 'Confirm payout account change for your Quire artist account';
	const html = wrapEmailLayout(
		'Confirm payout account change',
		`<p style="margin:0 0 16px 0;">Hello ${safeName},</p>
<p style="margin:0 0 16px 0;">A request was submitted to update the connected Stripe Express payout account for your Quire artist profile.</p>
<p style="margin:0 0 16px 0;padding:12px 16px;background-color:#090710;border:1px solid #2b2442;border-radius:8px;font-family:monospace;font-size:13px;color:#01FFC3;">Target Stripe Account: ${safeAccount}</p>
<p style="margin:0 0 20px 0;">Because artist logins are shared among bandmates, payout destination changes require email confirmation before tips are routed to the new account.</p>
<p style="margin:0 0 24px 0;">
  <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background-color:#FF2A6D;color:#ffffff;font-weight:700;text-decoration:none;border-radius:8px;">Confirm Payout Change</a>
</p>
<p style="margin:0;font-size:13px;color:#a1a1aa;word-break:break-all;">Or open this link directly:<br />${safeUrl}</p>`,
		'If you or your bandmates did not initiate this payout account change, do not click the link and change your account password immediately.'
	);

	const text = [
		`Hello ${params.artistName},`,
		'',
		'A request was submitted to update the connected Stripe Express payout account for your Quire artist profile.',
		`Target Stripe Account: ${params.newStripeAccountId}`,
		'',
		'Because artist logins are shared among bandmates, payout destination changes require email confirmation before tips are routed to the new account.',
		`Confirm payout change: ${params.confirmationUrl}`,
		'',
		'If you did not initiate this change, do not click the link and change your account password immediately.'
	].join('\n');

	return { subject, html, text };
}

export function buildSlugPetitionConfirmationTemplate(params: {
	petitionerName: string;
	requestedSlug: string;
	existingArtistClosed: boolean;
}): EmailTemplate {
	const safeName = escapeHtml(params.petitionerName);
	const safeSlug = escapeHtml(params.requestedSlug);
	const ownerStateNote = params.existingArtistClosed
		? 'The original owner of this handle has closed their Quire account.'
		: 'This handle is currently registered to another artist on Quire.';

	const subject = `Handle claim petition received for /a/${params.requestedSlug}`;
	const html = wrapEmailLayout(
		`Petition received for /a/${safeSlug}`,
		`<p style="margin:0 0 16px 0;">Hello ${safeName},</p>
<p style="margin:0 0 16px 0;">We received your request to acquire the Quire artist handle <strong style="color:#01FFC3;">/a/${safeSlug}</strong>.</p>
<p style="margin:0 0 16px 0;">${escapeHtml(ownerStateNote)} Our team reviews handle transfer petitions manually to protect artists from impersonation while ensuring legitimate bands can claim inactive handles.</p>
<p style="margin:0;font-size:13px;color:#a1a1aa;">In the meantime, you can register another handle right away and begin publishing gig zines.</p>`,
		'No action is needed right now. We will follow up at this email address once your petition is reviewed.'
	);

	const text = [
		`Hello ${params.petitionerName},`,
		'',
		`We received your request to acquire the Quire artist handle /a/${params.requestedSlug}.`,
		ownerStateNote,
		'Our team reviews handle transfer petitions manually to protect artists from impersonation while ensuring legitimate bands can claim inactive handles.',
		'',
		'We will follow up at this email address once your petition is reviewed.'
	].join('\n');

	return { subject, html, text };
}

export function buildSlugPetitionDecisionTemplate(params: {
	petitionerName: string;
	requestedSlug: string;
	decision: 'approved' | 'rejected';
	note?: string;
}): EmailTemplate {
	const safeName = escapeHtml(params.petitionerName);
	const safeSlug = escapeHtml(params.requestedSlug);
	const trimmedNote = params.note?.trim();
	const safeNote = trimmedNote ? escapeHtml(trimmedNote) : '';

	if (params.decision === 'approved') {
		const subject = `Handle petition approved: /a/${params.requestedSlug} is now available`;
		const html = wrapEmailLayout(
			`/a/${safeSlug} has been released`,
			`<p style="margin:0 0 16px 0;">Hello ${safeName},</p>
<p style="margin:0 0 16px 0;">Your handle petition for <strong style="color:#01FFC3;">/a/${safeSlug}</strong> has been approved. The handle is now released and ready for your artist registration on Quire.</p>
${safeNote ? `<p style="margin:0 0 16px 0;font-size:13px;color:#d4d4d8;">Reviewer note: ${safeNote}</p>` : ''}
<p style="margin:0;font-size:13px;color:#a1a1aa;">Visit Sign Up and claim <strong>${safeSlug}</strong> to set up your Back Page and Issue #1.</p>`,
			'Handles are claimed on a first-come basis once released.'
		);

		const text = [
			`Hello ${params.petitionerName},`,
			'',
			`Your handle petition for /a/${params.requestedSlug} has been approved. The handle is now released and ready for your artist registration on Quire.`,
			...(trimmedNote ? ['', `Reviewer note: ${trimmedNote}`] : []),
			'',
			`Visit Sign Up and claim "${params.requestedSlug}" to set up your Back Page and Issue #1.`
		].join('\n');

		return { subject, html, text };
	}

	const subject = `Update on your handle petition for /a/${params.requestedSlug}`;
	const html = wrapEmailLayout(
		`Handle petition not approved`,
		`<p style="margin:0 0 16px 0;">Hello ${safeName},</p>
<p style="margin:0 0 16px 0;">Thank you for submitting a petition for <strong style="color:#01FFC3;">/a/${safeSlug}</strong>. After reviewing the existing artist profile and submitted evidence, we are unable to transfer this handle.</p>
${safeNote ? `<p style="margin:0 0 16px 0;font-size:13px;color:#d4d4d8;">Reviewer note: ${safeNote}</p>` : ''}
<p style="margin:0;font-size:13px;color:#a1a1aa;">You can register a different handle on Quire anytime to start publishing gig zines.</p>`,
		'Quire preserves active artist handles and fan collections to prevent impersonation.'
	);

	const text = [
		`Hello ${params.petitionerName},`,
		'',
		`Thank you for submitting a petition for /a/${params.requestedSlug}. After reviewing the existing artist profile and submitted evidence, we are unable to transfer this handle.`,
		...(trimmedNote ? ['', `Reviewer note: ${trimmedNote}`] : []),
		'',
		'You can register a different handle on Quire anytime to start publishing gig zines.'
	].join('\n');

	return { subject, html, text };
}

/** "@name", or a plain phrase when there is no username. */
function venmoLabel(username: string | null): string {
	return username ? `@${username}` : 'no Venmo username';
}

/**
 * Asks the account email to confirm a Venmo username change or removal (ADR 0008).
 * The old username keeps receiving tips until the link is followed.
 */
export function buildVenmoChangeConfirmationTemplate(params: {
	artistName: string;
	oldUsername: string;
	newUsername: string | null;
	confirmationUrl: string;
}): EmailTemplate {
	const safeName = escapeHtml(params.artistName);
	const safeUrl = escapeHtml(params.confirmationUrl);
	const safeOld = escapeHtml(venmoLabel(params.oldUsername));
	const safeNew = escapeHtml(venmoLabel(params.newUsername));
	const removing = params.newUsername === null;

	const subject = removing
		? 'Confirm removing the Venmo username from your Quire tips'
		: 'Confirm your new Venmo username for Quire tips';
	const request = removing
		? `Someone signed in to your Quire artist account asked to remove ${safeOld}. Tip buttons will stop opening Venmo.`
		: `Someone signed in to your Quire artist account asked to send tips to ${safeNew} instead of ${safeOld}.`;
	const html = wrapEmailLayout(
		removing ? 'Confirm Venmo removal' : 'Confirm Venmo change',
		`<p style="margin:0 0 16px 0;">Hello ${safeName},</p>
<p style="margin:0 0 16px 0;">${request}</p>
<p style="margin:0 0 20px 0;">Nothing changes until you confirm. Tips keep going to ${safeOld} until then. This link works once and expires in 1 hour.</p>
<p style="margin:0 0 24px 0;">
  <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background-color:#FF2A6D;color:#ffffff;font-weight:700;text-decoration:none;border-radius:8px;">Review the change</a>
</p>
<p style="margin:0;font-size:13px;color:#a1a1aa;word-break:break-all;">Or open this link directly:<br />${safeUrl}</p>`,
		'If you and your bandmates did not ask for this, ignore this email and change your band password.'
	);

	const text = [
		`Hello ${params.artistName},`,
		'',
		removing
			? `Someone signed in to your Quire artist account asked to remove ${venmoLabel(params.oldUsername)}. Tip buttons will stop opening Venmo.`
			: `Someone signed in to your Quire artist account asked to send tips to ${venmoLabel(params.newUsername)} instead of ${venmoLabel(params.oldUsername)}.`,
		'',
		`Nothing changes until you confirm. Tips keep going to ${venmoLabel(params.oldUsername)} until then. This link works once and expires in 1 hour.`,
		`Review the change: ${params.confirmationUrl}`,
		'',
		'If you and your bandmates did not ask for this, ignore this email and change your band password.'
	].join('\n');

	return { subject, html, text };
}

/** Sent after a Venmo username change or removal is applied (ADR 0008). Contains no link. */
export function buildVenmoChangedNoticeTemplate(params: {
	artistName: string;
	newUsername: string | null;
}): EmailTemplate {
	const safeName = escapeHtml(params.artistName);
	const sentence = params.newUsername
		? `Your Venmo username was changed to @${params.newUsername}.`
		: 'Your Venmo username was removed. Tip buttons no longer open Venmo.';
	const warning = "If this wasn't you, reset your password.";

	const subject = params.newUsername
		? 'Your Quire Venmo username was changed'
		: 'Your Quire Venmo username was removed';
	const html = wrapEmailLayout(
		params.newUsername ? 'Venmo username changed' : 'Venmo username removed',
		`<p style="margin:0 0 16px 0;">Hello ${safeName},</p>
<p style="margin:0 0 16px 0;">${escapeHtml(sentence)}</p>
<p style="margin:0;">${escapeHtml(warning)}</p>`,
		'You are receiving this because the Venmo username on your Quire artist account changed.'
	);
	const text = [`Hello ${params.artistName},`, '', sentence, warning].join('\n');

	return { subject, html, text };
}
