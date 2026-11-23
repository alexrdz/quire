<script lang="ts">
	import { Box, Cluster, Stack } from '$lib/components/layout';
	import { parseTipDollars } from '$domain/venmo';
	import { CUSTOM_HINT, CUSTOM_HINT_INVALID } from './tip-taps';
	import TipPresetButtons, { createTipTapper, dollarsLabel } from './TipPresetButtons.svelte';

	/**
	 * Venmo tip buttons (ADR 0008, PRODUCTION_PLAN V.4): the presets and a custom
	 * amount. What a tap does (a real venmo.com link in production, the Tip Tap
	 * beacon, the double-tap guard and the Demo message elsewhere) lives in
	 * TipPresetButtons' `createTipTapper`, shared with the Issue Cover's pills.
	 * The would-be Venmo URL is exposed as `data-venmo-url`.
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
		/**
		 * The Issue's tip sheet: a short title ("Tip The Band"), "with Venmo" in
		 * the line below, and the custom button saying what it needs while no
		 * amount is entered. Copy only; what a tap does is the same.
		 */
		compact?: boolean;
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
		compact = false,
		id = 'tip',
		class: className = ''
	}: Props = $props();

	let message = $state<string | null>(null);

	/** One tapper for the presets and the custom amount, so one double-tap guard covers both. */
	const tips = createTipTapper(() => ({
		artistSlug,
		artistName,
		venmoUsername,
		issueSlug,
		opensVenmo,
		onMessage: (text) => (message = text)
	}));
	const username = $derived(tips.username);

	// A type="number" input binds a number, or null when the field is empty or
	// not a number. parseTipDollars handles both and never throws.
	let customDollars = $state<number | null>(null);
	const customCents = $derived(parseTipDollars(customDollars));
	/** Something typed that isn't a usable amount: say why the button is off. */
	const customInvalid = $derived(customDollars !== null && customCents === null);

	function payUrl(cents: number): string {
		return tips.payUrl(cents);
	}

	function onTap(event: MouseEvent, cents: number): void {
		tips.onTap(event, cents);
	}
</script>

{#if username}
	<Box as="section" {id} padding="md" radius="lg" class="venmo-tip-panel {className}" aria-label="Tip {artistName} with Venmo">
		<Stack gap="sm">
			<Stack gap="3xs">
				{#if compact}
					<h2 class="venmo-tip-title">Tip {artistName}</h2>
					<p class="venmo-tip-hint">
						With Venmo: opens Venmo to pay <span class="font-mono">@{username}</span>. You confirm the payment in Venmo; Quire takes no cut.
					</p>
				{:else}
					<h2 class="venmo-tip-title">Tip {artistName} with Venmo</h2>
					<p class="venmo-tip-hint">
						Opens Venmo to pay <span class="font-mono">@{username}</span>. You confirm the payment in Venmo; Quire takes no cut.
					</p>
				{/if}
			</Stack>

			<TipPresetButtons
				{artistSlug}
				{artistName}
				{venmoUsername}
				{issueSlug}
				{presets}
				{opensVenmo}
				tapper={tips}
			/>

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
						step="0.01"
						placeholder="20"
						aria-describedby="{id}-custom-hint"
						aria-invalid={customInvalid}
						bind:value={customDollars}
					/>
					<p id="{id}-custom-hint" class="venmo-tip-hint" data-testid="venmo-custom-hint" aria-live="polite">
						{customInvalid ? CUSTOM_HINT_INVALID : CUSTOM_HINT}
					</p>
				</Stack>
				{#if customCents === null}
					<span class="venmo-tip-go" aria-disabled="true" data-testid="venmo-custom-disabled">
						{compact ? 'Enter an amount' : 'Tip with Venmo'}
					</span>
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
