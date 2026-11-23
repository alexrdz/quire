<script module lang="ts">
	import { buildVenmoPayUrl, parseVenmoUsername, tipNote } from '$domain/venmo';
	import { demoVenmoMessage } from './tip-taps';

	/** Taps on the same amount within this window open Venmo once and count once. */
	const DOUBLE_TAP_MS = 2000;

	/**
	 * What every Venmo tip button does (ADR 0008, PRODUCTION_PLAN V.4), in one
	 * place for the preset pills and the custom amount:
	 *
	 * In production every amount is a real link to Venmo, so the Fan's own tap
	 * opens the Venmo app or site, with or without JavaScript. With JavaScript the
	 * tap is also reported to /api/tip-tap with a fire-and-forget beacon that never
	 * delays the link. In the Demo, development and tests (`opensVenmo` false) the
	 * buttons never navigate: the tap is recorded and a Demo message is shown. A
	 * second tap on the same amount within two seconds neither opens nor counts.
	 */
	export interface TipTapper {
		/** The Venmo username, or null when it is not a valid one (then no tip buttons show). */
		readonly username: string | null;
		payUrl(cents: number): string;
		onTap(event: MouseEvent, cents: number): void;
	}

	export interface TipTapperOptions {
		artistSlug: string;
		artistName: string;
		venmoUsername: string;
		/** Null for the General tip button on the Back Page. */
		issueSlug: string | null;
		opensVenmo: boolean;
		/** Shows the Demo message. */
		onMessage: (message: string) => void;
	}

	export function createTipTapper(options: () => TipTapperOptions): TipTapper {
		let lastTap: { cents: number; at: number } | null = null;

		const username = () => {
			const parsed = parseVenmoUsername(options().venmoUsername);
			return parsed.ok ? parsed.value : null;
		};

		/** Fire-and-forget. Never awaited, never blocks the link. */
		function reportTap(cents: number): void {
			const { artistSlug, issueSlug } = options();
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

		return {
			get username() {
				return username();
			},
			payUrl(cents: number): string {
				const name = username();
				return name ? buildVenmoPayUrl({ username: name, amountCents: cents, note: tipNote(options().artistName) }) : '';
			},
			onTap(event: MouseEvent, cents: number): void {
				const now = Date.now();
				if (lastTap && lastTap.cents === cents && now - lastTap.at < DOUBLE_TAP_MS) {
					// Second tap of a double tap: no second Venmo open, no second count.
					event.preventDefault();
					return;
				}
				lastTap = { cents, at: now };
				reportTap(cents);

				const { opensVenmo, venmoUsername, onMessage } = options();
				if (!opensVenmo) {
					event.preventDefault();
					onMessage(demoVenmoMessage(cents, username() ?? venmoUsername));
				}
			}
		};
	}

	export function dollarsLabel(cents: number): string {
		return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
	}
</script>

<script lang="ts">
	import { Cluster } from '$lib/components/layout';
	import { MAX_TIP_CENTS, MIN_TIP_CENTS } from '$domain/tipping';

	/**
	 * The preset tip amounts as Venmo buttons: in the tip panel, and as pills on
	 * the Issue Cover (decision 4: one tap from the Cover to Venmo). Hidden when
	 * the Artist has no valid Venmo username.
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
		/** The panel shares its tapper, so one double-tap guard covers the presets and the custom amount. */
		tapper?: TipTapper;
		/** Extra class on each button, for where it sits (the Cover's pills). */
		buttonClass?: string;
		/** Extra class on the group. */
		class?: string;
		/** The group's accessible name, when it stands alone. */
		label?: string;
	}

	let {
		artistSlug,
		artistName,
		venmoUsername,
		issueSlug = null,
		presets = [3, 5, 10],
		opensVenmo,
		tapper,
		buttonClass = '',
		class: className = '',
		label
	}: Props = $props();

	/** The Demo message, shown here when this group stands alone (the panel shows its own). */
	let message = $state<string | null>(null);

	const ownTapper = createTipTapper(() => ({
		artistSlug,
		artistName,
		venmoUsername,
		issueSlug,
		opensVenmo,
		onMessage: (text) => (message = text)
	}));
	const tips = $derived(tapper ?? ownTapper);

	const presetCents = $derived(
		presets
			.map((dollars) => Math.round(dollars * 100))
			.filter((cents) => cents >= MIN_TIP_CENTS && cents <= MAX_TIP_CENTS)
	);
	const presetClass = $derived(buttonClass ? `venmo-tip-preset ${buttonClass}` : 'venmo-tip-preset');
</script>

{#if tips.username}
	<Cluster distributeEqually gap="xs" class="venmo-tip-presets {className}" role={label ? 'group' : undefined} aria-label={label}>
		{#each presetCents as cents (cents)}
			{#if opensVenmo}
				<a
					class={presetClass}
					href={tips.payUrl(cents)}
					data-venmo-url={tips.payUrl(cents)}
					data-amount-cents={cents}
					onclick={(event) => tips.onTap(event, cents)}
				>
					{dollarsLabel(cents)}
				</a>
			{:else}
				<button
					type="button"
					class={presetClass}
					data-venmo-url={tips.payUrl(cents)}
					data-amount-cents={cents}
					onclick={(event) => tips.onTap(event, cents)}
				>
					{dollarsLabel(cents)}
				</button>
			{/if}
		{/each}
	</Cluster>
	{#if !tapper && message}
		<p class="venmo-tip-message" role="status" data-testid="venmo-demo-message">{message}</p>
	{/if}
{/if}
