<script lang="ts">
	import { Stack } from '$lib/components/layout';
	import InfoPage from '$lib/components/site/InfoPage.svelte';
	import { LEGAL_ENTITY, SUPPORT_EMAIL } from '$lib/components/site/footer-links';
</script>

<InfoPage title="Contact support" eyebrow="Support">
	<Stack as="section" gap="xs">
		<h2>Email us</h2>
		<p>
			Write to <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>. We read every message and
			aim to reply within two business days.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>Include these details</h2>
		<ul>
			<li>The email address on your account, if you have one.</li>
			<li>The artist page or Issue link where the problem happened.</li>
			<li>What you expected and what happened instead.</li>
			<li>For a tip problem, the date, amount and the last four digits of the card used.</li>
		</ul>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>Before you write</h2>
		<p>
			Many answers are in the <a href="/faq">FAQ</a>. For privacy requests such as access or
			deletion, see the <a href="/legal/privacy">Privacy Policy</a>.
		</p>
	</Stack>

	<Stack as="section" gap="xs">
		<h2>Who runs Quire</h2>
		<p>Quire is operated by {LEGAL_ENTITY}.</p>
	</Stack>
</InfoPage>
