<script lang="ts">
	import { Stack, Cluster, Frame } from '$lib/components/layout';
	import FeatureNotice from '$lib/components/site/FeatureNotice.svelte';
	import type { Mode } from '$lib/features';
	import { optimizeFileInputFilesOnChange } from '$lib/utils/image-optimize';
	import {
		MAX_PHOTOS_PER_PAGE,
		MAX_PHOTO_CAPTION_LENGTH,
		type PhotoEntry
	} from '$domain/photo-pile';

	interface Props {
		/** Used to build unique element ids when several photo pages are on screen. */
		pageId: string;
		/** Photos currently saved on the page. */
		initial: PhotoEntry[];
		/** False when uploads are switched off (ADR 0007); URL entry still works. */
		uploadsEnabled?: boolean;
		mode?: Mode;
	}

	let { pageId, initial, uploadsEnabled = true, mode }: Props = $props();

	interface EditableEntry {
		key: number;
		url: string;
		caption: string;
	}

	let nextKey = 0;
	let entries = $state<EditableEntry[]>(
		// The parent remounts this component whenever the saved page changes,
		// so reading `initial` once is intentional.
		// svelte-ignore state_referenced_locally
		initial.map((photo) => ({ key: nextKey++, url: photo.url, caption: photo.caption ?? '' }))
	);

	let remaining = $derived(MAX_PHOTOS_PER_PAGE - entries.length);

	function move(index: number, offset: -1 | 1): void {
		const target = index + offset;
		if (target < 0 || target >= entries.length) return;
		const next = [...entries];
		[next[index], next[target]] = [next[target], next[index]];
		entries = next;
	}

	function remove(index: number): void {
		entries = entries.filter((_, i) => i !== index);
	}
</script>

<Stack gap="sm" class="photo-editor">
	<Cluster justify="between" align="center" gap="xs">
		<span class="photo-editor-label">Photo Pile ({entries.length} of {MAX_PHOTOS_PER_PAGE})</span>
		<span class="photo-editor-hint">First photo is on top. Readers toss through the pile.</span>
	</Cluster>

	{#if entries.length > 0}
		<Stack as="ol" gap="xs" class="photo-editor-list">
			{#each entries as entry, i (entry.key)}
				<Cluster as="li" align="center" gap="xs" nowrap class="photo-editor-row">
					<input type="hidden" name="keepPhotoUrl" value={entry.url} />
					<Frame ratio="1-1" class="photo-editor-thumb">
						<img src={entry.url} alt="Photo {i + 1}" loading="lazy" />
					</Frame>
					<input
						type="text"
						name="keepPhotoCaption"
						bind:value={entry.caption}
						maxlength={MAX_PHOTO_CAPTION_LENGTH}
						placeholder="Caption for photo {i + 1} (shown on the back)"
						aria-label="Caption for photo {i + 1}"
						class="photo-editor-input photo-editor-caption"
					/>
					<Cluster gap="3xs" nowrap>
						<button
							type="button"
							class="photo-editor-btn"
							onclick={() => move(i, -1)}
							disabled={i === 0}
							aria-label="Move photo {i + 1} earlier"
						>
							Up
						</button>
						<button
							type="button"
							class="photo-editor-btn"
							onclick={() => move(i, 1)}
							disabled={i === entries.length - 1}
							aria-label="Move photo {i + 1} later"
						>
							Down
						</button>
						<button
							type="button"
							class="photo-editor-btn photo-editor-btn-danger"
							onclick={() => remove(i)}
							aria-label="Remove photo {i + 1}"
						>
							Remove
						</button>
					</Cluster>
				</Cluster>
			{/each}
		</Stack>
	{/if}

	{#if remaining > 0}
		<Stack gap="xs">
			<label for="photo-files-{pageId}" class="photo-editor-label">
				Add Photos (select several, up to {remaining} more)
			</label>
			<input
				id="photo-files-{pageId}"
				type="file"
				disabled={!uploadsEnabled}
				name="photoFile"
				multiple
				accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
				onchange={optimizeFileInputFilesOnChange}
				class="photo-editor-input"
			/>
			{#if !uploadsEnabled}
				<FeatureNotice feature="uploads" mode={mode} />
			{/if}
		</Stack>
		<Stack gap="xs">
			<label for="photo-url-{pageId}" class="photo-editor-label">Or Add One By URL</label>
			<input
				id="photo-url-{pageId}"
				type="text"
				name="imageUrl"
				placeholder="https://... or /uploads/..."
				class="photo-editor-input"
			/>
		</Stack>
	{:else}
		<p class="photo-editor-hint">
			This page holds the maximum of {MAX_PHOTOS_PER_PAGE} photos. Remove one to add another.
		</p>
	{/if}
</Stack>

<style>
	:global(.photo-editor-list) {
		list-style: none;
		padding: 0;
	}

	:global(.photo-editor-thumb) {
		flex: 0 0 3.5rem;
		inline-size: 3.5rem;
		border-radius: var(--radius-sm);
	}

	.photo-editor-label {
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		color: #d4d2df;
	}

	.photo-editor-hint {
		font-size: var(--text-small);
		color: var(--ink-muted);
	}

	.photo-editor-input {
		inline-size: 100%;
		padding-block: var(--space-xs);
		padding-inline: var(--space-xs);
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		font-size: var(--text-body);
		font-family: inherit;
	}

	.photo-editor-caption {
		flex: 1 1 8rem;
		min-inline-size: 0;
	}

	.photo-editor-btn {
		padding-block: var(--space-3xs);
		padding-inline: var(--space-xs);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.05);
		color: #e4e4e7;
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.photo-editor-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.1);
	}

	.photo-editor-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.photo-editor-btn-danger:hover:not(:disabled) {
		background: rgba(255, 42, 109, 0.2);
		color: #ffffff;
		border-color: rgba(255, 42, 109, 0.45);
	}
</style>
