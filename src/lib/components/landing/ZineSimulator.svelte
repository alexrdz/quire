<script lang="ts">
	// Interactive Zine Phone Simulator adapted from ui-prototype/index.html

	let activeTab = $state<'audio' | 'photo' | 'notes' | 'wall'>('audio');
	let isPlaying = $state(false);
	let playProgress = $state(38); // percentage
	let showTipDrawer = $state(false);
	let showCommentDrawer = $state(false);
	let tipAmount = $state(10);
	let customTip = $state('');
	let newCommentText = $state('');
	let toastMessage = $state<{ title: string; desc: string } | null>(null);
	let toastTimeout: ReturnType<typeof setTimeout> | null = null;

	// Guestbook comments state
	let comments = $state([
		{
			id: 1,
			author: 'johndoe_99',
			initials: 'JD',
			color: 'linear-gradient(135deg, #01FFC3, #05D9E8)',
			time: '2h ago',
			text: 'Saw you guys at Baby\'s All Right! That new track blew my mind. When is it dropping on streaming?',
			reply: {
				author: 'The Neon Velvet (Artist)',
				time: '1h ago',
				text: 'Thanks man! Aiming for late November. Still tweaking the fuzz on the bridge.'
			}
		},
		{
			id: 2,
			author: 'sarahj_music',
			initials: 'SJ',
			color: 'linear-gradient(135deg, #FF2A6D, #7928CA)',
			time: '4h ago',
			text: 'The merch line was insane but the tour zine QR was genius. Scanned it right from the drumhead!',
			reply: {
				author: 'The Neon Velvet (Artist)',
				time: '3h ago',
				text: 'So glad you got the digital stub! Keep that one in your wallet.'
			}
		},
		{
			id: 3,
			author: 'mike_keys',
			initials: 'MK',
			color: 'linear-gradient(135deg, #FF8800, #FF2A6D)',
			time: '6h ago',
			text: 'What synth did you use on the intro of Track 4? Sounds like a Prophet 6 through an analog delay.',
			reply: null
		}
	]);

	function triggerToast(title: string, desc: string) {
		if (toastTimeout) clearTimeout(toastTimeout);
		toastMessage = { title, desc };
		toastTimeout = setTimeout(() => {
			toastMessage = null;
		}, 3200);
	}

	function togglePlay() {
		isPlaying = !isPlaying;
		if (isPlaying) {
			triggerToast('Streaming Demo', 'Now playing: Studio Session 04 (Rough Bridge Mix)');
		}
	}

	function handlePresetTip(amount: number) {
		tipAmount = amount;
		customTip = '';
	}

	function handleCustomTipChange(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		customTip = val;
		const parsed = parseFloat(val);
		if (!isNaN(parsed) && parsed > 0) {
			tipAmount = parsed;
		}
	}

	function submitTip() {
		showTipDrawer = false;
		triggerToast('Tip Confirmed! 🎉', `Thank you for sending $${tipAmount} directly to The Neon Velvet!`);
	}

	function submitComment() {
		if (!newCommentText.trim()) return;
		comments.unshift({
			id: Date.now(),
			author: 'you (Fan)',
			initials: 'YOU',
			color: 'linear-gradient(135deg, #01FFC3, #FF2A6D)',
			time: 'Just now',
			text: newCommentText.trim(),
			reply: null
		});
		newCommentText = '';
		showCommentDrawer = false;
		triggerToast('Mark Left on Wall ✍️', 'Your note is live on the Brooklyn tour wall!');
		activeTab = 'wall';
	}
</script>

