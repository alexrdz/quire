<script lang="ts">
	import { Cover, Center, Stack, Cluster } from '$lib/components/layout';

	interface Props {
		open: boolean;
		onClose: () => void;
		qrSvg: string;
		title: string;
		subtitle: string;
		urlLabel: string;
		accentColor?: string;
	}

	let {
		open,
		onClose,
		qrSvg,
		title,
		subtitle,
		urlLabel,
		accentColor
	}: Props = $props();

	let closeButton = $state<HTMLButtonElement | null>(null);

	function handleWindowKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}

	$effect(() => {
		if (open && closeButton) {
			closeButton.focus();
		}
	});
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
	<Cover
		as="div"
		height={100}
		padding="sm"
		class="qr-case-backdrop"
		role="dialog"
		aria-modal="true"
		aria-labelledby="qr-case-title"
		style={accentColor ? `--accent: ${accentColor};` : undefined}
	>
		<Cluster as="header" justify="between" align="center" gap="sm" class="qr-case-header">
			<span class="qr-case-eyebrow font-mono">QUIRE · FULL-SCREEN CASE DISPLAY</span>
			<button
				type="button"
				class="qr-case-close"
				bind:this={closeButton}
				onclick={onClose}
				aria-label="Close full-screen QR display"
			>
				<Cluster as="span" gap="2xs" align="center" nowrap>
					<svg
						class="qr-case-close-icon"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.25"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
					<span>Close</span>
				</Cluster>
			</button>
		</Cluster>

		<Center max="sm" centerText data-cover-main class="qr-case-stage">
			<Stack gap="lg" align="center" class="qr-case-content">
				<div class="qr-case-card">
					<div class="qr-case-card-label font-mono">SCAN TO OPEN</div>
					<div class="qr-case-svg" aria-label="Scannable QR code for {title}">
						{@html qrSvg}
					</div>
					<div class="qr-case-card-brand font-mono">QUIRE</div>
				</div>

				<Stack gap="2xs" align="center">
					<h2 id="qr-case-title" class="qr-case-title">{title}</h2>
					{#if subtitle}
						<p class="qr-case-subtitle">{subtitle}</p>
					{/if}
					<p class="qr-case-url font-mono">{urlLabel}</p>
				</Stack>
			</Stack>
		</Center>

		<p class="qr-case-hint font-mono">
			PROP PHONE NEAR CASE OR MERCH TABLE · PRESS ESC TO EXIT
		</p>

		<button
			type="button"
			class="qr-case-scrim"
			aria-label="Close full-screen QR display"
			onclick={onClose}
			tabindex="-1"
		></button>
	</Cover>
{/if}

<style>
	:global(.qr-case-backdrop) {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background-color: var(--bg-void, #090710);
		color: var(--paper, #f4f4f0);
		overflow-y: auto;
	}

	.qr-case-scrim {
		position: fixed;
		inset: 0;
		z-index: 0;
		margin-block: 0;
		border: none;
		background: transparent;
		cursor: default;
	}

	:global(.qr-case-header) {
		position: relative;
		z-index: 1;
		margin-block-start: 0;
		inline-size: 100%;
	}

	.qr-case-eyebrow {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--accent, #05d9e8);
	}

	.qr-case-close {
		cursor: pointer;
		padding-block: 0.55rem;
		padding-inline: 1rem;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.24);
		color: #ffffff;
		font-size: 0.85rem;
		font-weight: 700;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.qr-case-close:hover {
		background: rgba(255, 255, 255, 0.16);
		border-color: var(--accent, #05d9e8);
	}

	.qr-case-close-icon {
		inline-size: 1rem;
		block-size: 1rem;
		display: block;
	}

	:global(.qr-case-stage) {
		position: relative;
		z-index: 1;
		inline-size: 100%;
		pointer-events: none;
	}

	:global(.qr-case-content) {
		pointer-events: auto;
	}

	.qr-case-card {
		background-color: #ffffff;
		color: #090710;
		border: 4px solid var(--accent, #05d9e8);
		border-radius: 1.5rem;
		padding-block: 1.5rem;
		padding-inline: 1.5rem;
		box-shadow: 0 0 48px rgba(5, 217, 232, 0.22);
	}

	.qr-case-card-label {
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #090710;
		margin-block-end: 0.75rem;
	}

	.qr-case-svg {
		inline-size: min(72vmin, 22rem);
		block-size: min(72vmin, 22rem);
		margin-inline: auto;
	}

	.qr-case-svg :global(svg) {
		inline-size: 100%;
		block-size: 100%;
		display: block;
	}

	.qr-case-card-brand {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #3a364a;
		margin-block-start: 0.75rem;
	}

	.qr-case-title {
		font-size: clamp(1.35rem, 3.5vw, 2rem);
		font-weight: 800;
		line-height: 1.15;
		color: #ffffff;
		letter-spacing: -0.02em;
	}

	.qr-case-subtitle {
		font-size: 0.98rem;
		color: #d4d2df;
		max-inline-size: 42ch;
	}

	.qr-case-url {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--accent, #05d9e8);
		word-break: break-all;
	}

	.qr-case-hint {
		position: relative;
		z-index: 1;
		margin-block-end: 0;
		text-align: center;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		color: var(--ink-muted, #9e9bae);
	}
</style>
