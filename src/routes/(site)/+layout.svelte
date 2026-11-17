<script lang="ts">
  import { Cover } from "$lib/components/layout";
  import SiteFooter from "$lib/components/site/SiteFooter.svelte";

  let { children } = $props();
</script>

<Cover padding="none" height={100} class="site-shell">
  {@render children()}
  <SiteFooter />
</Cover>
