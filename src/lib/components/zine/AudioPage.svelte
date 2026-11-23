<script lang="ts">
	import { initialsOf } from './story/context';
	import { resolveVideoEmbed, type PageContent, type PageShell } from './reader';

	/**
	 * An audio page in the Stories reader (ADR 0011): the cover art large and centred,
	 * the track title, and a clean player (a 56 px play button, a scrubber and the time),
	 * all keyboard-operable and labelled. A Bandcamp embed is centred instead of the
	 * player. Leaving the page pauses the track.
	 *
	 * A page with no audio file is the sample "demo preview": the same player, with a
	 * position that moves while it plays but no sound.
	 */
	interface Props {
		shell: PageShell;
		content: PageContent;
		/** Whether this is the page on screen, from the reader: leaving it pauses the track. */
		current?: boolean;
		/** The Artist's cover art, shown large; initials on the accent colour when there is none. */
		coverArtUrl?: string | null;
		artistName?: string;
	}

	let { shell, content, current = false, coverArtUrl = null, artistName = '' }: Props = $props();

	const heading = $derived(content.title || (content.audioUrl ? 'Audio Track' : 'Studio Session Bounce'));
	const titleId = $derived(`${shell.id}-title`);
	const embed = $derived(resolveVideoEmbed(content.audioUrl || content.embedUrl));
	const isBandcamp = $derived(embed.kind === 'bandcamp-embed');
	const isMock = $derived(!content.audioUrl);

	/** `03:42` or `3:42` as seconds; `fallback` when it doesn't parse. */
	function parseDuration(text: string | undefined, fallback: number): number {
		const match = /^(\d{1,3}):([0-5]\d)$/.exec(text?.trim() ?? '');
		return match ? Number(match[1]) * 60 + Number(match[2]) : fallback;
	}

	/** Seconds as `m:ss`. */
	function clock(seconds: number): string {
		const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}

	// The real track, through the browser's audio element (no native controls: the player below drives it).
	let audioEl = $state<HTMLAudioElement | null>(null);
	let paused = $state(true);
	let position = $state(0);
	let mediaDuration = $state(Number.NaN);

	// The demo preview: a position that moves while "playing".
	let mockPlaying = $state(false);

	const total = $derived(
		isMock
			? parseDuration(content.duration, 222)
			: Number.isFinite(mediaDuration) && mediaDuration > 0
				? mediaDuration
				: parseDuration(content.duration, 0)
	);
	const playing = $derived(isMock ? mockPlaying : !paused);
	const playedPercent = $derived(total > 0 ? Math.min(100, (position / total) * 100) : 0);

	$effect(() => {
		if (!isMock || !mockPlaying) return;
		const timer = setInterval(() => {
			if (position + 0.25 >= total) {
				position = 0;
				mockPlaying = false;
			} else {
				position += 0.25;
			}
		}, 250);
		return () => clearInterval(timer);
	});

	// Leaving the page pauses the track.
	$effect(() => {
		if (current) return;
		audioEl?.pause();
		mockPlaying = false;
	});

	function toggle() {
		if (isMock) {
			mockPlaying = !mockPlaying;
			return;
		}
		if (!audioEl) return;
		if (audioEl.paused) audioEl.play().catch(() => {});
		else audioEl.pause();
	}

	function seek(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		position = value;
		if (audioEl && !isMock) audioEl.currentTime = value;
	}
</script>

