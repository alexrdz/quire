<script lang="ts">
	import '../app.css';
	import DemoBanner from '$lib/components/site/DemoBanner.svelte';

	let { data, children } = $props();
</script>

<!-- Every page, including the error page, which renders inside this layout. -->
<DemoBanner mode={data.features?.mode} signupUrl={data.demoSignupUrl ?? null} />

{@render children()}