<div class="mockup-wrapper">
	<!-- Phone Container -->
	<div class="phone-frame">
		<!-- Phone Speaker Notch / Status bar -->
		<div class="phone-status-bar">
			<span class="status-time">9:41</span>
			<div class="dynamic-island">
				<div class="island-camera"></div>
			</div>
			<div class="status-signals">
				<span class="signal-dot">●●●</span>
				<span class="battery-icon">⚡ 98%</span>
			</div>
		</div>

		<!-- Top Header Bar -->
		<header class="zine-header">
			<div class="brand-wrap">
				<span class="brand-text">QUIRE.</span>
				<span class="live-indicator">
					<span class="pulse-dot"></span> LIVE ZINE
				</span>
			</div>
			<div class="header-actions">
				<a href="/login" class="login-chip">Artist Login</a>
			</div>
		</header>

		<!-- Subnav Tabs -->
		<nav class="zine-nav-tabs" aria-label="Zine Sections">
			<button
				type="button"
				class="nav-tab-btn"
				class:active={activeTab === 'audio'}
				onclick={() => (activeTab = 'audio')}
			>
				<span class="tab-icon">🎵</span> Track
			</button>
			<button
				type="button"
				class="nav-tab-btn"
				class:active={activeTab === 'photo'}
				onclick={() => (activeTab = 'photo')}
			>
				<span class="tab-icon">📸</span> Photo
			</button>
			<button
				type="button"
				class="nav-tab-btn"
				class:active={activeTab === 'notes'}
				onclick={() => (activeTab = 'notes')}
			>
				<span class="tab-icon">📝</span> Notes
			</button>
			<button
				type="button"
				class="nav-tab-btn"
				class:active={activeTab === 'wall'}
				onclick={() => (activeTab = 'wall')}
			>
				<span class="tab-icon">💬</span> Wall
			</button>
		</nav>

		<!-- Main Screen Body -->
		<main class="zine-screen-body">
			{#if activeTab === 'audio'}
				<!-- Card 1: Audio / Demo -->
				<div class="card-page audio-card">
					<div class="card-bg-image audio-card-bg">
						<div class="card-dark-scrim"></div>
					</div>

					<!-- Play / Pause Center Overlay -->
					<div class="media-center-action">
						<button
							type="button"
							class="play-circle-btn"
							class:playing={isPlaying}
							onclick={togglePlay}
							aria-label={isPlaying ? 'Pause audio demo' : 'Play audio demo'}
						>
							{#if isPlaying}
								<svg class="icon-svg" viewBox="0 0 24 24" fill="currentColor">
									<rect x="6" y="4" width="4" height="16" rx="2" />
									<rect x="14" y="4" width="4" height="16" rx="2" />
								</svg>
							{:else}
								<svg class="icon-svg" viewBox="0 0 24 24" fill="currentColor">
									<path d="M8 5v14l11-7z" />
								</svg>
							{/if}
						</button>
						<span class="play-hint-text">
							{isPlaying ? 'TAP TO PAUSE' : 'TAP TO LISTEN'}
						</span>
					</div>

					<!-- Bottom Meta & Controls -->
					<div class="card-bottom-content">
						<div class="meta-row">
							<span class="meta-tag mint">OCT 12</span>
							<span class="meta-tag muted">BROOKLYN, NY</span>
							<span class="time-stamp">{isPlaying ? '01:24' : '00:00'} / 03:42</span>
						</div>

						<h2 class="card-headline">Studio Session 04</h2>
						<p class="card-subtext">Rough mix of the new bridge from Greenpoint rehearsal. Needs more fuzz.</p>

						<!-- Animated Equalizer Waveform -->
						<div class="audio-waveform-row">
							<div class="waveform-bars" class:animating={isPlaying}>
								<span style="--h: 40%"></span>
								<span style="--h: 75%"></span>
								<span style="--h: 100%"></span>
								<span style="--h: 60%"></span>
								<span style="--h: 85%"></span>
								<span style="--h: 50%"></span>
								<span style="--h: 90%"></span>
								<span style="--h: 65%"></span>
								<span style="--h: 40%"></span>
								<span style="--h: 80%"></span>
								<span style="--h: 95%"></span>
								<span style="--h: 70%"></span>
								<span style="--h: 55%"></span>
								<span style="--h: 90%"></span>
								<span style="--h: 45%"></span>
								<span style="--h: 60%"></span>
							</div>
							<div class="track-progress-bar">
								<div class="track-progress-fill" style="width: {isPlaying ? playProgress : 15}%;"></div>
							</div>
						</div>

						<!-- Action Buttons -->
						<div class="action-grid">
							<button
								type="button"
								class="action-btn tip-btn"
								onclick={() => (showTipDrawer = true)}
							>
								<svg class="action-svg pink-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
								</svg>
								<span>1-Tap Tip</span>
							</button>

							<button
								type="button"
								class="action-btn comment-btn"
								onclick={() => (activeTab = 'wall')}
							>
								<svg class="action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
								</svg>
								<span>{comments.length} Notes</span>
							</button>
						</div>
					</div>
				</div>

			{:else if activeTab === 'photo'}
				<!-- Card 2: Tour Photo Diary -->
				<div class="card-page photo-card">
					<div class="card-bg-image photo-card-bg">
						<div class="card-dark-scrim"></div>
					</div>

					<div class="top-film-label">
						<span>35MM FILM STUB</span>
					</div>

					<div class="card-bottom-content">
						<div class="meta-row">
							<span class="meta-tag mint">OCT 10</span>
							<span class="meta-tag muted">CHICAGO</span>
							<span class="meta-tag cyan">SOLD OUT</span>
						</div>

						<h2 class="card-headline">Tour Diary: CHI</h2>
						<p class="card-subtext">Sold out the Metro. You animals. First night playing the unreleased second set.</p>

						<div class="action-grid">
							<button
								type="button"
								class="action-btn tip-btn"
								onclick={() => (showTipDrawer = true)}
							>
								<svg class="action-svg pink-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
								</svg>
								<span>Tip Artist</span>
							</button>

							<button
								type="button"
								class="action-btn comment-btn"
								onclick={() => (activeTab = 'wall')}
							>
								<svg class="action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
								</svg>
								<span>Leave Memory</span>
							</button>
						</div>
					</div>
				</div>

			{:else if activeTab === 'notes'}
				<!-- Card 3: Deep Cut Liner Notes -->
				<div class="card-page notes-card">
					<div class="notes-scrollable-area">
						<div class="meta-row">
							<span class="meta-tag mint">OCT 14</span>
							<span class="meta-tag muted">LINER NOTES</span>
						</div>

						<h2 class="notes-title">Thoughts on the New Record</h2>

						<div class="notes-prose">
							<p>
								Been locked in the studio for the last three weeks. The energy here is different. We stripped back a lot of the heavy production we leaned on for the last album. Everything feels more raw, more intentional.
							</p>
							<p>
								Yesterday, we recorded an acoustic progression that just appeared out of nowhere. No click track, just playing to the room. It has this haunting quality that I can't shake. I think it's going to be the opening track.
							</p>
							<p>
								I want this record to feel like you're sitting in the room with us. No polish, just the truth. Thanks to everyone who's been supporting the tour and tipping through Quire.
							</p>
						</div>
					</div>

					<div class="card-bottom-fixed">
						<div class="action-grid">
							<button
								type="button"
								class="action-btn tip-btn"
								onclick={() => (showTipDrawer = true)}
							>
								<svg class="action-svg pink-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
								</svg>
								<span>Support Studio</span>
							</button>
							<button
								type="button"
								class="action-btn comment-btn"
								onclick={() => (activeTab = 'wall')}
							>
								<svg class="action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
								</svg>
								<span>Reply to Band</span>
							</button>
						</div>
					</div>
				</div>

			{:else if activeTab === 'wall'}
				<!-- Card 4: Digital Guestbook Wall -->
				<div class="card-page wall-card">
					<div class="wall-header-area">
						<div class="meta-row">
							<span class="meta-tag cyan">COMMUNITY WALL</span>
							<span class="meta-tag muted">{comments.length} ENTRIES</span>
						</div>
						<h2 class="wall-title">Digital Guestbook</h2>
						<p class="wall-sub">Read the wall or leave your own mark on tonight's gig.</p>
					</div>

					<!-- Comments List -->
					<div class="wall-feed-scroll">
						{#each comments as c (c.id)}
							<div class="fan-comment-item">
								<div class="fan-avatar" style="background: {c.color};">
									{c.initials}
								</div>
								<div class="fan-content">
									<div class="fan-meta">
										<span class="fan-name">{c.author}</span>
										<span class="fan-time">{c.time}</span>
									</div>
									<div class="fan-bubble">
										{c.text}
									</div>

									{#if c.reply}
										<div class="artist-reply-block">
											<div class="artist-verified-row">
												<span class="verified-icon">✓</span>
												<span class="artist-reply-name">{c.reply.author}</span>
												<span class="artist-reply-time">{c.reply.time}</span>
											</div>
											<div class="artist-reply-bubble">
												{c.reply.text}
											</div>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<div class="card-bottom-fixed">
						<button
							type="button"
							class="action-btn sign-wall-full"
							onclick={() => (showCommentDrawer = true)}
						>
							<svg class="action-svg cyan-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M12 20h9" />
								<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
							</svg>
							<span>Sign the Guestbook</span>
						</button>
					</div>
				</div>
			{/if}
		</main>

		<!-- Bottom Drawer: Support / Tip Modal -->
		{#if showTipDrawer}
			<button type="button" class="drawer-scrim" onclick={() => (showTipDrawer = false)} aria-label="Close drawer"></button>
			<div class="slide-drawer glass-drawer">
				<div class="drawer-handle"></div>
				<div class="drawer-header">
					<h3 class="drawer-title">Support The Neon Velvet</h3>
					<button
						type="button"
						class="drawer-close"
						onclick={() => (showTipDrawer = false)}
						aria-label="Close"
					>✕</button>
				</div>
				<p class="drawer-sub">Directly fund studio recording time & van gas. 100% direct to artist.</p>

				<!-- Tip Presets -->
				<div class="tip-preset-grid">
					{#each [3, 5, 10, 25] as amount}
						<button
							type="button"
							class="tip-chip"
							class:selected={tipAmount === amount && !customTip}
							onclick={() => handlePresetTip(amount)}
						>
							${amount}
						</button>
					{/each}
				</div>

				<!-- Custom Tip Input -->
				<div class="custom-tip-wrapper">
					<span class="currency-symbol">$</span>
					<input
						type="number"
						placeholder="Custom Amount"
						value={customTip}
						oninput={handleCustomTipChange}
						min="1"
						class="custom-tip-input"
					/>
				</div>

				<button
					type="button"
					class="btn-checkout-primary"
					onclick={submitTip}
				>
					Send ${tipAmount} Tip →
				</button>
			</div>
		{/if}

		<!-- Bottom Drawer: Add Note Modal -->
		{#if showCommentDrawer}
			<button type="button" class="drawer-scrim" onclick={() => (showCommentDrawer = false)} aria-label="Close drawer"></button>
			<div class="slide-drawer glass-drawer">
				<div class="drawer-handle"></div>
				<div class="drawer-header">
					<h3 class="drawer-title">Leave Your Mark</h3>
					<button
						type="button"
						class="drawer-close"
						onclick={() => (showCommentDrawer = false)}
						aria-label="Close"
					>✕</button>
				</div>
				<p class="drawer-sub">Write a note for tonight's wall. The band reads every single one.</p>

				<div class="comment-input-box">
					<textarea
						bind:value={newCommentText}
						placeholder="Say something to the band, mention your favorite song, or show love from your city..."
						rows="3"
						class="comment-textarea"
					></textarea>
				</div>

				<button
					type="button"
					class="btn-checkout-primary mint-theme"
					onclick={submitComment}
				>
					Post Note to Wall ✨
				</button>
			</div>
		{/if}

		<!-- Toast Notification Notification -->
		{#if toastMessage}
			<div class="in-phone-toast">
				<div class="toast-title">{toastMessage.title}</div>
				<div class="toast-desc">{toastMessage.desc}</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.mockup-wrapper {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		perspective: 1000px;
	}

	.phone-frame {
		position: relative;
		width: 100%;
		max-width: 390px;
		height: 690px;
		background: #090710;
		border-radius: 44px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		box-shadow:
			0 25px 70px -15px rgba(0, 0, 0, 0.8),
			0 0 50px -10px rgba(5, 217, 232, 0.25),
			inset 0 0 0 2px rgba(255, 255, 255, 0.05);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		user-select: none;
	}

	/* Top Status bar */
	.phone-status-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 22px 4px;
		font-size: 0.72rem;
		font-weight: 600;
		color: #e4e4e7;
		z-index: 50;
	}

	.status-time {
		letter-spacing: -0.02em;
	}

	.dynamic-island {
		width: 80px;
		height: 18px;
		background: #000;
		border-radius: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.island-camera {
		width: 7px;
		height: 7px;
		background: #151124;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.status-signals {
		display: flex;
		gap: 6px;
		font-size: 0.65rem;
		color: #a1a1aa;
	}

	/* Zine Header */
	.zine-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 18px;
		z-index: 40;
	}

	.brand-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.brand-text {
		font-size: 0.95rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: #05d9e8;
		text-shadow: 0 0 10px rgba(5, 217, 232, 0.5);
	}

	.live-indicator {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 0.68rem;
		font-weight: 700;
		color: #01ffc3;
		letter-spacing: 0.08em;
	}

	.pulse-dot {
		width: 5px;
		height: 5px;
		background: #01ffc3;
		border-radius: 50%;
		box-shadow: 0 0 6px #01ffc3;
		animation: pulse 1.8s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.4; transform: scale(0.8); }
	}

	.login-chip {
		font-size: 0.72rem;
		font-weight: 600;
		color: #d4d4d8;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		padding: 4px 10px;
		border-radius: 9999px;
		text-decoration: none;
		transition: all 0.2s;
	}

	.login-chip:hover {
		background: rgba(255, 255, 255, 0.16);
		color: #ffffff;
	}

	/* Nav Tabs */
	.zine-nav-tabs {
		display: flex;
		gap: 6px;
		padding: 4px 16px 10px;
		z-index: 40;
		background: linear-gradient(to bottom, rgba(9, 7, 16, 0.95), rgba(9, 7, 16, 0.7));
	}

	.nav-tab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 6px 4px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		color: #a1a1aa;
		font-size: 0.72rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.nav-tab-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: #f4f4f5;
	}

	.nav-tab-btn.active {
		background: rgba(5, 217, 232, 0.14);
		border-color: rgba(5, 217, 232, 0.45);
		color: #05d9e8;
		box-shadow: 0 0 12px rgba(5, 217, 232, 0.2);
	}

	/* Main screen body */
	.zine-screen-body {
		flex: 1;
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.card-page {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		overflow: hidden;
	}

	.card-bg-image {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
	}

	.audio-card-bg {
		background-image: url('https://images.unsplash.com/photo-1598387181032-a3103a2db5b3?auto=format&fit=crop&q=80&w=800');
	}

	.photo-card-bg {
		background-image: url('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800');
	}

	.card-dark-scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, #090710 20%, rgba(9, 7, 16, 0.6) 60%, rgba(9, 7, 16, 0.3) 100%);
	}

	/* Media center play action */
	.media-center-action {
		position: absolute;
		top: 36%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		z-index: 20;
	}

	.play-circle-btn {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: rgba(21, 17, 36, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.25);
		backdrop-filter: blur(16px);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		cursor: pointer;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 25px rgba(5, 217, 232, 0.35);
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.play-circle-btn:hover {
		transform: scale(1.08);
		border-color: #05d9e8;
		box-shadow: 0 10px 36px rgba(0, 0, 0, 0.7), 0 0 35px rgba(5, 217, 232, 0.6);
	}

	.play-circle-btn.playing {
		background: rgba(5, 217, 232, 0.2);
		border-color: #05d9e8;
		color: #05d9e8;
	}

	.icon-svg {
		width: 28px;
		height: 28px;
	}

	.play-hint-text {
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: #e4e4e7;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
	}

	/* Card bottom content */
	.card-bottom-content {
		position: relative;
		z-index: 25;
		padding: 16px 18px 20px;
		background: linear-gradient(to top, #090710 75%, transparent 100%);
	}

	.meta-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 8px;
	}

	.meta-tag {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.meta-tag.mint {
		color: #01ffc3;
	}

	.meta-tag.cyan {
		color: #05d9e8;
	}

	.meta-tag.muted {
		color: #a1a1aa;
	}

	.time-stamp {
		font-size: 0.7rem;
		font-weight: 600;
		color: #05d9e8;
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}

	.card-headline {
		font-size: 1.45rem;
		font-weight: 800;
		color: #ffffff;
		letter-spacing: -0.02em;
		margin: 0 0 4px;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.7);
	}

	.card-subtext {
		font-size: 0.8rem;
		line-height: 1.4;
		color: #a1a1aa;
		margin: 0 0 14px;
	}

	/* Waveform visualizer */
	.audio-waveform-row {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 14px;
		padding: 8px 12px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
	}

	.waveform-bars {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		height: 22px;
		gap: 3px;
	}

	.waveform-bars span {
		flex: 1;
		background: rgba(5, 217, 232, 0.35);
		border-radius: 2px;
		height: var(--h);
		transition: height 0.2s ease, background 0.2s ease;
	}

	.waveform-bars.animating span {
		background: #05d9e8;
		animation: eqBounce 0.8s ease-in-out infinite alternate;
	}

	.waveform-bars.animating span:nth-child(even) {
		animation-duration: 0.6s;
		animation-delay: 0.15s;
	}
	.waveform-bars.animating span:nth-child(3n) {
		animation-duration: 0.9s;
		animation-delay: 0.3s;
	}

	@keyframes eqBounce {
		0% { height: 25%; }
		100% { height: 95%; }
	}

	.track-progress-bar {
		width: 100%;
		height: 3px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 2px;
		overflow: hidden;
	}

	.track-progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #05d9e8, #01ffc3);
		transition: width 0.3s ease;
	}

	/* Action Grid */
	.action-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.action-btn {
		height: 42px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s;
	}

	.tip-btn {
		background: rgba(255, 42, 109, 0.12);
		border: 1px solid rgba(255, 42, 109, 0.35);
		color: #ffffff;
	}

	.tip-btn:hover {
		background: rgba(255, 42, 109, 0.24);
		border-color: #ff2a6d;
		box-shadow: 0 0 16px rgba(255, 42, 109, 0.4);
		transform: translateY(-1px);
	}

	.comment-btn {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.14);
		color: #e4e4e7;
	}

	.comment-btn:hover {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(255, 255, 255, 0.3);
		transform: translateY(-1px);
	}

	.action-svg {
		width: 17px;
		height: 17px;
	}

	.pink-svg {
		color: #ff2a6d;
	}

	.cyan-svg {
		color: #05d9e8;
	}

	/* Photo Card Specific */
	.top-film-label {
		position: absolute;
		top: 14px;
		right: 18px;
		color: #e4e4e7;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
	}

	/* Notes Card */
	.notes-card {
		background: linear-gradient(160deg, #151124 0%, #090710 100%);
		padding: 16px 18px 0;
	}

	.notes-scrollable-area {
		flex: 1;
		overflow-y: auto;
		padding-bottom: 70px;
		scrollbar-width: none;
	}

	.notes-scrollable-area::-webkit-scrollbar {
		display: none;
	}

	.notes-title {
		font-size: 1.4rem;
		font-weight: 800;
		color: #ffffff;
		margin: 8px 0 14px;
		letter-spacing: -0.02em;
	}

	.notes-prose p {
		font-size: 0.82rem;
		line-height: 1.6;
		color: #d4d4d8;
		margin-bottom: 12px;
	}

	.card-bottom-fixed {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 14px 18px 18px;
		background: linear-gradient(to top, #090710 80%, transparent 100%);
		z-index: 20;
	}

	/* Wall Card */
	.wall-card {
		background: linear-gradient(to bottom, #151124 0%, #090710 100%);
		padding: 16px 18px 0;
	}

	.wall-header-area {
		margin-bottom: 12px;
	}

	.wall-title {
		font-size: 1.35rem;
		font-weight: 800;
		color: #ffffff;
		margin: 6px 0 2px;
	}

	.wall-sub {
		font-size: 0.74rem;
		color: #a1a1aa;
	}

	.wall-feed-scroll {
		flex: 1;
		overflow-y: auto;
		padding-bottom: 76px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		scrollbar-width: none;
	}

	.wall-feed-scroll::-webkit-scrollbar {
		display: none;
	}

	.fan-comment-item {
		display: flex;
		gap: 9px;
	}

	.fan-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		font-weight: 800;
		color: #000;
		flex-shrink: 0;
	}

	.fan-content {
		flex: 1;
	}

	.fan-meta {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin-bottom: 3px;
	}

	.fan-name {
		font-size: 0.74rem;
		font-weight: 700;
		color: #ffffff;
	}

	.fan-time {
		font-size: 0.64rem;
		color: #71717a;
	}

	.fan-bubble {
		font-size: 0.78rem;
		color: #d4d4d8;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		padding: 8px 12px;
		border-radius: 12px;
		border-top-left-radius: 3px;
		line-height: 1.45;
	}

	.artist-reply-block {
		margin-top: 6px;
		margin-left: 8px;
		background: rgba(5, 217, 232, 0.07);
		border: 1px solid rgba(5, 217, 232, 0.22);
		border-left: 3px solid #05d9e8;
		padding: 7px 10px;
		border-radius: 10px;
	}

	.artist-verified-row {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-bottom: 2px;
	}

	.verified-icon {
		font-size: 0.65rem;
		font-weight: 800;
		color: #05d9e8;
	}

	.artist-reply-name {
		font-size: 0.7rem;
		font-weight: 700;
		color: #05d9e8;
	}

	.artist-reply-time {
		font-size: 0.6rem;
		color: #71717a;
	}

	.artist-reply-bubble {
		font-size: 0.74rem;
		color: #e4e4e7;
		line-height: 1.4;
	}

	.sign-wall-full {
		width: 100%;
		background: rgba(5, 217, 232, 0.12);
		border: 1px solid rgba(5, 217, 232, 0.35);
		color: #05d9e8;
	}

	.sign-wall-full:hover {
		background: rgba(5, 217, 232, 0.2);
		border-color: #05d9e8;
		box-shadow: 0 0 16px rgba(5, 217, 232, 0.35);
	}

	/* Drawers */
	.drawer-scrim {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(4px);
		border: none;
		cursor: pointer;
		z-index: 60;
		padding: 0;
		margin: 0;
	}

	.slide-drawer {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: rgba(14, 11, 26, 0.96);
		backdrop-filter: blur(28px);
		border-top: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 28px 28px 0 0;
		padding: 10px 18px 24px;
		z-index: 70;
		animation: slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	@keyframes slideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}

	.drawer-handle {
		width: 38px;
		height: 4px;
		background: rgba(255, 255, 255, 0.25);
		border-radius: 2px;
		margin: 0 auto 4px;
	}

	.drawer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.drawer-title {
		font-size: 1.05rem;
		font-weight: 800;
		color: #ffffff;
	}

	.drawer-close {
		background: transparent;
		border: none;
		color: #a1a1aa;
		font-size: 1.1rem;
		cursor: pointer;
		padding: 4px;
	}

	.drawer-sub {
		font-size: 0.76rem;
		color: #a1a1aa;
		line-height: 1.4;
	}

	.tip-preset-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
	}

	.tip-chip {
		height: 38px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		color: #e4e4e7;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s;
	}

	.tip-chip:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	.tip-chip.selected {
		background: rgba(255, 42, 109, 0.2);
		border-color: #ff2a6d;
		color: #ff2a6d;
		box-shadow: 0 0 12px rgba(255, 42, 109, 0.35);
	}

	.custom-tip-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.currency-symbol {
		position: absolute;
		left: 12px;
		color: #71717a;
		font-weight: 700;
		font-size: 0.85rem;
	}

	.custom-tip-input {
		width: 100%;
		height: 40px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		padding: 0 12px 0 28px;
		color: #ffffff;
		font-size: 0.82rem;
		font-weight: 600;
		outline: none;
	}

	.custom-tip-input:focus {
		border-color: #ff2a6d;
		background: rgba(255, 42, 109, 0.06);
	}

	.comment-input-box {
		width: 100%;
	}

	.comment-textarea {
		width: 100%;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 12px;
		padding: 10px 12px;
		color: #ffffff;
		font-size: 0.82rem;
		font-family: inherit;
		resize: none;
		outline: none;
	}

	.comment-textarea:focus {
		border-color: #01ffc3;
		background: rgba(1, 255, 195, 0.05);
	}

	.btn-checkout-primary {
		height: 44px;
		width: 100%;
		border-radius: 12px;
		background: #ff2a6d;
		border: none;
		color: #ffffff;
		font-size: 0.86rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 4px 18px rgba(255, 42, 109, 0.4);
		transition: all 0.2s;
	}

	.btn-checkout-primary:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 22px rgba(255, 42, 109, 0.6);
	}

	.btn-checkout-primary.mint-theme {
		background: #01ffc3;
		color: #090710;
		box-shadow: 0 4px 18px rgba(1, 255, 195, 0.35);
	}

	.btn-checkout-primary.mint-theme:hover {
		box-shadow: 0 6px 22px rgba(1, 255, 195, 0.55);
	}

	/* In-phone toast notification */
	.in-phone-toast {
		position: absolute;
		top: 48px;
		left: 14px;
		right: 14px;
		background: rgba(21, 17, 36, 0.95);
		border: 1px solid rgba(5, 217, 232, 0.4);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(5, 217, 232, 0.3);
		border-radius: 14px;
		padding: 10px 14px;
		z-index: 90;
		animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes toastIn {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.toast-title {
		font-size: 0.76rem;
		font-weight: 800;
		color: #05d9e8;
		margin-bottom: 2px;
	}

	.toast-desc {
		font-size: 0.72rem;
		color: #e4e4e7;
		line-height: 1.35;
	}
</style>
