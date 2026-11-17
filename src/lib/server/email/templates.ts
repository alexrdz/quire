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
