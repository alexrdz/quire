<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount, tick, untrack } from 'svelte';
	import { replaceState } from '$app/navigation';
	import {
		buildSegments,
		classifyGesture,
		clampSegment,
		firstSegmentOfPage,
		keyDirection,
		pageAnnouncement,
		parseStoryHash,
		progressStates,
		segmentHash,
		stepSegment,
		formatIssueDate,
		type StoryDirection,
		type StoryPageInfo
	} from '$domain/story';
	import StoryHeader from './StoryHeader.svelte';
	import StoryBottomBar from './StoryBottomBar.svelte';
	import TipSheet from './TipSheet.svelte';
	import WallSheet from './WallSheet.svelte';
	import { headingFontFor, setStoryNav, textOn } from './context';

	/**
	 * The Stories reader (ADR 0011): one full-screen page at a time.
	 *
	 * Paging moves by segment (a photo page has one per photo). A tap on the
	 * right two-thirds goes forward and on the left third back; a horizontal
	 * swipe and the arrow keys do the same. Taps that start on a control, the
	 * bars or a sheet, and drags, never page. Nothing advances on a timer.
	 * Real Prev and Next buttons page for keyboard and screen-reader users; each
	 * page change is announced and moves focus to the page heading. The place is
	 * kept in the URL hash with replaceState, so Back still leaves the Issue.
	 */
	interface Props {
		pages: StoryPageInfo[];
		artist: {
			slug: string;
			displayName: string;
			coverArtUrl?: string | null;
			accentColor?: string | null;
			typePairing?: string | null;
			venmoUsername?: string | null;
		};
		issue: { slug: string; city: string; date: string; timezone?: string | null };
		noteCount: number;
		/** Venmo tips are on (the Artist has a username and has not left). */
		showTips: boolean;
		tipPresets: number[];
		tipsOpenVenmo: boolean;
		/** Renders page `index`, showing segment `part` of it; `active` while it is the page on screen. */
		page: Snippet<[index: number, part: number, active: boolean]>;
		/** Rendered after the reader, outside the paging area (the sign-in drawer). */
		children?: Snippet;
	}

	let { pages, artist, issue, noteCount, showTips, tipPresets, tipsOpenVenmo, page, children }: Props = $props();

	const segments = $derived(buildSegments(pages));
	let current = $state(0);
	const segment = $derived(segments[clampSegment(current, segments.length)] ?? { page: 0, part: 0 });
	const progress = $derived(progressStates(segments.length, current));
	const atStart = $derived(current <= 0);
	const atEnd = $derived(current >= segments.length - 1);

	let announcement = $state('');
	let tipOpen = $state(false);
	let wallOpen = $state(false);
	/** Off until the first page is placed, so opening at a hash never animates. */
	let ready = $state(false);

	let column: HTMLElement | undefined = $state();

	const accent = $derived(artist.accentColor || '#05D9E8');
	const readerStyle = $derived(
		`--accent: ${accent}; --on-accent: ${textOn(accent)}; --story-heading-font: ${headingFontFor(artist.typePairing)};`
	);

	/** The page the reader shows for page index `index`: before, current or after it. */
	function placeOf(index: number): 'before' | 'current' | 'after' {
		return index < segment.page ? 'before' : index === segment.page ? 'current' : 'after';
	}

	function writeHash() {
		const hash = segmentHash(pages, segments[current]);
		if (!hash || location.hash === hash) return;
		try {
			replaceState(hash, {});
		} catch {
			history.replaceState(history.state, '', hash);
		}
	}

	/** Moves to segment `index`. From a Fan's action it announces the page and focuses its heading. */
	async function go(index: number, options: { focus?: boolean } = {}) {
		const next = clampSegment(index, segments.length);
		const changedPage = segments[next]?.page !== segment.page;
		if (next === current) return;
		current = next;
		writeHash();
		announcement = pageAnnouncement(pages, segments, current);
		if (options.focus === false || !changedPage) return;
		await tick();
		focusHeading();
	}

	function step(direction: StoryDirection) {
		void go(stepSegment(current, segments.length, direction));
	}

	/** Focus the current page's heading, so a screen reader starts reading the new page there. */
	function focusHeading() {
		const pageEl = column?.querySelector<HTMLElement>('.story-page[data-place="current"]');
		const heading = pageEl?.querySelector<HTMLElement>('h1, h2') ?? pageEl;
		if (!heading) return;
		if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
		heading.focus({ preventScroll: true });
	}

	setStoryNav({
		next: () => step('forward'),
		back: () => step('back'),
		goToPage(id) {
			const index = pages.findIndex((p) => p.id === id);
			if (index !== -1) void go(firstSegmentOfPage(segments, index));
		},
		openTip: () => {
			if (showTips) tipOpen = true;
		},
		openWall: () => (wallOpen = true)
	});

	/* --- Taps and swipes ------------------------------------------------- */

	/** Where a tap must never page from: controls, media, the bars and anything marked as a control. */
	const CONTROL_SELECTOR = [
		'a[href]',
		'button',
		'input',
		'select',
		'textarea',
		'label',
		'summary',
		'video',
		'audio',
		'iframe',
		'[contenteditable]',
		'[role="button"]',
		'[role="slider"]',
		'[role="dialog"]',
		'dialog',
		'.story-bar',
		'[data-story-control]'
	].join(', ');

	let pointer: { id: number; x: number; y: number; at: number; onControl: boolean } | null = null;

	function onPointerDown(event: PointerEvent) {
		if (!event.isPrimary || event.button !== 0) return;
		const target = event.target instanceof Element ? event.target : null;
		pointer = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			at: event.timeStamp,
			onControl: Boolean(target?.closest(CONTROL_SELECTOR))
		};
	}

	function onPointerUp(event: PointerEvent) {
		if (!pointer || event.pointerId !== pointer.id || !column) return;
		const start = pointer;
		pointer = null;
		if (tipOpen || wallOpen) return;
		const rect = column.getBoundingClientRect();
		const selection = typeof window !== 'undefined' ? window.getSelection()?.toString() ?? '' : '';
		const direction = classifyGesture({
			startX: start.x,
			startY: start.y,
			endX: event.clientX,
			endY: event.clientY,
			durationMs: event.timeStamp - start.at,
			left: rect.left,
			width: rect.width,
			startedOnControl: start.onControl,
			hasSelection: selection.length > 0
		});
		if (direction) step(direction);
	}

	function onPointerCancel() {
		pointer = null;
	}

	/* --- Keys -------------------------------------------------------------- */

	function onKeydown(event: KeyboardEvent) {
		if (tipOpen || wallOpen || event.defaultPrevented) return;
		const target = event.target instanceof Element ? event.target : null;
		const direction = keyDirection({
			key: event.key,
			altKey: event.altKey,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			shiftKey: event.shiftKey,
			inEditable: Boolean(
				target?.closest('input, select, textarea, video, audio, [contenteditable], [role="slider"], dialog')
			)
		});
		if (!direction) return;
		event.preventDefault();
		step(direction);
	}

	/* --- The URL hash ---------------------------------------------------- */

	function readHash(focus: boolean) {
		const index = parseStoryHash(location.hash, pages, segments);
		if (index !== null && index !== current) void go(index, { focus });
	}

	onMount(() => {
		const index = parseStoryHash(location.hash, pages, segments);
		if (index !== null) {
			current = index;
			announcement = pageAnnouncement(pages, segments, current);
		}
		// Let the first page paint in place, then turn transitions on.
		requestAnimationFrame(() => requestAnimationFrame(() => (ready = true)));
		const onHashChange = () => readHash(true);
		window.addEventListener('hashchange', onHashChange);
		return () => window.removeEventListener('hashchange', onHashChange);
	});

	// A page list that shrinks (an edited Issue) never leaves the reader past its end.
	$effect(() => {
		const total = segments.length;
		untrack(() => {
			if (current > total - 1) current = clampSegment(current, total);
		});
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div class="story-reader" class:is-ready={ready} style={readerStyle}>
	<button
		type="button"
		class="story-side story-side-prev"
		onclick={() => step('back')}
		disabled={atStart}
		aria-label="Previous page"
	>
		<svg viewBox="0 0 24 24" aria-hidden="true" class="story-side-icon"><path d="M15 5l-7 7 7 7" /></svg>
	</button>

	<div
		class="story-column"
		bind:this={column}
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
		onpointercancel={onPointerCancel}
		role="region"
		aria-roledescription="story"
		aria-label="{artist.displayName}, {issue.city}"
	>
		<StoryHeader
			{progress}
			artistName={artist.displayName}
			artistSlug={artist.slug}
			avatarUrl={artist.coverArtUrl}
			city={issue.city}
			date={formatIssueDate(issue.date, issue.timezone, 'short')}
		/>

		<div class="story-pages">
			{#each pages as info, index (info.id)}
				{@const place = placeOf(index)}
				<div class="story-page" data-place={place} data-page-id={info.id} inert={place !== 'current'}>
					{@render page(index, place === 'current' ? segment.part : 0, place === 'current')}
				</div>
			{/each}
		</div>

		{#if segment.page !== 0}
			<StoryBottomBar
				showTip={showTips}
				{noteCount}
				hasNext={!atEnd}
				artistName={artist.displayName}
				onTip={() => (tipOpen = true)}
				onWall={() => (wallOpen = true)}
				onNext={() => step('forward')}
			/>
		{/if}
	</div>

	<button
		type="button"
		class="story-side story-side-next"
		onclick={() => step('forward')}
		disabled={atEnd}
		aria-label="Next page"
	>
		<svg viewBox="0 0 24 24" aria-hidden="true" class="story-side-icon"><path d="M9 5l7 7-7 7" /></svg>
	</button>

	<p class="visually-hidden" aria-live="polite" aria-atomic="true" data-testid="story-announcement">{announcement}</p>

	{#if showTips && artist.venmoUsername}
		<TipSheet
			open={tipOpen}
			onclose={() => (tipOpen = false)}
			artistSlug={artist.slug}
			artistName={artist.displayName}
			venmoUsername={artist.venmoUsername}
			issueSlug={issue.slug}
			presets={tipPresets}
			opensVenmo={tipsOpenVenmo}
		/>
	{/if}
	<WallSheet open={wallOpen} onclose={() => (wallOpen = false)} {noteCount} />

	{@render children?.()}
</div>

<style>
	/* One UI typeface, the system's (ADR 0011). Space the header and bottom bar take over a page. */
	.story-reader {
		--story-font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
			sans-serif;
		--story-top-space: calc(var(--control-size) + var(--space-m) + env(safe-area-inset-top));
		--story-bottom-space: calc(var(--control-size) + var(--space-l) + env(safe-area-inset-bottom));
		/* In the page flow, so the Demo banner above it is never covered. */
		position: relative;
		inline-size: 100%;
		block-size: 100dvh;
		display: grid;
		grid-template-columns: 1fr minmax(0, 480px) 1fr;
		grid-template-rows: minmax(0, 1fr);
		align-items: center;
		background: var(--bg-void);
		color: #ffffff;
		font-family: var(--story-font);
		/* clip, not hidden: a hidden box can still be scrolled sideways by focus or script. */
		overflow: clip;
	}

	.story-column {
		grid-column: 2;
		position: relative;
		inline-size: 100%;
		block-size: 100%;
		overflow: clip;
		background: #000000;
		/* Vertical scrolling inside a page stays with the browser; horizontal moves are swipes. */
		touch-action: pan-y;
		-webkit-tap-highlight-color: transparent;
		user-select: none;
	}

	.story-pages {
		position: absolute;
		inset: 0;
		overflow: clip;
	}

	.story-page {
		position: absolute;
		inset: 0;
		overflow: clip;
		visibility: hidden;
		opacity: 0;
	}

	.story-page[data-place='current'] {
		visibility: visible;
		opacity: 1;
		/* Text on a page can still be selected, and a selection never pages. */
		user-select: text;
	}

	.story-page[data-place='before'] {
		transform: translateX(-6%);
	}

	.story-page[data-place='after'] {
		transform: translateX(6%);
	}

	/* Headings take focus when a page opens (for screen readers); no ring for that. */
	.story-page :global([tabindex='-1']:focus) {
		outline: none;
	}

	/* A short slide and fade, at most 250 ms; instant with reduced motion. */
	@media (prefers-reduced-motion: no-preference) {
		.story-reader.is-ready .story-page {
			transition:
				opacity 200ms ease,
				transform 200ms ease,
				visibility 0s linear 200ms;
		}

		.story-reader.is-ready .story-page[data-place='current'] {
			transition:
				opacity 200ms ease,
				transform 200ms ease,
				visibility 0s;
		}
	}

	/* Prev and Next beside the column on a wide screen. On a phone, Prev shows
	   only while it has focus (keyboard users), and Next is in the bottom bar. */
	.story-side {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: var(--space-xl);
		block-size: var(--space-xl);
		border: 0;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
		cursor: pointer;
	}

	.story-side:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.story-side:focus-visible {
		outline: 2px solid #ffffff;
		outline-offset: 2px;
	}

	.story-side-prev {
		grid-column: 1;
		grid-row: 1;
		justify-self: end;
		margin-inline-end: var(--space-m);
	}

	.story-side-next {
		grid-column: 3;
		grid-row: 1;
		justify-self: start;
		margin-inline-start: var(--space-m);
	}

	.story-side-icon {
		inline-size: 1.5rem;
		block-size: 1.5rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.story-column {
		grid-row: 1;
	}

	@media (max-width: 40rem) {
		.story-reader {
			grid-template-columns: 0 minmax(0, 1fr) 0;
		}

		.story-side-next {
			display: none;
		}

		/* Hidden until a keyboard focuses it, then shown over the top of the page
		   (disabled on the Cover, so never a faint ghost there either). */
		.story-side-prev,
		.story-side-prev:disabled {
			position: fixed;
			z-index: 4;
			inset-block-start: var(--story-top-space);
			inset-inline-start: var(--space-xs);
			opacity: 0;
			pointer-events: none;
		}

		.story-side-prev:focus-visible {
			opacity: 1;
			pointer-events: auto;
		}
	}
</style>
