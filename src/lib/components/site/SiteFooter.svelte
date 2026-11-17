<script lang="ts">
	import { Box, Cluster, Container, Grid, Stack } from '$lib/components/layout';
	import { FOOTER_GROUPS, LEGAL_ENTITY, LEGAL_LINKS } from './footer-links';

	const year = new Date().getFullYear();
</script>

<Box as="footer" padding="lg" border="none" radius="none" class="site-footer">
	<Container width="main" padding="none">
		<Stack gap="xl">
			<Grid min="xs" gap="xl">
				<Stack gap="sm" class="site-footer-brand">
					<span class="site-footer-wordmark">QUIRE.</span>
					<p class="site-footer-blurb">
						Digital zines for touring artists and buskers. The intimacy of a live show, kept
						in your pocket.
					</p>
				</Stack>

				{#each FOOTER_GROUPS as group (group.heading)}
					<Stack as="nav" gap="xs" aria-label={group.heading} class="site-footer-nav">
						<span class="site-footer-heading">{group.heading}</span>
						{#each group.links as link (link.href)}
							<a href={link.href}>{link.label}</a>
						{/each}
					</Stack>
				{/each}
			</Grid>

			<Cluster justify="between" align="center" gap="sm" class="site-footer-legal">
				<small>&copy; {year} {LEGAL_ENTITY}. All rights reserved.</small>
				<Cluster as="nav" gap="sm" aria-label="Legal" class="site-footer-nav">
					{#each LEGAL_LINKS as link (link.href)}
						<a href={link.href}>{link.label}</a>
					{/each}
				</Cluster>
			</Cluster>
		</Stack>
	</Container>
</Box>
