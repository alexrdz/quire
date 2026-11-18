<script lang="ts">
	import { Box, Cluster, Stack } from '$lib/components/layout';
	import { buildVenmoPayUrl, parseVenmoUsername, tipNote } from '$domain/venmo';
	import { MAX_TIP_CENTS, MIN_TIP_CENTS } from '$domain/tipping';
	import { demoVenmoMessage } from './tip-taps';

	/**
	 * Venmo tip buttons (ADR 0008, PRODUCTION_PLAN V.4).
	 *
	 * In production every amount is a real link to Venmo, so the Fan's own tap
	 * opens the Venmo app or site, with or without JavaScript. With JavaScript the
	 * tap is also reported to /api/tip-tap with a fire-and-forget beacon that never
	 * delays the link. In the Demo, development and tests (`opensVenmo` false) the
	 * buttons never navigate: the tap is recorded and a Demo message is shown. The
	 * would-be Venmo URL is exposed as `data-venmo-url`.
	 *
	 * Copy never says a payment happened: Quire cannot see it.
	 */
	interface Props {
		artistSlug: string;
		artistName: string;
		venmoUsername: string;
		/** Null for the General tip button on the Back Page. */
		issueSlug?: string | null;
		/** Preset amounts in whole dollars. */
		presets?: number[];
		/** `features.tipsOpenVenmo`: true only in production. */
		opensVenmo: boolean;
		id?: string;
		class?: string;
	}

	let {
		artistSlug,
		artistName,
		venmoUsername,
		issueSlug = null,
		presets = [3, 5, 10],
		opensVenmo,
		id = 'tip',
		class: className = ''
	}: Props = $props();

	/** Taps on the same amount within this window open Venmo once and count once. */
	const DOUBLE_TAP_MS = 2000;

	const username = $derived.by(() => {
		const parsed = parseVenmoUsername(venmoUsername);
		return parsed.ok ? parsed.value : null;
	});
	const note = $derived(tipNote(artistName));
	const presetCents = $derived(
		presets
			.map((dollars) => Math.round(dollars * 100))
			.filter((cents) => cents >= MIN_TIP_CENTS && cents <= MAX_TIP_CENTS)
	);

	let customDollars = $state('');
	const customCents = $derived.by(() => {
		const value = Number(customDollars);
		if (!customDollars.trim() || !Number.isFinite(value)) return null;
		const cents = Math.round(value * 100);
		return cents >= MIN_TIP_CENTS && cents <= MAX_TIP_CENTS ? cents : null;
	});

	let message = $state<string | null>(null);
	let lastTap: { cents: number; at: number } | null = null;

	function payUrl(cents: number): string {
		return username ? buildVenmoPayUrl({ username, amountCents: cents, note }) : '';
	}

	function dollarsLabel(cents: number): string {
		return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
	}

	/** Fire-and-forget. Never awaited, never blocks the link. */
	function reportTap(cents: number): void {
		const body = JSON.stringify({ artistSlug, issueSlug, amountCents: cents });
		try {
			const blob = new Blob([body], { type: 'application/json' });
			if (navigator.sendBeacon?.('/api/tip-tap', blob)) return;
		} catch {
			// Fall through to fetch.
		}
		try {
			void fetch('/api/tip-tap', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body,
				keepalive: true
			}).catch(() => undefined);
		} catch {
			// The tap is just not counted.
		}
	}

	function onTap(event: MouseEvent, cents: number): void {
		const now = Date.now();
		if (lastTap && lastTap.cents === cents && now - lastTap.at < DOUBLE_TAP_MS) {
			// Second tap of a double tap: no second Venmo open, no second count.
			event.preventDefault();
			return;
		}
		lastTap = { cents, at: now };
		reportTap(cents);

		if (!opensVenmo) {
			event.preventDefault();
			message = demoVenmoMessage(cents, username ?? venmoUsername);
		}
	}
</script>

{#if username}
	<Box as="section" {id} padding="md" radius="lg" class="venmo-tip-panel {className}" aria-label="Tip {artistName} with Venmo">
		<Stack gap="sm">
			<Stack gap="3xs">
				<h2 class="venmo-tip-title">Tip {artistName} with Venmo</h2>
				<p class="venmo-tip-hint">
					Opens Venmo to pay <span class="font-mono">@{username}</span>. You confirm the payment in Venmo; Quire takes no cut.
				</p>
			</Stack>

			<Cluster distributeEqually gap="xs" class="venmo-tip-presets">
				{#each presetCents as cents (cents)}
					{#if opensVenmo}
						<a
							class="venmo-tip-preset"
							href={payUrl(cents)}
							data-venmo-url={payUrl(cents)}
							data-amount-cents={cents}
							onclick={(event) => onTap(event, cents)}
						>
							{dollarsLabel(cents)}
						</a>
					{:else}
						<button
							type="button"
							class="venmo-tip-preset"
							data-venmo-url={payUrl(cents)}
							data-amount-cents={cents}
							onclick={(event) => onTap(event, cents)}
						>
							{dollarsLabel(cents)}
						</button>
					{/if}
				{/each}
			</Cluster>

			<Cluster align="end" gap="xs" class="venmo-tip-custom">
				<Stack gap="3xs" class="venmo-tip-custom-field">
					<label for="{id}-custom" class="venmo-tip-label">Other amount ($2 to $500)</label>
					<input
						id="{id}-custom"
						class="venmo-tip-input"
						type="number"
						inputmode="decimal"
						min="2"
						max="500"
						step="1"
						placeholder="20"
						bind:value={customDollars}
					/>
				</Stack>
				{#if customCents === null}
					<span class="venmo-tip-go" aria-disabled="true">Tip with Venmo</span>
				{:else if opensVenmo}
					<a
						class="venmo-tip-go"
						href={payUrl(customCents)}
						data-venmo-url={payUrl(customCents)}
						data-amount-cents={customCents}
						onclick={(event) => onTap(event, customCents!)}
					>
						Tip {dollarsLabel(customCents)} with Venmo
					</a>
				{:else}
					<button
						type="button"
						class="venmo-tip-go"
						data-venmo-url={payUrl(customCents)}
						data-amount-cents={customCents}
						onclick={(event) => onTap(event, customCents!)}
					>
						Tip {dollarsLabel(customCents)} with Venmo
					</button>
				{/if}
			</Cluster>

			{#if message}
				<p class="venmo-tip-message" role="status" data-testid="venmo-demo-message">{message}</p>
			{/if}
		</Stack>
	</Box>
{/if}
