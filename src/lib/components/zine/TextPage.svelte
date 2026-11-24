<script lang="ts">
	import type { PageContent, PageShell, PageSource } from './reader';

	/**
	 * A text page in the Stories reader (ADR 0011): a readable article page. The heading
	 * is in the Artist's type pairing; the body is in the reader's system font at
	 * --text-body, at most 65 characters a line, with room between lines. A long page
	 * scrolls inside the page; scrolling never pages the reader, and a tap still does.
	 */
	interface Props {
		shell: PageShell;
		content: PageContent;
		source: PageSource;
		artistName: string;
	}

	let { shell, content, source, artistName }: Props = $props();

	const titleId = $derived(`${shell.id}-title`);
</script>

<section id={shell.id} class="story-text" aria-labelledby={titleId}>
	<!-- A long page scrolls here; a keyboard can scroll it too. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="story-scroll" tabindex="0" role="region" aria-labelledby={titleId}>
		<article class="story-article">
			<h2 id={titleId} class="story-article-title" tabindex="-1">
				{content.title || (source === 'template' ? `About ${artistName}` : 'From the Road')}
			</h2>
			<p class="story-article-body">
				{content.body || 'Thank you for being here tonight with us in this room.'}
			</p>
		</article>
	</div>
</section>

<style>
	.story-text {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background-color: var(--bg-void);
		color: #ffffff;
	}

	/* Between the header and the bottom bar; scrolls inside the page when long. */
	.story-scroll {
		position: absolute;
		inset-inline: 0;
		inset-block: var(--story-top-space) var(--story-bottom-space);
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-block: var(--space-s);
		padding-inline: var(--space-m);
	}

	.story-scroll:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.story-article {
		display: flex;
		flex-direction: column;
		gap: var(--space-s);
		max-inline-size: 65ch;
		margin-inline: auto;
	}

	.story-article-title {
		margin: 0;
		font-family: var(--story-heading-font, inherit);
		font-size: var(--text-heading);
		font-weight: var(--weight-bold);
		line-height: var(--leading-heading);
		overflow-wrap: anywhere;
	}

	.story-article-title:focus {
		outline: none;
	}

	/* The body in the system font: the reader sets it, so nothing here overrides the family. */
	.story-article-body {
		margin: 0;
		font-size: var(--text-body);
		line-height: var(--leading-body);
		color: #ffffff;
		overflow-wrap: anywhere;
	}
</style>
