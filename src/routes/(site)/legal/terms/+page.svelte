<script lang="ts">
	import { Stack } from '$lib/components/layout';
	import InfoPage from '$lib/components/site/InfoPage.svelte';
	import { LEGAL_ENTITY, LEGAL_UPDATED, SUPPORT_EMAIL } from '$lib/components/site/footer-links';
</script>

<InfoPage title="Terms of Service" eyebrow="Legal" updated={LEGAL_UPDATED}>
	<Stack as="section" gap="xs">
		<h2>1. Agreement</h2>
		<p>
			These Terms govern your use of Quire, a service operated by {LEGAL_ENTITY} ("Quire", "we",
			"us"). By using Quire as an artist or a fan, you agree to these Terms. If you do not agree,
			do not use the service.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>2. The service</h2>
		<p>
			Quire lets touring artists publish digital zines ("Issues") tied to a gig, collect tips, and
			host a public Wall of notes. Fans can read Issues, leave tips, sign Walls, and save or stamp
			Issues.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>3. Accounts</h2>
		<ul>
			<li>
				Artists sign in with an email and password. One login is shared by the band, and you are
				responsible for everyone who uses it.
			</li>
			<li>Fans sign in with Google only when they sign a Wall, save an Issue, or claim a Stamp.</li>
			<li>You must provide accurate information and keep your credentials secure.</li>
			<li>You must be at least 13 years old to use Quire, and at least 18 to receive payouts.</li>
		</ul>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>4. Artist content</h2>
		<p>
			You keep ownership of what you upload, including cover art, photos, audio, text and setlists.
			You grant Quire a non-exclusive, worldwide license to host, display and distribute that
			content as needed to operate the service. You confirm that you have the rights to everything
			you upload and that it does not infringe anyone else's rights.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>5. Walls and conduct</h2>
		<p>Walls are public. Do not post content that is unlawful, harassing, hateful or deceptive.</p>
		<ul>
			<li>Notes may not contain links, email addresses or phone numbers.</li>
			<li>Artists may hide notes, block fans and require approval of notes before they appear.</li>
			<li>We may remove content or restrict accounts that violate these Terms.</li>
		</ul>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>6. Tips and payments</h2>
		<ul>
			<li>Payments are processed by Stripe. Artists must complete Stripe Connect onboarding to receive tips and agree to Stripe's terms.</li>
			<li>Tips are in US dollars, with a $2 minimum and a $500 maximum.</li>
			<li>A tip is charged only when the fan taps to pay. Failed payments are not retried.</li>
			<li>Quire keeps a 5% platform fee on each tip. Stripe also charges processing fees. By default the artist absorbs both, and a fan may choose to cover them.</li>
			<li>Tips are voluntary gifts to the artist. Refunds, disputes and chargebacks are the artist's responsibility and are deducted from the artist's balance.</li>
			<li>Tips cannot include a message. Use the Wall for messages.</li>
		</ul>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>7. Stamps and attendance</h2>
		<p>
			A Stamp indicates that a fan reached an Issue by scanning its QR code during the Stamp
			Window. Quire does not guarantee that a Stamp proves physical attendance, and Stamps have no
			monetary value.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>8. Archiving and records</h2>
		<p>
			Issues are archived rather than deleted. Archived Issues, their Walls, fan Stubs and tip
			records remain available to the extent needed to maintain those records.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>9. Acceptable use</h2>
		<p>
			Do not interfere with the service, attempt unauthorized access, scrape it at scale, use it to
			send spam, or use it in violation of any law.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>10. Suspension and termination</h2>
		<p>
			You may stop using Quire at any time. We may suspend or terminate access if you violate these
			Terms or put the service or other users at risk. Sections that by their nature should survive
			termination will survive.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>11. Disclaimers</h2>
		<p>
			Quire is provided "as is" and "as available" without warranties of any kind, to the fullest
			extent permitted by law. We do not guarantee uninterrupted or error-free operation.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>12. Limitation of liability</h2>
		<p>
			To the fullest extent permitted by law, {LEGAL_ENTITY} will not be liable for indirect,
			incidental, special or consequential damages, or for lost profits or data. Our total
			liability for any claim relating to the service is limited to the greater of the fees we
			received from you in the 12 months before the claim or one hundred US dollars.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>13. Changes to these Terms</h2>
		<p>
			We may update these Terms. The date above shows the latest revision. Continuing to use Quire
			after a change means you accept the updated Terms.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>14. Governing law</h2>
		<p>
			These Terms are governed by the laws of the United States and of the state in which
			{LEGAL_ENTITY} is organized, without regard to conflict of law rules.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>15. Contact</h2>
		<p>Questions about these Terms: <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>.</p>
	</Stack>
</InfoPage>
