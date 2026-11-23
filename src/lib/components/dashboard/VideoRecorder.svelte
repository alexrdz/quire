<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Box, Stack, Cluster, Frame } from '$lib/components/layout';
	import FeatureNotice from '$lib/components/site/FeatureNotice.svelte';
	import type { Mode } from '$lib/features';

	interface Props {
		name?: string;
		orientationName?: string;
		maxDurationSeconds?: number;
		existingVideoUrl?: string;
		/** False when uploads are off (decision 30): every file input and camera control is disabled. */
		uploadsEnabled?: boolean;
		/** Picks the wording of the uploads-off notice. */
		mode?: Mode;
		onrecorded?: (blob: Blob, orientation: 'portrait' | 'landscape') => void;
		oncleared?: () => void;
	}

	let {
		name = 'videoFile',
		orientationName = 'videoOrientation',
		maxDurationSeconds = 60,
		existingVideoUrl = '',
		uploadsEnabled = true,
		mode,
		onrecorded,
		oncleared
	}: Props = $props();

	type RecorderPhase = 'idle' | 'viewfinder' | 'recording' | 'preview';

	let recorderPhase: RecorderPhase = $state('idle');
	let errorMessage = $state('');
	let facingMode: 'environment' | 'user' = $state('environment');
	let orientation: 'portrait' | 'landscape' = $state('portrait');
	let elapsedSeconds = $state(0);
	let previewUrl = $state('');
	let fallbackMode = $state(false);

	let viewfinderEl: HTMLVideoElement | null = $state(null);
	let previewVideoEl: HTMLVideoElement | null = $state(null);
	let fileInputEl: HTMLInputElement | null = $state(null);

	$effect(() => {
		if (existingVideoUrl && !previewUrl) {
			previewUrl = existingVideoUrl;
			recorderPhase = 'preview';
		}
	});

	let mediaStream: MediaStream | null = null;
	let mediaRecorder: MediaRecorder | null = null;
	let recordedChunks: Blob[] = [];
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let objectUrlToRevoke: string | null = null;

	const remainingSeconds = $derived(Math.max(0, maxDurationSeconds - elapsedSeconds));
	const progressPercent = $derived(
		Math.min(100, Math.round((elapsedSeconds / maxDurationSeconds) * 100))
	);

	function formatTime(totalSecs: number): string {
		const mins = Math.floor(totalSecs / 60);
		const secs = totalSecs % 60;
		return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
	}

	function getSupportedMimeType(): string {
		const types = [
			'video/webm;codecs=vp9,opus',
			'video/webm;codecs=vp8,opus',
			'video/webm',
			'video/mp4;codecs=avc1,mp4a.40.2',
			'video/mp4'
		];
		for (const type of types) {
			if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
				return type;
			}
		}
		return '';
	}

	function stopStream() {
		if (mediaStream) {
			mediaStream.getTracks().forEach((track) => track.stop());
			mediaStream = null;
		}
		if (viewfinderEl) {
			viewfinderEl.srcObject = null;
		}
	}

	function clearTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	async function startCamera() {
		errorMessage = '';
		stopStream();

		if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
			errorMessage = 'Camera recording is not supported in this browser. Please upload a file.';
			fallbackMode = true;
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode,
					width: { ideal: 1280 },
					height: { ideal: 720 }
				},
				audio: true
			});

			mediaStream = stream;
			recorderPhase = 'viewfinder';

			// Wait a tick for video element to be bound
			setTimeout(() => {
				if (viewfinderEl && mediaStream) {
					viewfinderEl.srcObject = mediaStream;
					viewfinderEl.play().catch(() => {});
				}
			}, 50);
		} catch (err: unknown) {
			const error = err as Error;
			if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
				errorMessage = 'Camera or microphone permission was denied. Please allow camera access or upload a file.';
			} else {
				errorMessage = 'Unable to access camera: ' + (error.message || 'unknown error');
			}
			fallbackMode = true;
		}
	}

	async function switchCamera() {
		facingMode = facingMode === 'environment' ? 'user' : 'environment';
		if (recorderPhase === 'viewfinder') {
			await startCamera();
		}
	}

	function startRecording() {
		if (!mediaStream) return;
		errorMessage = '';
		recordedChunks = [];
		elapsedSeconds = 0;

		const mimeType = getSupportedMimeType();
		try {
			mediaRecorder = mimeType
				? new MediaRecorder(mediaStream, { mimeType })
				: new MediaRecorder(mediaStream);
		} catch {
			mediaRecorder = new MediaRecorder(mediaStream);
		}

		mediaRecorder.ondataavailable = (event: BlobEvent) => {
			if (event.data && event.data.size > 0) {
				recordedChunks.push(event.data);
			}
		};

		mediaRecorder.onstop = () => {
			finalizeRecording();
		};

		mediaRecorder.start(250);
		recorderPhase = 'recording';

		timerInterval = setInterval(() => {
			elapsedSeconds += 1;
			if (elapsedSeconds >= maxDurationSeconds) {
				stopRecording();
			}
		}, 1000);
	}

	function stopRecording() {
		clearTimer();
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
		}
	}

	function finalizeRecording() {
		stopStream();
		clearTimer();

		const selectedMime = mediaRecorder?.mimeType || 'video/webm';
		const blob = new Blob(recordedChunks, { type: selectedMime });

		if (objectUrlToRevoke) {
			URL.revokeObjectURL(objectUrlToRevoke);
		}
		const url = URL.createObjectURL(blob);
		objectUrlToRevoke = url;
		previewUrl = url;

		const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
		const file = new File([blob], `zine-clip-${Date.now()}.${ext}`, { type: selectedMime });

		if (fileInputEl && typeof DataTransfer !== 'undefined') {
			const dt = new DataTransfer();
			dt.items.add(file);
			fileInputEl.files = dt.files;
		}

		recorderPhase = 'preview';
	}

	function handlePreviewMetadata() {
		if (previewVideoEl) {
			const w = previewVideoEl.videoWidth;
			const h = previewVideoEl.videoHeight;
			if (w > 0 && h > 0) {
				orientation = h > w ? 'portrait' : 'landscape';
			}
		}
		if (recordedChunks.length > 0 && onrecorded) {
			const mime = mediaRecorder?.mimeType || 'video/webm';
			onrecorded(new Blob(recordedChunks, { type: mime }), orientation);
		}
	}

	function retake() {
		clearTimer();
		stopStream();
		if (objectUrlToRevoke) {
			URL.revokeObjectURL(objectUrlToRevoke);
			objectUrlToRevoke = null;
		}
		previewUrl = '';
		recordedChunks = [];
		elapsedSeconds = 0;
		if (fileInputEl) {
			fileInputEl.value = '';
		}
		if (oncleared) {
			oncleared();
		}
		startCamera();
	}

	function resetToIdle() {
		clearTimer();
		stopStream();
		if (objectUrlToRevoke) {
			URL.revokeObjectURL(objectUrlToRevoke);
			objectUrlToRevoke = null;
		}
		previewUrl = '';
		recordedChunks = [];
		elapsedSeconds = 0;
		if (fileInputEl) {
			fileInputEl.value = '';
		}
		recorderPhase = 'idle';
		fallbackMode = false;
		if (oncleared) {
			oncleared();
		}
	}

	function handleFileSelected(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		stopStream();
		clearTimer();

		if (objectUrlToRevoke) {
			URL.revokeObjectURL(objectUrlToRevoke);
		}
		const url = URL.createObjectURL(file);
		objectUrlToRevoke = url;
		previewUrl = url;
		// The picker has no name, so the form never sends it. The chosen file goes on the
		// one named input, exactly as a recording does; the preview's metadata sets the orientation.
		recordedChunks = [];
		if (fileInputEl && typeof DataTransfer !== 'undefined') {
			const dt = new DataTransfer();
			dt.items.add(file);
			fileInputEl.files = dt.files;
		}
		recorderPhase = 'preview';
	}

	onDestroy(() => {
		clearTimer();
		stopStream();
		if (objectUrlToRevoke) {
			URL.revokeObjectURL(objectUrlToRevoke);
		}
	});
