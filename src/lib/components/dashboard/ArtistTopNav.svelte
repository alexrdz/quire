<script lang="ts">
	import { Container, Cluster } from '$lib/components/layout';

	let {
		artist,
		activeTab = 'overview'
	}: {
		artist: { displayName: string; slug: string };
		activeTab?: 'overview' | 'template' | 'settings' | 'quick' | 'bookbinder';
	} = $props();
</script>

<header class="app-topbar">
	<Container width="lg" padding="none">
		<Cluster justify="between" align="center" gap="md">
			<Cluster as="a" href="/dashboard" align="center" gap="2xs" class="brand-identity-link">
				<span class="font-mono brand-code">QUIRE</span>
				<span class="brand-sep"></span>
				<span class="artist-nav-name">{artist.displayName}</span>
			</Cluster>

			<Cluster as="nav" align="center" gap="3xs" class="app-nav-group" aria-label="Artist Studio Navigation">
				<a
					href="/dashboard"
					class="app-nav-tab {activeTab === 'overview' ? 'is-active' : ''}"
				>
					Overview
				</a>
				<a
					href="/dashboard/template"
					class="app-nav-tab {activeTab === 'template' ? 'is-active' : ''}"
				>
					Master Template
				</a>
				<a
					href="/dashboard/settings"
					class="app-nav-tab {activeTab === 'settings' ? 'is-active' : ''}"
				>
					Settings & Payouts
				</a>
				<a
					href="/a/{artist.slug}"
					class="app-nav-tab"
				>
					Back Page ↗
				</a>
			</Cluster>

			<Cluster align="center" gap="xs">
				<a
					href="/dashboard/issues/quick"
					class="btn-nav-primary"
				>
					+ Quick Issue (Phone)
				</a>
				<a href="/logout" class="btn-nav-ghost">
					Sign Out
				</a>
			</Cluster>
		</Cluster>
	</Container>
</header>

<style>
	:global(.brand-identity-link) {
		text-decoration: none;
	}

	.brand-code {
		color: var(--highlight);
		font-weight: 800;
		font-size: 0.85rem;
		letter-spacing: 0.12em;
	}

	.brand-sep {
		inline-size: 1px;
		block-size: 1rem;
		background: var(--glass-border);
	}

	.artist-nav-name {
		font-size: 1rem;
		font-weight: 800;
		color: #ffffff;
		letter-spacing: -0.01em;
	}

	:global(.app-nav-group) {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--glass-border);
		border-radius: 8px;
		padding: 0.25rem;
	}

	.app-nav-tab {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding-block: 0.4rem;
		padding-inline: 0.875rem;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		color: #D4D2DF;
		text-decoration: none;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.app-nav-tab:visited {
		color: #D4D2DF;
	}

	.app-nav-tab:hover {
		color: #FFFFFF;
		background: rgba(255, 255, 255, 0.08);
	}

	.app-nav-tab.is-active {
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.35);
	}

	.btn-nav-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding-block: 0.45rem;
		padding-inline: 0.95rem;
		border-radius: 8px;
		background: var(--support);
		color: #ffffff;
		font-size: 0.78rem;
		font-weight: 700;
		text-decoration: none;
		border: 1px solid rgba(255, 42, 109, 0.5);
		box-shadow: 0 0 16px rgba(255, 42, 109, 0.3);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-nav-primary:hover {
		transform: translateY(-1px);
		box-shadow: 0 0 20px rgba(255, 42, 109, 0.5);
		color: #ffffff;
	}

	.btn-nav-ghost {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: 0.45rem;
		padding-inline: 0.75rem;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.04);
		color: #a1a1aa;
		font-size: 0.78rem;
		font-weight: 600;
		text-decoration: none;
		border: 1px solid rgba(255, 255, 255, 0.08);
		transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
	}

	.btn-nav-ghost:hover {
		background: rgba(255, 255, 255, 0.09);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.16);
	}
</style>
