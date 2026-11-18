<script lang="ts">
	import { Stack } from '$lib/components/layout';
	import InfoPage from '$lib/components/site/InfoPage.svelte';
	import { LEGAL_ENTITY, LEGAL_UPDATED, SUPPORT_EMAIL } from '$lib/components/site/footer-links';
</script>

<InfoPage title="Privacy Policy" eyebrow="Legal" updated={LEGAL_UPDATED}>
	<Stack as="section" gap="xs">
		<h2>1. Who we are</h2>
		<p>
			Quire is operated by {LEGAL_ENTITY}. This policy explains what we collect, why, and the
			choices you have. Quire does not run advertising trackers and does not sell personal
			information.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>2. Information we collect</h2>
		<ul>
			<li>
				<strong>Artists:</strong> band name, email address, a hashed password, the content you
				upload (art, photos, audio, text, setlists), and the Venmo username you add for tips.
			</li>
			<li>
				<strong>Fans who sign in:</strong> the name and email address from your Google account, the
				notes you post, and the Issues you save or stamp.
			</li>
			<li>
				<strong>Tip taps:</strong> when a tip button is tapped, we record only that it was tapped: the
				artist, the Issue (if any), the amount selected and the time. We do not record who tapped.
				Payments happen in Venmo; we never see them or any payment details.
			</li>
			<li>
				<strong>Device storage:</strong> a signed scan token saved on your device to let you claim a Stamp
				later, and a session cookie when you are signed in.
			</li>
			<li>
				<strong>Technical data:</strong> standard server logs such as IP address and browser type, used
				for security and troubleshooting.
			</li>
		</ul>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>3. How we use it</h2>
		<ul>
			<li>To operate Quire: publish Issues, display Walls, show tip buttons and tip tap counts, and issue Stamps.</li>
			<li>To send transactional email such as verification, password reset and Venmo username change confirmations.</li>
			<li>To prevent fraud and abuse, and to keep the service secure.</li>
			<li>To comply with legal obligations.</li>
		</ul>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>4. Service providers</h2>
		<p>We share information only with providers that help us run the service:</p>
		<ul>
			<li>Resend, for transactional email.</li>
			<li>Google, for fan sign-in.</li>
			<li>Turso, for database hosting.</li>
			<li>Cloudflare R2, for media storage.</li>
			<li>Netlify, for application hosting.</li>
		</ul>
		<p>
			We may also disclose information when required by law or to protect the rights and safety of
			our users and the service.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>5. What is public</h2>
		<p>
			Notes you post on a Wall, along with your display name, are visible to anyone who opens that
			Wall. A "Was there" mark appears on notes from fans who stamped that Issue. Your email
			address is never shown publicly.
		</p>
		<p>
			Tips are sent through Venmo, which Quire does not operate. Depending on your Venmo privacy
			settings, a Venmo payment and its note may be public. The note Quire fills in names only the
			artist, never the venue, city or date, and you can edit it in Venmo before you pay. Venmo's own
			privacy policy covers your payment.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>6. Retention</h2>
		<p>
			Issues are archived, not deleted, so fans' Stubs, tip tap counts and Walls persist. We delete or
			anonymize other personal information when you ask us to, unless we must keep it by law.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>7. Your choices</h2>
		<p>
			You can ask to access, correct or delete your personal information by emailing
			<a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>. We will respond within a reasonable
			time and may need to verify your identity first. You can clear the scan token and cookies at
			any time in your browser settings, though that may prevent you from claiming a pending Stamp.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>8. Security</h2>
		<p>
			We use industry-standard safeguards, including hashed passwords, signed tokens and encrypted
			connections. No system is perfectly secure, so we cannot guarantee absolute security.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>9. Children</h2>
		<p>
			Quire is not directed at children under 13, and we do not knowingly collect their personal
			information. If you believe a child has given us information, contact us and we will delete
			it.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>10. International use</h2>
		<p>
			Quire is operated from the United States. If you use it from elsewhere, your information
			will be processed in the United States and in the countries where our providers operate.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>11. Changes</h2>
		<p>
			We may update this policy. The date above shows the latest revision. For material changes
			we will give notice in the service or by email.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>12. Contact</h2>
		<p>Privacy questions: <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>.</p>
	</Stack>
</InfoPage>
