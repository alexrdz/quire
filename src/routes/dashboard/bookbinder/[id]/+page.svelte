<script lang="ts">
	import { enhance } from '$app/forms';
	import { Box, Stack, Cluster, Split } from '$lib/components/layout';

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
	<div class="editor-pane">
		<Stack gap="lg">
			<header class="cover-header">
				<a href="/dashboard" class="glass-pill text-highlight link-clean">← Dashboard</a>
				<Cluster align="center" gap="xs">
					<span class="glass-pill tag-highlight">Desktop Bookbinder</span>
					<a href="/i/{data.issue.slug}" target="_blank" class="glass-pill link-clean">
						Open Tab ↗
					</a>
				</Cluster>
			</header>

			<Stack gap="xs">
				<h1 class="bookbinder-title">
					Designing: {data.issue.city}
				</h1>
				<p class="text-muted subtext-small">
					Changes to blocks update your mobile preview frame on the right in real time.
				</p>
			</Stack>

			<!-- Main Issue Details -->
			<Box variant="raised" padding="md" radius="md">
				<Stack gap="md">
					<h2 class="card-title">Cover Block</h2>

					<form method="POST" action="?/save" use:enhance={() => () => refreshPreview()}>
						<Stack gap="sm">
							<Split ratio="1-1" gap="md" collapse="sm">
								<Stack gap="xs">
									<label for="city" class="input-label-sm">City</label>
									<input
										id="city"
										type="text"
										name="city"
										value={data.issue.city}
										class="bookbinder-input"
									/>
								</Stack>

								<Stack gap="xs">
									<label for="venue" class="input-label-sm">Venue</label>
									<input
										id="venue"
										type="text"
										name="venue"
										value={data.issue.venue}
										class="bookbinder-input"
									/>
								</Stack>
							</Split>

							<Stack gap="xs">
								<label for="coverNote" class="input-label-sm">Cover Note</label>
								<textarea
									id="coverNote"
									name="coverNote"
									rows="2"
									class="bookbinder-input"
								>{data.issue.coverNote}</textarea>
							</Stack>

							<Cluster justify="between" align="center">
								<span class="text-muted status-text">Status: {data.issue.status}</span>
								<button type="submit" class="glass-pill tag-highlight save-btn">
									Save Cover
								</button>
							</Cluster>
						</Stack>
					</form>
				</Stack>
			</Box>

			<!-- Bespoke Pages Stack -->
			<Stack gap="md">
				<Cluster justify="between" align="center">
					<h2 class="card-title">
						Bespoke Pages ({data.pages.length})
					</h2>
					<span class="glass-pill">Zine Sequence</span>
				</Cluster>

				{#each data.pages as page, idx}
					<Box variant="raised" padding="md" radius="md">
						<Stack gap="sm">
							<Cluster justify="between" align="center">
								<span class="glass-pill tag-accent">Page {idx + 2}: {page.kind.toUpperCase()}</span>
								<form method="POST" action="?/deletePage" use:enhance={() => () => refreshPreview()}>
									<input type="hidden" name="pageId" value={page.id} />
									<button type="submit" class="glass-pill text-muted delete-page-btn">
										✕ Remove
									</button>
								</form>
							</Cluster>

							<p class="text-muted subtext-small">
								{page.contentJson}
							</p>
						</Stack>
					</Box>
				{/each}

				<!-- Add Bespoke Page Form -->
				<Box variant="raised" padding="md" radius="md">
					<Stack gap="sm">
						<h3 class="add-page-title">+ Add Bespoke Page Block</h3>
						<form method="POST" action="?/addPage" use:enhance={() => () => refreshPreview()}>
							<Stack gap="sm">
								<Split ratio="1-3" gap="sm" collapse="sm">
									<select
										name="kind"
										class="select-kind-input"
									>
										<option value="text">Story / Note</option>
										<option value="setlist">Setlist</option>
										<option value="photo">Photo Story</option>
									</select>

									<input
										type="text"
										name="body"
										placeholder="Page content or story..."
										class="bookbinder-input"
									/>
								</Split>

								<button type="submit" class="glass-pill tag-highlight btn-append">
									+ Append to Zine
								</button>
							</Stack>
						</form>
					</Stack>
				</Box>
			</Stack>
		</Stack>
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

<style>
	.link-clean {
		text-decoration: none;
	}

	.bookbinder-title {
		font-size: 2rem;
		font-weight: 800;
		color: #ffffff;
	}

	.subtext-small {
		font-size: 0.85rem;
	}

	.card-title {
		font-size: 1.2rem;
		font-weight: 700;
		color: #ffffff;
	}

	.input-label-sm {
		font-size: 0.75rem;
		color: var(--paper);
	}

	.bookbinder-input {
		inline-size: 100%;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		padding: 0.6rem;
	}

	.status-text {
		font-size: 0.75rem;
	}

	.save-btn {
		cursor: pointer;
		padding: 0.5rem 1rem;
	}

	.delete-page-btn {
		background: none;
		border: none;
		cursor: pointer;
	}

	.add-page-title {
		font-size: 1rem;
		font-weight: 600;
		color: #ffffff;
	}

	.select-kind-input {
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		color: #ffffff;
		padding: 0.5rem;
	}

	.btn-append {
		cursor: pointer;
		inline-size: fit-content;
	}
</style>