</script>

<div class="video-recorder-root">
	<!-- Hidden Inputs to deliver values through regular HTML Form Post -->
	<input
		bind:this={fileInputEl}
		type="file"
		{name}
		accept="video/mp4,video/webm,video/quicktime,video/*"
		class="hidden-file-input"
		tabindex="-1"
		aria-hidden="true"
		disabled={!uploadsEnabled}
	/>
	<input type="hidden" name={orientationName} value={orientation} />

	{#if errorMessage}
		<Box variant="subtle" padding="sm" radius="md" class="recorder-error-box">
			<span class="error-text">{errorMessage}</span>
		</Box>
	{/if}

	{#if !uploadsEnabled}
		<FeatureNotice feature="uploads" {mode} />
	{/if}

	{#if recorderPhase === 'idle'}
		<Box as="section" variant="subtle" padding="md" radius="md" class="recorder-frame-box">
			<Stack gap="md" align="center">
				<Stack gap="2xs" align="center">
					<span class="recorder-prompt-title">Live Video Note</span>
					<span class="recorder-prompt-subtext">Record up to 60 seconds directly from your camera</span>
				</Stack>
				<Cluster gap="sm" justify="center">
					<button type="button" class="btn-action-highlight" disabled={!uploadsEnabled} onclick={startCamera}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon" aria-hidden="true">
							<circle cx="12" cy="12" r="10" />
							<polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
						</svg>
						<span>Open Camera</span>
					</button>
					<button
						type="button"
						class="btn-action-accent"
						disabled={!uploadsEnabled}
						onclick={() => (fallbackMode = !fallbackMode)}
					>
						<span>{fallbackMode ? 'Hide File Upload' : 'Upload Video File'}</span>
					</button>
				</Cluster>

				{#if fallbackMode && uploadsEnabled}
					<Stack gap="xs" class="fallback-upload-pane">
						<label for="fallback-video-input" class="input-label-sm">Choose Video File (MP4, WebM, MOV)</label>
						<input
							id="fallback-video-input"
							type="file"
							accept="video/mp4,video/webm,video/quicktime,video/*"
							disabled={!uploadsEnabled}
							onchange={handleFileSelected}
							class="recorder-native-input"
						/>
					</Stack>
				{/if}
			</Stack>
		</Box>
	{:else if recorderPhase === 'viewfinder' || recorderPhase === 'recording'}
		<Box as="section" variant="raised" padding="sm" radius="md" class="recorder-active-box">
			<Stack gap="sm">
				<div class="viewfinder-container">
					<Frame ratio="16-9" class="viewfinder-frame">
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							bind:this={viewfinderEl}
							autoplay
							playsinline
							muted
							class="viewfinder-video"
						></video>
					</Frame>

					{#if recorderPhase === 'recording'}
						<div class="recording-badge-bar">
							<Cluster justify="between" align="center">
								<Cluster gap="2xs" align="center">
									<span class="recording-dot"></span>
									<span class="recording-status">REC</span>
								</Cluster>
								<span class="recording-timer font-mono">{formatTime(remainingSeconds)}</span>
							</Cluster>
							<div class="recording-progress-track">
								<div
									class="recording-progress-fill"
									style="inline-size: {progressPercent}%;"
								></div>
							</div>
						</div>
					{/if}
				</div>

				<Cluster justify="between" align="center" gap="sm">
					<button
						type="button"
						class="btn-action-accent"
						disabled={recorderPhase === 'recording'}
						onclick={switchCamera}
						aria-label="Flip camera front or back"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon" aria-hidden="true">
							<path d="M20 10c0-4.4-3.6-8-8-8s-8 3.6-8 8h3l-4 4-4-4h3c0-5.5 4.5-10 10-10s10 4.5 10 10z" />
							<path d="M4 14c0 4.4 3.6 8 8 8s8-3.6 8-8h-3l4-4 4 4h-3c0 5.5-4.5 10-10 10s-10-4.5-10-10z" />
						</svg>
						<span>Flip Camera</span>
					</button>

					{#if recorderPhase === 'viewfinder'}
						<button type="button" class="btn-record-trigger" onclick={startRecording}>
							<span class="record-symbol"></span>
							<span>Record (60s max)</span>
						</button>
					{:else}
						<button type="button" class="btn-stop-trigger" onclick={stopRecording}>
							<span class="stop-symbol"></span>
							<span>Stop Recording</span>
						</button>
					{/if}

					<button
						type="button"
						class="btn-action-subtle"
						disabled={recorderPhase === 'recording'}
						onclick={resetToIdle}
					>
						Cancel
					</button>
				</Cluster>
			</Stack>
		</Box>
	{:else if recorderPhase === 'preview'}
		<Box as="section" variant="raised" padding="sm" radius="md" class="recorder-preview-box">
			<Stack gap="sm">
				<Cluster justify="between" align="center">
					<Cluster gap="xs" align="center">
						<span class="meta-chip meta-highlight">Recorded Video Ready</span>
						<span class="meta-chip">{orientation === 'portrait' ? 'Vertical (9:16)' : 'Landscape (16:9)'}</span>
					</Cluster>
					<button type="button" class="btn-action-subtle" disabled={!uploadsEnabled} onclick={retake}>
						Retake / Record Again
					</button>
				</Cluster>

				<div class="preview-player-container">
					<Frame ratio={orientation === 'portrait' ? '9-16' : '16-9'} class="preview-player-frame {orientation === 'portrait' ? 'is-portrait' : ''}">
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							bind:this={previewVideoEl}
							src={previewUrl}
							controls
							playsinline
							onloadedmetadata={handlePreviewMetadata}
							class="preview-video"
						></video>
					</Frame>
				</div>
			</Stack>
		</Box>
	{/if}
</div>

<style>
	.video-recorder-root {
		inline-size: 100%;
		display: block;
	}

	.hidden-file-input {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		padding: 0;
		margin: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	:global(.recorder-frame-box) {
		border: 1px dashed var(--border-subtle, rgba(255, 255, 255, 0.15));
		background: rgba(9, 7, 16, 0.55);
	}

	:global(.recorder-active-box),
	:global(.recorder-preview-box) {
		border: 1px solid var(--accent, #05d9e8);
		background: #090710;
	}

	:global(.recorder-error-box) {
		border: 1px solid var(--color-error, #ff2a6d);
		background: rgba(255, 42, 109, 0.1);
		margin-block-end: var(--space-xs);
	}

	.error-text {
		color: var(--color-error, #ff2a6d);
		font-size: var(--text-small);
	}

	.recorder-prompt-title {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}

	.recorder-prompt-subtext {
		font-size: var(--text-small);
		color: var(--text-muted, #94a3b8);
	}

	:global(.fallback-upload-pane) {
		inline-size: 100%;
		max-inline-size: 380px;
		margin-block-start: var(--space-xs);
		padding-block: var(--space-xs);
		padding-inline: var(--space-xs);
		background: rgba(255, 255, 255, 0.03);
		border-radius: 6px;
	}

	.input-label-sm {
		font-size: var(--text-meta);
		color: var(--text-muted, #94a3b8);
		text-transform: uppercase;
		letter-spacing: var(--tracking-label);
	}

	.recorder-native-input {
		font-size: var(--text-small);
		color: #ffffff;
	}

	.viewfinder-container {
		position: relative;
		inline-size: 100%;
		border-radius: 8px;
		overflow: hidden;
		background: #000000;
	}

	:global(.viewfinder-frame) {
		background: #000000;
	}

	.viewfinder-video {
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
		display: block;
	}

	.recording-badge-bar {
		position: absolute;
		inset-inline: 0;
		inset-block-start: 0;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-sm);
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent);
		z-index: 2;
	}

	.recording-dot {
		inline-size: 10px;
		block-size: 10px;
		border-radius: 50%;
		background: #ff2a6d;
		box-shadow: 0 0 8px #ff2a6d;
		animation: pulse-dot 1s infinite alternate ease-in-out;
	}

	@keyframes pulse-dot {
		0% {
			opacity: 0.4;
		}
		100% {
			opacity: 1;
		}
	}

	.recording-status {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		color: #ffffff;
		letter-spacing: var(--tracking-wide);
	}

	.recording-timer {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}

	.recording-progress-track {
		inline-size: 100%;
		block-size: 3px;
		background: rgba(255, 255, 255, 0.2);
		margin-block-start: var(--space-2xs);
		border-radius: 2px;
		overflow: hidden;
	}

	.recording-progress-fill {
		block-size: 100%;
		background: #ff2a6d;
		transition: inline-size 0.25s linear;
	}

	.btn-record-trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding-block: var(--space-xs);
		padding-inline: var(--space-md);
		border-radius: 24px;
		background: #ff2a6d;
		color: #ffffff;
		border: none;
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(255, 42, 109, 0.4);
		transition: transform 0.15s ease, background-color 0.15s ease;
	}

	.btn-record-trigger:hover {
		background: #ff4785;
		transform: scale(1.02);
	}

	.record-symbol {
		inline-size: 12px;
		block-size: 12px;
		border-radius: 50%;
		background: #ffffff;
	}

	.btn-stop-trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding-block: var(--space-xs);
		padding-inline: var(--space-md);
		border-radius: 24px;
		background: #ffffff;
		color: #090710;
		border: none;
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
		transition: transform 0.15s ease;
	}

	.btn-stop-trigger:hover {
		transform: scale(1.02);
	}

	.stop-symbol {
		inline-size: 12px;
		block-size: 12px;
		border-radius: 2px;
		background: #ff2a6d;
	}

	.btn-action-subtle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		padding-block: var(--space-2xs);
		padding-inline: var(--space-xs);
		background: transparent;
		color: var(--text-muted, #94a3b8);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 6px;
		font-size: var(--text-small);
		cursor: pointer;
	}

	.btn-action-subtle:hover:not(:disabled) {
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.3);
	}

	/* The pages' button classes are scoped to the pages, so the recorder styles its own:
	   without these the idle buttons were browser-default light grey with light text. */
	.btn-action-highlight,
	.btn-action-accent {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2xs);
		min-block-size: 44px;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		border-radius: 8px;
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-action-highlight {
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
	}

	.btn-action-highlight:hover:not(:disabled) {
		background: rgba(1, 255, 195, 0.24);
	}

	.btn-action-accent {
		background: rgba(5, 217, 232, 0.12);
		color: var(--accent);
		border: 1px solid rgba(5, 217, 232, 0.35);
	}

	.btn-action-accent:hover:not(:disabled) {
		background: rgba(5, 217, 232, 0.22);
	}

	.btn-action-subtle:disabled,
	.video-recorder-root button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-icon {
		inline-size: 1rem;
		block-size: 1rem;
		display: block;
	}

	.preview-player-container {
		inline-size: 100%;
		background: #000000;
		border-radius: 8px;
		overflow: hidden;
	}

	:global(.preview-player-frame) {
		background: #000000;
	}

	:global(.preview-player-frame.is-portrait) {
		max-inline-size: 280px;
		margin-inline: auto;
	}

	.preview-video {
		inline-size: 100%;
		block-size: 100%;
		display: block;
	}
</style>
