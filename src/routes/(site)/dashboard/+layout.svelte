<script lang="ts">
	import EmailConfirmBar from '$lib/components/dashboard/EmailConfirmBar.svelte';

	let { data, children } = $props();
</script>

{#if data.emailConfirmation && !data.emailConfirmation.confirmed}
	<EmailConfirmBar
		email={data.emailConfirmation.email}
		canResend={data.emailConfirmation.canResend}
		unavailableMessage={data.emailConfirmation.unavailableMessage}
	/>
{/if}

{@render children()}