<section id={shell.id} class="story-audio" aria-labelledby={titleId}>
	<div class="story-audio-stage">
		{#if isBandcamp}
			<iframe
				src={embed.kind === 'bandcamp-embed' ? embed.embedSrc : undefined}
				title={content.title || 'Bandcamp player'}
				class="story-bandcamp"
				loading="lazy"
				seamless
			></iframe>
		{:else if coverArtUrl}
			<img class="story-audio-art" src={coverArtUrl} alt="Cover art for {artistName || heading}" />
		{:else}
			<div class="story-audio-art story-audio-initials" aria-hidden="true">{initialsOf(artistName || heading)}</div>
		{/if}

		<div class="story-audio-text">
			{#if isMock && !isBandcamp}
				<span class="story-audio-kind">Demo preview</span>
			{/if}
			<h2 id={titleId} class="story-audio-title" tabindex="-1">{heading}</h2>
			{#if artistName}
				<p class="story-audio-artist">{artistName}</p>
			{/if}
		</div>

		{#if !isBandcamp}
			{#if content.audioUrl}
				<audio
					bind:this={audioEl}
					bind:paused
					bind:currentTime={position}
					bind:duration={mediaDuration}
					src={content.audioUrl}
					preload="metadata"
				></audio>
			{/if}
			<div class="story-player">
				<button
					type="button"
					class="story-play"
					onclick={toggle}
					aria-label="{playing ? 'Pause' : 'Play'} {heading}"
				>
					{#if playing}
						<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
					{:else}
						<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
					{/if}
				</button>
				<div class="story-scrub">
					<input
						type="range"
						class="story-scrubber"
						min="0"
						max={Math.max(1, Math.floor(total))}
						step="1"
						value={Math.floor(position)}
						oninput={seek}
						aria-label="Seek in {heading}"
						aria-valuetext="{clock(position)} of {clock(total)}"
						style="--played: {playedPercent}%;"
					/>
					<div class="story-time" aria-hidden="true">
						<span>{clock(position)}</span>
						<span>{clock(total)}</span>
					</div>
				</div>
			</div>
		{/if}

		{#if content.body}
			<p class="story-audio-body">{content.body}</p>
		{/if}
	</div>
</section>

<style>
	.story-audio {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: var(--bg-void);
		color: #ffffff;
	}

	/* Everything centred between the header and the bottom bar; long words scroll inside. */
	.story-audio-stage {
		position: absolute;
		inset-inline: 0;
		inset-block: var(--story-top-space) var(--story-bottom-space);
		display: flex;
		flex-direction: column;
		justify-content: safe center;
		align-items: center;
		gap: var(--space-s);
		overflow-y: auto;
		padding-inline: var(--space-m);
	}

	.story-audio-art {
		inline-size: min(100%, 20rem, 42dvh);
		aspect-ratio: 1;
		flex-shrink: 0;
		border-radius: 12px;
		object-fit: cover;
		background-color: var(--bg-surface);
	}

	.story-audio-initials {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--accent);
		color: var(--on-accent);
		font-size: var(--text-display, var(--text-title));
		font-weight: var(--weight-heavy);
	}

	.story-bandcamp {
		inline-size: 100%;
		max-inline-size: 22rem;
		block-size: 30rem;
		max-block-size: 100%;
		flex-shrink: 0;
		border: 0;
		border-radius: 12px;
	}

	.story-audio-text {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3xs);
		inline-size: 100%;
		text-align: center;
	}

	.story-audio-kind {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.78);
	}

	.story-audio-title {
		margin: 0;
		font-family: var(--story-heading-font, inherit);
		font-size: var(--text-heading-sm);
		font-weight: var(--weight-bold);
		line-height: var(--leading-heading);
		overflow-wrap: anywhere;
	}

	.story-audio-title:focus {
		outline: none;
	}

	.story-audio-artist {
		margin: 0;
		font-size: var(--text-small);
		color: rgba(255, 255, 255, 0.78);
	}

	/* The player: a 56 px play button beside the scrubber and the time. */
	.story-player {
		display: flex;
		align-items: center;
		gap: var(--space-s);
		inline-size: 100%;
		max-inline-size: 24rem;
	}

	.story-play {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		inline-size: 56px;
		block-size: 56px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background-color: var(--accent);
		color: var(--on-accent);
		cursor: pointer;
	}

	.story-play svg {
		inline-size: 1.625rem;
		block-size: 1.625rem;
		fill: currentColor;
	}

	.story-play:focus-visible {
		outline: 2px solid #ffffff;
		outline-offset: 3px;
	}

	.story-scrub {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		flex: 1;
		min-inline-size: 0;
	}

	/* A plain range input, so arrows, Home and End work; the played part is in the accent colour.
	   Its box is 44 px tall for the finger, the track itself thin. */
	.story-scrubber {
		inline-size: 100%;
		block-size: 44px;
		margin: 0;
		background: transparent;
		appearance: none;
		cursor: pointer;
	}

	/* The track box is as tall as the thumb, so the thumb centres itself; the 4 px line is
	   drawn through its middle. */
	.story-scrubber::-webkit-slider-runnable-track {
		block-size: 16px;
		background: linear-gradient(
				to right,
				var(--accent) var(--played, 0%),
				rgba(255, 255, 255, 0.28) var(--played, 0%)
			)
			center / 100% 4px no-repeat;
	}

	.story-scrubber::-moz-range-track {
		block-size: 4px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.28);
	}

	.story-scrubber::-moz-range-progress {
		block-size: 4px;
		border-radius: 999px;
		background: var(--accent);
	}

	.story-scrubber::-webkit-slider-thumb {
		appearance: none;
		inline-size: 16px;
		block-size: 16px;
		border-radius: 999px;
		background: #ffffff;
	}

	.story-scrubber::-moz-range-thumb {
		inline-size: 16px;
		block-size: 16px;
		border: none;
		border-radius: 999px;
		background: #ffffff;
	}

	.story-scrubber:focus-visible {
		outline: 2px solid #ffffff;
		outline-offset: 2px;
		border-radius: 4px;
	}

	.story-time {
		display: flex;
		justify-content: space-between;
		font-size: var(--text-meta);
		font-variant-numeric: tabular-nums;
		color: rgba(255, 255, 255, 0.78);
	}

	.story-audio-body {
		margin: 0;
		inline-size: 100%;
		max-inline-size: 60ch;
		font-size: var(--text-body);
		line-height: var(--leading-body);
		color: #ffffff;
		overflow-wrap: anywhere;
	}
</style>
