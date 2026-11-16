<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let previewIframe = $state<HTMLIFrameElement | null>(null);

	function refreshPreview() {
		if (previewIframe) {
			previewIframe.src = previewIframe.src;
		}
	}
</script>

<svelte:head>
	<title>Bookbinder: {data.issue.city} — Split-Screen Editor | Quire</title>
</svelte:head>

<div class="bookbinder-workbench">
	<!-- LEFT PANE: MODULAR BLOCK BUILDER -->
	<div class="editor-pane" data-stack="lg">
		<header class="cover-header">
			<a href="/dashboard" class="glass-pill text-highlight" style="text-decoration: none;">← Dashboard</a>
			<div data-cluster>
				<span class="glass-pill tag-highlight">Desktop Bookbinder</span>
				<a href="/i/{data.issue.slug}" target="_blank" class="glass-pill" style="text-decoration: none;">
					Open Tab ↗
				</a>
			</div>
		</header>

		<div data-stack="xs">
			<h1 style="font-size: 2rem; font-weight: 800; color: #FFFFFF;">
				Designing: {data.issue.city}
			</h1>
			<p class="text-muted" style="font-size: 0.9rem;">
				Changes to blocks update your mobile preview frame on the right in real time.
			</p>
		</div>

		<!-- Main Issue Details -->
		<div class="glass-panel" style="padding: 1.5rem;" data-stack="md">
			<h2 style="font-size: 1.2rem; font-weight: 700; color: #FFFFFF;">Cover Block</h2>

			<form method="POST" action="?/save" use:enhance={() => () => refreshPreview()} data-stack="sm">
				<div data-split style="--split-ratio: 1fr 1fr;">
					<div data-stack="xs">
						<label for="city" style="font-size: 0.75rem; color: var(--paper);">City</label>
						<input
							id="city"
							type="text"
							name="city"
							value={data.issue.city}
							style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.6rem;"
						/>
					</div>

					<div data-stack="xs">
						<label for="venue" style="font-size: 0.75rem; color: var(--paper);">Venue</label>
						<input
							id="venue"
							type="text"
							name="venue"
							value={data.issue.venue}
							style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.6rem;"
						/>
					</div>
				</div>

				<div data-stack="xs">
					<label for="coverNote" style="font-size: 0.75rem; color: var(--paper);">Cover Note</label>
					<textarea
						id="coverNote"
						name="coverNote"
						rows="2"
						style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.6rem;"
					>{data.issue.coverNote}</textarea>
				</div>

				<div data-cluster="between">
					<span class="text-muted" style="font-size: 0.75rem;">Status: {data.issue.status}</span>
					<button type="submit" class="glass-pill tag-highlight" style="cursor: pointer; padding: 0.5rem 1rem;">
						Save Cover
					</button>
				</div>
			</form>
		</div>

		<!-- Bespoke Pages Stack -->
		<div data-stack="md">
			<div data-cluster="between">
				<h2 style="font-size: 1.2rem; font-weight: 700; color: #FFFFFF;">
					Bespoke Pages ({data.pages.length})
				</h2>
				<span class="glass-pill">Zine Sequence</span>
			</div>

			{#each data.pages as page, idx}
				<div class="glass-panel" style="padding: 1.25rem;" data-stack="sm">
					<div data-cluster="between">
						<span class="glass-pill tag-accent">Page {idx + 2}: {page.kind.toUpperCase()}</span>
						<form method="POST" action="?/deletePage" use:enhance={() => () => refreshPreview()}>
							<input type="hidden" name="pageId" value={page.id} />
							<button type="submit" class="glass-pill text-muted" style="background: none; border: none; cursor: pointer;">
								✕ Remove
							</button>
						</form>
					</div>

					<p class="text-muted" style="font-size: 0.85rem;">
						{page.contentJson}
					</p>
				</div>
			{/each}

			<!-- Add Bespoke Page Form -->
			<div class="glass-panel" style="padding: 1.25rem;" data-stack="sm">
				<h3 style="font-size: 1rem; font-weight: 600; color: #FFFFFF;">+ Add Bespoke Page Block</h3>
				<form method="POST" action="?/addPage" use:enhance={() => () => refreshPreview()} data-stack="sm">
					<div data-split style="--split-ratio: 140px 1fr;">
						<select
							name="kind"
							style="background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.5rem;"
						>
							<option value="text">Story / Note</option>
							<option value="setlist">Setlist</option>
							<option value="photo">Photo Story</option>
						</select>

						<input
							type="text"
							name="body"
							placeholder="Page content or story..."
							style="inline-size: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 8px; color: #FFFFFF; padding: 0.5rem;"
						/>
					</div>

					<button type="submit" class="glass-pill tag-highlight" style="cursor: pointer; inline-size: fit-content;">
						+ Append to Zine
					</button>
				</form>
			</div>
		</div>
	</div>

	<!-- RIGHT PANE: STICKY MOBILE DEVICE PREVIEW -->
	<div class="preview-pane">
		<div class="device-mockup">
			<iframe
				bind:this={previewIframe}
				src="/i/{data.issue.slug}"
				title="Mobile Zine Live Preview"
			></iframe>
		</div>
	</div>
</div>
