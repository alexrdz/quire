<script lang="ts">
  import ZineSimulator from "$lib/components/landing/ZineSimulator.svelte";
  import {
    Container,
    Split,
    Stack,
    Cluster,
    Grid,
    Switcher,
    Box,
  } from "$lib/components/layout";

  // Svelte 5 state
  let activeAudienceTab = $state<"artists" | "fans">("artists");
</script>

<svelte:head>
  <title>Quire — Digital Zines for Live Gigs</title>
  <meta
    name="description"
    content="City-specific digital zines for touring bands and buskers. 1-tap tipping, attendance-verified ticket stubs, unreleased audio drops, and open guestbook walls."
  />
</svelte:head>

<div class="landing-page-root">
  <!-- Ambient Background Glows -->
  <div class="ambient-glow cyan-glow"></div>
  <div class="ambient-glow pink-glow"></div>
  <div class="ambient-glow mint-glow"></div>

  <!-- Top Navigation -->
  <header class="top-nav">
    <Container width="main" padding="none">
      <Cluster justify="between" align="center" class="nav-container">
        <Cluster as="a" href="/" align="center" gap="2xs" class="brand-link">
          <span class="brand-logo">QUIRE</span>
          <span class="brand-dot"></span>
          <span class="brand-tagline">DIGITAL ZINES</span>
        </Cluster>

        <Cluster as="nav" align="center" gap="md" class="nav-menu" aria-label="Main Navigation">
          <a href="#features" class="nav-item">Features</a>
          <a href="#simulator" class="nav-item">Interactive Demo</a>
          <a href="#tour-showcase" class="nav-item">Live Tour</a>
          <a href="#how-it-works" class="nav-item">How It Works</a>
        </Cluster>

        <Cluster align="center" gap="xs">
          <a href="/login" class="nav-btn-secondary">Artist Sign In</a>
          <a href="/login?mode=signup" class="nav-btn-primary">Claim Band Zine</a>
        </Cluster>
      </Cluster>
    </Container>
  </header>

  <main id="main-content">
    <!-- HERO SECTION -->
    <section class="hero-section">
      <Container width="main" padding="none">
        <Split ratio="1-1" gap="lg" collapse="md" align="center">
          <!-- Hero Left Column: Copy & CTAs -->
          <Stack gap="lg" class="hero-content">
            <Cluster align="center" gap="2xs" class="hero-eyebrow">
              <span class="live-ping"></span>
              <span>THE DIGITAL ZINE FOR LIVE MUSIC</span>
            </Cluster>

            <h1 class="hero-headline">
              Your Venmo QR collects tips.
              <span class="neon-highlight-text"
                >Quire brings the people too.</span
              >
            </h1>

            <p class="hero-subtext">
              City-specific digital zines published by touring bands, solo
              acts, and buskers. Tips that open your Venmo prefilled, attendance-verified
              ticket stubs, unreleased demo drops, and a living backstage wall
              for every stop on tour.
            </p>

            <!-- Call to Action Buttons -->
            <Cluster align="center" gap="sm">
              <a href="/login?mode=signup" class="hero-btn-primary">
                <span>Claim Your Tour Zine</span>
                <svg
                  class="cta-arrow-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>

              <a
                href="/i/neon-velvet-brooklyn-2026-10-12"
                class="hero-btn-secondary"
              >
                <span>Explore Live Brooklyn Zine</span>
              </a>

              <a href="/a/the-neon-velvet" class="hero-btn-tertiary">
                <span>View Artist Hub ↗</span>
              </a>
            </Cluster>

            <!-- Key Metrics / Proof Points Strip -->
            <Grid min="xs" gap="md" class="hero-metrics-strip">
              <Cluster align="center" gap="xs" nowrap class="metric-item">
                <div class="metric-icon-wrap mint">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <Stack gap="none" class="metric-text-wrap">
                  <span class="metric-value">60-Second Setup</span>
                  <span class="metric-label"
                    >Clone per city before soundcheck</span
                  >
                </Stack>
              </Cluster>

              <Cluster align="center" gap="xs" nowrap class="metric-item">
                <div class="metric-icon-wrap pink">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <Stack gap="none" class="metric-text-wrap">
                  <span class="metric-value">Tips Straight to Your Venmo</span>
                  <span class="metric-label"
                    >Quire takes no cut</span
                  >
                </Stack>
              </Cluster>

              <Cluster align="center" gap="xs" nowrap class="metric-item">
                <div class="metric-icon-wrap cyan">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <Stack gap="none" class="metric-text-wrap">
                  <span class="metric-value">Verified Stubs</span>
                  <span class="metric-label"
                    >No GPS, stamped by physical QR</span
                  >
                </Stack>
              </Cluster>
            </Grid>
          </Stack>

          <!-- Hero Right Column: Interactive Phone Simulator -->
          <Stack gap="sm" align="center" class="hero-preview-col" id="simulator">
            <Stack gap="3xs" align="center" class="simulator-callout-header">
              <span class="preview-eyebrow">LIVE INTERACTIVE PROTOTYPE</span>
              <p class="preview-hint">
                Tap tabs, play audio, or simulate a tip:
              </p>
            </Stack>
            <ZineSimulator />
          </Stack>
        </Split>
      </Container>
    </section>

    <!-- VALUE PROPOSITION / AUDIENCE SPLIT SECTION -->
    <Stack as="section" class="section-container" id="features" gap="lg">
      <Stack gap="lg" align="center">
        <Stack gap="sm" align="center" class="section-header-centered">
          <span class="section-eyebrow">DESIGNED FOR GIGS</span>
          <h2 class="section-title">A Living Artifact For Every Show</h2>
          <p class="section-subtitle">
            Traditional link trees feel like corporate spreadsheets. Quire
            captures the raw, electric atmosphere of a live venue in an
            instant-loading web zine.
          </p>

          <!-- Audience Toggle -->
          <Cluster justify="center" gap="xs">
            <button
              type="button"
              class="toggle-choice-btn"
              class:active={activeAudienceTab === "artists"}
              onclick={() => (activeAudienceTab = "artists")}
            >
              For Touring Bands & Artists
            </button>
            <button
              type="button"
              class="toggle-choice-btn"
              class:active={activeAudienceTab === "fans"}
              onclick={() => (activeAudienceTab = "fans")}
            >
              For Fans & Music Lovers
            </button>
          </Cluster>
        </Stack>
      </Stack>

      <Container padding="none">
        <!-- Dynamic Audience Feature Grid -->
        {#if activeAudienceTab === "artists"}
          <Grid min="md" gap="lg">
            <Box variant="raised" padding="xl" radius="lg" class="feature-card">
              <div class="feature-card-glow cyan"></div>
              <Stack gap="sm">
                <div class="card-icon-box cyan">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                    />
                  </svg>
                </div>
                <Stack gap="xs">
                  <h3 class="feature-card-title">Tips Straight to Your Venmo</h3>
                  <p class="feature-card-desc">
                    Keep your Venmo. A fan taps an amount and Venmo opens with
                    your handle, the amount and a note already filled in. 100% of
                    the tip goes to your Venmo, and Quire never touches the money.
                  </p>
                </Stack>
                <Cluster gap="xs" class="card-tag-row">
                  <span class="card-feature-item">Opens Venmo Prefilled</span>
                  <span class="card-feature-item">No Cut</span>
                  <span class="card-feature-item">No App for Quire</span>
                </Cluster>
              </Stack>
            </Box>

            <Box variant="raised" padding="xl" radius="lg" class="feature-card">
              <div class="feature-card-glow pink"></div>
              <Stack gap="sm">
                <div class="card-icon-box pink">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                  </svg>
                </div>
                <Stack gap="xs">
                  <h3 class="feature-card-title">60-Second City Cloning</h3>
                  <p class="feature-card-desc">
                    Design your master aesthetic once in the Bookbinder. When you
                    roll into Philadelphia or Detroit, clone the issue, type
                    tonight's setlist, and your city issue is live before
                    soundcheck ends.
                  </p>
                </Stack>
                <Cluster gap="xs" class="card-tag-row">
                  <span class="card-feature-item">Bookbinder Engine</span>
                  <span class="card-feature-item">Mobile Friendly</span>
                </Cluster>
              </Stack>
            </Box>

            <Box variant="raised" padding="xl" radius="lg" class="feature-card">
              <div class="feature-card-glow mint"></div>
              <Stack gap="sm">
                <div class="card-icon-box mint">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <Stack gap="xs">
                  <h3 class="feature-card-title">The Physical QR Geofence</h3>
                  <p class="feature-card-desc">
                    Zero invasive GPS tracking. Your physical sticker on the amp
                    or merch table is the geofence. Fans who scan during the gig's
                    48-hour Stamp Window earn authentic attendance proof.
                  </p>
                </Stack>
                <Cluster gap="xs" class="card-tag-row">
                  <span class="card-feature-item">Cryptographic HMAC</span>
                  <span class="card-feature-item">No Location Prompts</span>
                </Cluster>
              </Stack>
            </Box>

            <Box variant="raised" padding="xl" radius="lg" class="feature-card">
              <div class="feature-card-glow purple"></div>
              <Stack gap="sm">
                <div class="card-icon-box purple">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                    />
                  </svg>
                </div>
                <Stack gap="xs">
                  <h3 class="feature-card-title">An Algorithmic-Free Wall</h3>
                  <p class="feature-card-desc">
                    Stop begging fans to comment on social algorithms that hide
                    your posts. Your Quire wall is a permanent,
                    moderation-controlled guestbook where you can reply directly
                    with your verified band badge.
                  </p>
                </Stack>
                <Cluster gap="xs" class="card-tag-row">
                  <span class="card-feature-item">Verified Artist Badge</span>
                  <span class="card-feature-item">Built-in Moderation</span>
                </Cluster>
              </Stack>
            </Box>
          </Grid>
        {:else}
          <Grid min="md" gap="lg">
            <Box variant="raised" padding="xl" radius="lg" class="feature-card">
              <div class="feature-card-glow cyan"></div>
              <Stack gap="sm">
                <div class="card-icon-box cyan">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <Stack gap="xs">
                  <h3 class="feature-card-title">Digital Ticket Stubs</h3>
                  <p class="feature-card-desc">
                    Remember when paper ticket stubs filled shoeboxes in your
                    bedroom? Quire returns that magic. Every concert you
                    physically attend generates a permanent, date-stamped
                    collectible in your wallet.
                  </p>
                </Stack>
                <Cluster gap="xs" class="card-tag-row">
                  <span class="card-feature-item">Permanent Wallet</span>
                  <span class="card-feature-item">Concert Lore</span>
                </Cluster>
              </Stack>
            </Box>

            <Box variant="raised" padding="xl" radius="lg" class="feature-card">
              <div class="feature-card-glow mint"></div>
              <Stack gap="sm">
                <div class="card-icon-box mint">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path
                      d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"
                    />
                  </svg>
                </div>
                <Stack gap="xs">
                  <h3 class="feature-card-title">Unreleased Vault Drops</h3>
                  <p class="feature-card-desc">
                    Bands share rough mix tapes, backstage acoustic demos, and
                    unreleased stems exclusively inside the city zine. Hear music
                    before it ever reaches major streaming services.
                  </p>
                </Stack>
                <Cluster gap="xs" class="card-tag-row">
                  <span class="card-feature-item">Exclusive Audio</span>
                  <span class="card-feature-item">Behind-The-Scenes</span>
                </Cluster>
              </Stack>
            </Box>

            <Box variant="raised" padding="xl" radius="lg" class="feature-card">
              <div class="feature-card-glow pink"></div>
              <Stack gap="sm">
                <div class="card-icon-box pink">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polygon
                      points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    />
                  </svg>
                </div>
                <Stack gap="xs">
                  <h3 class="feature-card-title">Real Fan Support</h3>
                  <p class="feature-card-desc">
                    Skip corporate merchandise markups. Tap $3, $5, or $20 while
                    you're standing in front of the stage and Venmo opens to pay
                    the band directly. Then leave them a note on the show wall.
                  </p>
                </Stack>
                <Cluster gap="xs" class="card-tag-row">
                  <span class="card-feature-item">Direct Love</span>
                  <span class="card-feature-item">No Middleman Cut</span>
                </Cluster>
              </Stack>
            </Box>

            <Box variant="raised" padding="xl" radius="lg" class="feature-card">
              <div class="feature-card-glow purple"></div>
              <Stack gap="sm">
                <div class="card-icon-box purple">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M12 20h9" />
                    <path
                      d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                    />
                  </svg>
                </div>
                <Stack gap="xs">
                  <h3 class="feature-card-title">Two-Way Artist Replies</h3>
                  <p class="feature-card-desc">
                    Leave a note about your favorite track or the venue energy.
                    The band can reply directly from their artist dashboard,
                    creating genuine connections that outlive the encore.
                  </p>
                </Stack>
                <Cluster gap="xs" class="card-tag-row">
                  <span class="card-feature-item">Direct Conversation</span>
                  <span class="card-feature-item">Community History</span>
                </Cluster>
              </Stack>
            </Box>
          </Grid>
        {/if}
      </Container>
    </Stack>

    <!-- LIVE TOUR SHOWCASE -->
    <Stack as="section" class="section-container" id="tour-showcase" gap="lg">
      <Stack gap="sm" align="center" class="section-header-centered">
        <span class="section-eyebrow mint">CURRENT RUNNING TOUR</span>
        <h2 class="section-title">The Neon Velvet — East Coast Fall Run</h2>
        <p class="section-subtitle">
          Explore real live issues currently published on the platform. Each
          stop features custom setlists, photo stubs, and city notes.
        </p>
      </Stack>

      <Container padding="none">
        <Stack gap="lg">
          <Grid min="md" gap="lg">
            <!-- Gig 1: Brooklyn -->
            <Box
              variant="raised"
              padding="xl"
              radius="lg"
              class="gig-card highlight-border"
            >
              <Stack gap="md">
                <Cluster
                  justify="between"
                  align="center"
                  class="gig-status-strip"
                >
                  <span class="live-status-tag">
                    <span class="live-pulse"></span> GIG 01 · ACTIVE
                  </span>
                  <span class="gig-date">OCT 12, 2026</span>
                </Cluster>

                <Stack gap="3xs">
                  <h3 class="gig-city-name">Brooklyn, NY</h3>
                  <div class="gig-venue-name">Baby's All Right</div>
                </Stack>

                <p class="gig-note">
                  "Tour kickoff show! Playing the entire new record with extended
                  fuzz jams and analog delays."
                </p>

                <Cluster gap="xs" class="gig-features-list">
                  <span class="card-feature-item">Demo: Studio Session 04</span>
                  <span class="card-feature-item">Verified Attendance Open</span>
                  <span class="card-feature-item">24 Guestbook Notes</span>
                </Cluster>

                <Cluster gap="sm" class="gig-card-actions">
                  <a
                    href="/i/neon-velvet-brooklyn-2026-10-12"
                    class="btn-gig-primary"
                  >
                    View Brooklyn Zine →
                  </a>
                  <a
                    href="/scan/neon-velvet-brooklyn-2026-10-12?k=kickoff_babys_secret_2026"
                    class="btn-gig-secondary"
                  >
                    Simulate QR Scan
                  </a>
                </Cluster>
              </Stack>
            </Box>

            <!-- Gig 2: Philadelphia -->
            <Box variant="raised" padding="xl" radius="lg" class="gig-card">
              <Stack gap="md">
                <Cluster
                  justify="between"
                  align="center"
                  class="gig-status-strip"
                >
                  <span class="upcoming-status-tag">GIG 02 · READY</span>
                  <span class="gig-date">OCT 15, 2026</span>
                </Cluster>

                <Stack gap="3xs">
                  <h3 class="gig-city-name">Philadelphia, PA</h3>
                  <div class="gig-venue-name">Johnny Brenda's</div>
                </Stack>

                <p class="gig-note">
                  "Balcony was shaking during the chorus. Fish & chips downstairs
                  after the midnight set."
                </p>

                <Cluster gap="xs" class="gig-features-list">
                  <span class="card-feature-item">Soundboard Rehearsal</span>
                  <span class="card-feature-item">35mm Tour Photo Stubs</span>
                  <span class="card-feature-item">Backstage Wall Ready</span>
                </Cluster>

                <Cluster gap="sm" class="gig-card-actions">
                  <a
                    href="/i/neon-velvet-philly-2026-10-15"
                    class="btn-gig-primary"
                  >
                    View Philly Zine →
                  </a>
                </Cluster>
              </Stack>
            </Box>

            <!-- Gig 3: Washington DC -->
            <Box variant="raised" padding="xl" radius="lg" class="gig-card">
              <Stack gap="md">
                <Cluster
                  justify="between"
                  align="center"
                  class="gig-status-strip"
                >
                  <span class="upcoming-status-tag">GIG 03 · READY</span>
                  <span class="gig-date">OCT 18, 2026</span>
                </Cluster>

                <Stack gap="3xs">
                  <h3 class="gig-city-name">Washington, DC</h3>
                  <div class="gig-venue-name">Black Cat</div>
                </Stack>

                <p class="gig-note">
                  "Main stage tonight. Soundcheck sounded massive. Catch us at the
                  merch booth."
                </p>

                <Cluster gap="xs" class="gig-features-list">
                  <span class="card-feature-item">Acoustic Opening Take</span>
                  <span class="card-feature-item">Verified Attendance</span>
                  <span class="card-feature-item">Guestbook Live</span>
                </Cluster>

                <Cluster gap="sm" class="gig-card-actions">
                  <a href="/i/neon-velvet-dc-2026-10-18" class="btn-gig-primary">
                    View DC Zine →
                  </a>
                </Cluster>
              </Stack>
            </Box>
          </Grid>

          <!-- Tour Hub Navigation Banner -->
          <Box
            variant="raised"
            padding="lg"
            radius="lg"
            class="tour-links-banner"
          >
            <Switcher collapse="md" gap="md" align="center">
              <Stack gap="3xs" class="banner-text">
                <h4>Looking for band discography or your personal wallet?</h4>
                <p>
                  Explore the full artist hub or inspect your collected digital
                  ticket stubs.
                </p>
              </Stack>
              <Cluster justify="end" gap="sm">
                <a href="/a/the-neon-velvet" class="banner-btn secondary">
                  View Artist Profile (/a/the-neon-velvet)
                </a>
                <a href="/me/stubs" class="banner-btn primary">
                  My Fan Stubs (/me/stubs)
                </a>
              </Cluster>
            </Switcher>
          </Box>
        </Stack>
      </Container>
    </Stack>

    <!-- HOW IT WORKS IN 3 STEPS -->
    <Stack as="section" class="section-container" id="how-it-works" gap="lg">
      <Stack gap="sm" align="center" class="section-header-centered">
        <span class="section-eyebrow cyan">THE 3-STEP PIPELINE</span>
        <h2 class="section-title">Zero Friction From Stage to Pocket</h2>
        <p class="section-subtitle">
          Built for artists who want to spend their time making noise, not
          managing social media platforms.
        </p>
      </Stack>

      <Container padding="none">
        <Switcher collapse="md" gap="lg" limit={3}>
          <!-- Step 1 -->
          <Box variant="raised" padding="xl" radius="lg" class="step-card">
            <Stack gap="sm">
              <div class="step-number">01</div>
              <h3 class="step-heading">Create Master Template</h3>
              <p class="step-body">
                Build your recurring tour pages once in the Bookbinder: band
                bio, merch links, and signature accent color.
              </p>
              <div class="step-meta">Setup time: ~3 minutes</div>
            </Stack>
          </Box>

          <!-- Step 2 -->
          <Box variant="raised" padding="xl" radius="lg" class="step-card">
            <Stack gap="sm">
              <div class="step-number">02</div>
              <h3 class="step-heading">Clone Before Soundcheck</h3>
              <p class="step-body">
                Before hitting the stage, enter tonight's city and venue. Attach
                today's demo or setlist. Print or display the auto-generated QR.
              </p>
              <div class="step-meta">Publish time: &lt;60 seconds</div>
            </Stack>
          </Box>

          <!-- Step 3 -->
          <Box variant="raised" padding="xl" radius="lg" class="step-card">
            <Stack gap="sm">
              <div class="step-number">03</div>
              <h3 class="step-heading">Fans Scan & Connect</h3>
              <p class="step-body">
                Fans scan with their native phone camera. No app download. They
                tip via Venmo, stamp their ticket stub, and sign your wall.
              </p>
              <div class="step-meta">Fan engagement: 0.8s load</div>
            </Stack>
          </Box>
        </Switcher>
      </Container>
    </Stack>

    <!-- COMPARISON TABLE: THE OLD WAY VS QUIRE -->
    <Stack as="section" class="section-container comparison-section" gap="lg">
      <Stack gap="sm" align="center" class="section-header-centered">
        <span class="section-eyebrow pink">WHY IT MATTERS</span>
        <h2 class="section-title">
          More Than a Venmo Sign
        </h2>
        <p class="section-subtitle">
          Keep your Venmo for the money. Quire adds the zine, the stubs and
          the wall around it.
        </p>
      </Stack>

      <Container padding="none">
        <Box
          variant="raised"
          padding="none"
          radius="lg"
          class="comparison-table-wrap"
        >
          <table class="comparison-table">
            <thead>
              <tr>
                <th class="col-feature">Experience</th>
                <th class="col-traditional">Just a Venmo QR / Link in Bio</th>
                <th class="col-quire">Quire Digital Zine</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="col-feature">Audience Retention</td>
                <td class="col-traditional"
                  >Zero retention. Money leaves, fan vanishes</td
                >
                <td class="col-quire highlight-td"
                  >Attendance stubs & permanent guestbook ties</td
                >
              </tr>
              <tr>
                <td class="col-feature">Tip Friction</td>
                <td class="col-traditional"
                  >Fan searches your handle and types an amount</td
                >
                <td class="col-quire highlight-td"
                  >Tap $5 and Venmo opens with your handle, amount and note filled in</td
                >
              </tr>
              <tr>
                <td class="col-feature">Concert Collectibles</td>
                <td class="col-traditional"
                  >None. Paper stubs are lost forever</td
                >
                <td class="col-quire highlight-td"
                  >Cryptographic ticket stub with venue & date</td
                >
              </tr>
              <tr>
                <td class="col-feature">Music & Unreleased Audio</td>
                <td class="col-traditional"
                  >External redirect to Spotify where royalties pay $0.003</td
                >
                <td class="col-quire highlight-td"
                  >Embedded backstage audio stream & stems</td
                >
              </tr>
              <tr>
                <td class="col-feature">App Store Barrier</td>
                <td class="col-traditional"
                  >60MB app downloads fail on venue cellular data</td
                >
                <td class="col-quire highlight-td"
                  >Instant web standard, 0.8s time-to-interactive</td
                >
              </tr>
            </tbody>
          </table>
        </Box>
      </Container>
    </Stack>

    <!-- FINAL CALL TO ACTION BANNER -->
    <Stack as="section" class="section-container cta-section" gap="lg">
      <Container padding="none">
        <Box variant="raised" padding="xl" radius="lg" class="final-cta-card">
          <Stack gap="md" align="center" class="section-header-centered">
            <span class="cta-eyebrow">TOUR READY IN 60 SECONDS</span>
            <h2 class="cta-headline">
              Turn Tonight's Crowd Into A Lifelong Community.
            </h2>
            <p class="cta-description">
              No platform gatekeepers. No social media algorithms hiding your
              art. Give your next live show the zine it deserves.
            </p>

            <Cluster justify="center" gap="sm">
              <a href="/login?mode=signup" class="hero-btn-primary">
                <span>Create Your Free Zine</span>
                <svg
                  class="cta-arrow-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>

              <a
                href="/i/neon-velvet-brooklyn-2026-10-12"
                class="hero-btn-secondary"
              >
                <span>Explore Live Brooklyn Zine</span>
              </a>
            </Cluster>
          </Stack>
        </Box>
      </Container>
    </Stack>
  </main>
</div>

<style>
  /* ROOT CONTAINER */
  .landing-page-root {
    position: relative;
    background-color: var(--ink, #090710);
    color: var(--paper, #f4f4f0);
    font-family: var(--font-sans);
    overflow-x: hidden;
    overflow-y: auto;
  }

  /* AMBIENT BACKGROUND GLOWS */
  .ambient-glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    opacity: 0.18;
    pointer-events: none;
    z-index: 0;
  }

  .cyan-glow {
    inset-block-start: -100px;
    inset-inline-start: 20%;
    inline-size: 550px;
    block-size: 550px;
    background: #05d9e8;
  }

  .pink-glow {
    inset-block-start: 600px;
    inset-inline-end: 5%;
    inline-size: 600px;
    block-size: 600px;
    background: #ff2a6d;
    opacity: 0.14;
  }

  .mint-glow {
    inset-block-start: 1500px;
    inset-inline-start: 10%;
    inline-size: 500px;
    block-size: 500px;
    background: #01ffc3;
    opacity: 0.12;
  }

  /* TOP NAVIGATION */
  .top-nav {
    position: sticky;
    inset-block-start: 0;
    z-index: 100;
    background: rgba(9, 7, 16, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-block-end: 1px solid rgba(255, 255, 255, 0.08);
  }

  :global(.nav-container) {
    max-inline-size: 1240px;
    margin-inline: auto;
    padding-block: var(--space-xs);
    padding-inline: var(--space-m);
  }

  :global(.brand-link) {
    text-decoration: none;
  }

  .brand-logo {
    font-size: var(--text-lead);
    font-weight: var(--weight-black);
    letter-spacing: var(--tracking-tight);
    color: #ffffff;
  }

  .brand-dot {
    inline-size: 6px;
    block-size: 6px;
    border-radius: 50%;
    background: #05d9e8;
    box-shadow: 0 0 10px #05d9e8;
  }

  .brand-tagline {
    font-size: var(--text-meta);
    font-weight: var(--weight-bold);
    letter-spacing: var(--tracking-wide);
    color: #01ffc3;
  }

  :global(.nav-menu) {
    display: none;
  }

  @media (min-width: 860px) {
    :global(.nav-menu) {
      display: flex;
    }
  }

  .nav-item {
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    color: #a1a1aa;
    text-decoration: none;
    transition: color 0.2s;
  }

  .nav-item:hover {
    color: #ffffff;
  }

  .nav-btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: var(--space-compact);
    font-size: var(--text-meta);
    font-weight: var(--weight-semibold);
    color: #e4e4e7;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
    padding-block: var(--space-compact);
    padding-inline: var(--space-xs);
    border-radius: 9999px;
    text-decoration: none;
    transition: all 0.2s;
  }

  .nav-btn-secondary:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
  }

  .nav-btn-primary {
    display: inline-flex;
    align-items: center;
    font-size: var(--text-small);
    font-weight: var(--weight-bold);
    color: #090710;
    background: #01ffc3;
    padding-block: var(--space-compact);
    padding-inline: var(--space-s);
    border-radius: 9999px;
    text-decoration: none;
    box-shadow: 0 0 16px rgba(1, 255, 195, 0.35);
    transition: all 0.2s;
  }

  .nav-btn-primary:hover {
    background: #25ffd0;
    box-shadow: 0 0 22px rgba(1, 255, 195, 0.55);
    transform: translateY(-1px);
  }

  /* HERO SECTION */
  .hero-section {
    position: relative;
    z-index: 10;
    padding-block-start: var(--space-xl);
    padding-block-end: var(--space-2xl);
    padding-inline: var(--space-m);
    max-inline-size: 1240px;
    margin-inline: auto;
  }

  :global(.hero-eyebrow) {
    font-size: var(--text-meta);
    font-weight: var(--weight-bold);
    letter-spacing: var(--tracking-wide);
    color: #01ffc3;
    text-transform: uppercase;
  }

  .live-ping {
    inline-size: 7px;
    block-size: 7px;
    border-radius: 50%;
    background: #01ffc3;
    box-shadow: 0 0 8px #01ffc3;
    animation: pulse 1.8s infinite;
  }

  .hero-headline {
    font-size: var(--text-hero);
    line-height: var(--leading-solid);
    font-weight: var(--weight-black);
    letter-spacing: var(--tracking-tight);
    color: #ffffff;
    margin: 0;
  }

  .neon-highlight-text {
    display: block;
    color: #05d9e8;
    text-shadow: 0 0 35px rgba(5, 217, 232, 0.45);
  }

  .hero-subtext {
    font-size: var(--text-body);
    line-height: var(--leading-body);
    color: #a1a1aa;
    max-inline-size: 58ch;
    margin: 0;
  }

  .hero-btn-primary {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2xs);
    background: #ff2a6d;
    color: #ffffff;
    font-weight: var(--weight-bold);
    font-size: var(--text-ui);
    padding-block: var(--space-xs);
    padding-inline: var(--space-m);
    border-radius: 9999px;
    text-decoration: none;
    box-shadow: 0 4px 24px rgba(255, 42, 109, 0.45);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .hero-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 30px rgba(255, 42, 109, 0.65);
  }

  .cta-arrow-icon {
    inline-size: 18px;
    block-size: 18px;
    transition: transform 0.2s;
  }

  .hero-btn-primary:hover .cta-arrow-icon {
    transform: translateX(3px);
  }

  .hero-btn-secondary {
    display: inline-flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: #ffffff;
    font-weight: var(--weight-semibold);
    font-size: var(--text-ui);
    padding-block: var(--space-xs);
    padding-inline: var(--space-m);
    border-radius: 9999px;
    text-decoration: none;
    backdrop-filter: blur(12px);
    transition: all 0.2s;
  }

  .hero-btn-secondary:hover {
    background: rgba(255, 255, 255, 0.16);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  .hero-btn-tertiary {
    display: inline-flex;
    align-items: center;
    color: #05d9e8;
    font-size: var(--text-ui);
    font-weight: var(--weight-semibold);
    text-decoration: none;
    padding-block: var(--space-2xs);
    padding-inline: var(--space-xs);
    transition: opacity 0.2s;
  }

  .hero-btn-tertiary:hover {
    opacity: 0.8;
  }

  .metric-icon-wrap {
    inline-size: 38px;
    block-size: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .metric-icon-wrap svg {
    inline-size: 18px;
    block-size: 18px;
  }

  .metric-icon-wrap.mint {
    background: rgba(1, 255, 195, 0.12);
    border: 1px solid rgba(1, 255, 195, 0.25);
    color: #01ffc3;
  }

  .metric-icon-wrap.pink {
    background: rgba(255, 42, 109, 0.12);
    border: 1px solid rgba(255, 42, 109, 0.25);
    color: #ff2a6d;
  }

  .metric-icon-wrap.cyan {
    background: rgba(5, 217, 232, 0.12);
    border: 1px solid rgba(5, 217, 232, 0.25);
    color: #05d9e8;
  }

  .metric-value {
    font-size: var(--text-small);
    font-weight: var(--weight-bold);
    color: #ffffff;
  }

  .metric-label {
    font-size: var(--text-meta);
    color: #a1a1aa;
  }

  /* Simulator Column */
  :global(.hero-preview-col) {
    inline-size: 100%;
  }

  :global(.simulator-callout-header) {
    text-align: center;
  }

  .preview-eyebrow {
    font-size: var(--text-meta);
    font-weight: var(--weight-heavy);
    letter-spacing: var(--tracking-wide);
    color: #05d9e8;
    text-transform: uppercase;
  }

  .preview-hint {
    font-size: var(--text-meta);
    color: #71717a;
    margin: 0;
  }

  /* GENERAL SECTION STYLING */
  :global(.section-container) {
    position: relative;
    z-index: 10;
    max-inline-size: 1240px;
    margin-inline: auto;
    padding-block: var(--space-2xl);
    padding-inline: var(--space-m);
  }

  :global(.section-header-centered) {
    text-align: center;
    max-inline-size: 62ch;
    margin-inline: auto;
  }

  .section-eyebrow {
    font-size: var(--text-meta);
    font-weight: var(--weight-heavy);
    letter-spacing: var(--tracking-display);
    color: #05d9e8;
    text-transform: uppercase;
  }

  .section-eyebrow.mint {
    color: #01ffc3;
  }

  .section-eyebrow.cyan {
    color: #05d9e8;
  }

  .section-eyebrow.pink {
    color: #ff2a6d;
  }

  .section-title {
    font-size: var(--text-title);
    line-height: var(--leading-tight);
    font-weight: var(--weight-heavy);
    letter-spacing: var(--tracking-tight);
    color: #ffffff;
    margin: 0;
  }

  .section-subtitle {
    font-size: var(--text-body);
    line-height: var(--leading-body);
    color: #a1a1aa;
    margin: 0;
  }

  .toggle-choice-btn {
    background: transparent;
    border: none;
    color: #a1a1aa;
    font-size: var(--text-small);
    font-weight: var(--weight-bold);
    padding-block: var(--space-2xs);
    padding-inline: var(--space-s);
    border-radius: 9999px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-choice-btn.active {
    background: #ffffff;
    color: #090710;
    box-shadow: 0 4px 16px rgba(255, 255, 255, 0.2);
  }

  :global(.feature-card) {
    position: relative;
    overflow: hidden;
    transition:
      transform 0.2s,
      border-color 0.2s;
  }

  :global(.feature-card:hover) {
    transform: translateY(-3px);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .feature-card-glow {
    position: absolute;
    inset-block-start: -40px;
    inset-inline-end: -40px;
    inline-size: 120px;
    block-size: 120px;
    border-radius: 50%;
    filter: blur(40px);
    opacity: 0.2;
    pointer-events: none;
  }

  .feature-card-glow.cyan {
    background: #05d9e8;
  }
  .feature-card-glow.pink {
    background: #ff2a6d;
  }
  .feature-card-glow.mint {
    background: #01ffc3;
  }
  .feature-card-glow.purple {
    background: #9d4edd;
  }

  .card-icon-box {
    inline-size: 44px;
    block-size: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-icon-box svg {
    inline-size: 22px;
    block-size: 22px;
  }

  .card-icon-box.cyan {
    background: rgba(5, 217, 232, 0.12);
    border: 1px solid rgba(5, 217, 232, 0.3);
    color: #05d9e8;
  }

  .card-icon-box.pink {
    background: rgba(255, 42, 109, 0.12);
    border: 1px solid rgba(255, 42, 109, 0.3);
    color: #ff2a6d;
  }

  .card-icon-box.mint {
    background: rgba(1, 255, 195, 0.12);
    border: 1px solid rgba(1, 255, 195, 0.3);
    color: #01ffc3;
  }

  .card-icon-box.purple {
    background: rgba(157, 78, 221, 0.15);
    border: 1px solid rgba(157, 78, 221, 0.35);
    color: #c77dff;
  }

  .feature-card-title {
    font-size: var(--text-lead);
    font-weight: var(--weight-heavy);
    color: #ffffff;
    margin: 0;
  }

  .feature-card-desc {
    font-size: var(--text-body);
    line-height: var(--leading-body);
    color: #a1a1aa;
    margin: 0;
  }

  .card-feature-item {
    font-size: var(--text-meta);
    font-weight: var(--weight-semibold);
    color: #a1a1aa;
  }

  .card-feature-item::before {
    content: "·";
    margin-inline-end: var(--space-compact);
    color: #05d9e8;
  }

  /* TOUR SHOWCASE SECTION */
  :global(.gig-card) {
    display: flex;
    flex-direction: column;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }

  :global(.gig-card.highlight-border) {
    border-color: rgba(1, 255, 195, 0.4);
    box-shadow: 0 0 30px rgba(1, 255, 195, 0.12);
  }

  :global(.gig-card:hover) {
    transform: translateY(-3px);
  }

  .live-status-tag {
    display: inline-flex;
    align-items: center;
    gap: var(--space-compact);
    font-size: var(--text-meta);
    font-weight: var(--weight-heavy);
    letter-spacing: var(--tracking-label);
    color: #01ffc3;
  }

  .live-pulse {
    inline-size: 5px;
    block-size: 5px;
    border-radius: 50%;
    background: #01ffc3;
    animation: pulse 1.6s infinite;
  }

  .upcoming-status-tag {
    font-size: var(--text-meta);
    font-weight: var(--weight-bold);
    letter-spacing: var(--tracking-label);
    color: #71717a;
  }

  .gig-date {
    font-size: var(--text-meta);
    font-weight: var(--weight-semibold);
    color: #71717a;
  }

  .gig-city-name {
    font-size: var(--text-heading-sm);
    font-weight: var(--weight-black);
    color: #ffffff;
    letter-spacing: var(--tracking-snug);
    margin: 0;
  }

  .gig-venue-name {
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
    color: #05d9e8;
  }

  .gig-note {
    font-size: var(--text-small);
    line-height: var(--leading-body);
    color: #d4d4d8;
    font-style: italic;
    background: rgba(255, 255, 255, 0.03);
    border-inline-start: 2px solid rgba(255, 255, 255, 0.2);
    padding-block: var(--space-2xs);
    padding-inline: var(--space-xs);
    border-radius: 0 8px 8px 0;
    margin: 0;
  }

  :global(.gig-card-actions) {
    margin-block-start: auto;
    padding-block-start: var(--space-xs);
  }

  .btn-gig-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #01ffc3;
    color: #090710;
    font-size: var(--text-small);
    font-weight: var(--weight-bold);
    padding-block: var(--space-2xs);
    padding-inline: var(--space-xs);
    border-radius: 10px;
    text-decoration: none;
    transition: all 0.2s;
  }

  .btn-gig-primary:hover {
    background: #25ffd0;
    box-shadow: 0 0 16px rgba(1, 255, 195, 0.4);
  }

  .btn-gig-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #e4e4e7;
    font-size: var(--text-meta);
    font-weight: var(--weight-semibold);
    padding-block: var(--space-2xs);
    padding-inline: var(--space-xs);
    border-radius: 10px;
    text-decoration: none;
    transition: all 0.2s;
  }

  .btn-gig-secondary:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  /* Tour Links Banner */
  :global(.tour-links-banner) {
    background: rgba(21, 17, 36, 0.8);
  }

  :global(.banner-text) h4 {
    font-size: var(--text-body);
    font-weight: var(--weight-heavy);
    color: #ffffff;
    margin: 0;
  }

  :global(.banner-text) p {
    font-size: var(--text-body);
    color: #a1a1aa;
    margin: 0;
  }

  .banner-btn {
    font-size: var(--text-small);
    font-weight: var(--weight-bold);
    padding-block: var(--space-2xs);
    padding-inline: var(--space-s);
    border-radius: 9999px;
    text-decoration: none;
    transition: all 0.2s;
  }

  .banner-btn.primary {
    background: #05d9e8;
    color: #090710;
  }

  .banner-btn.primary:hover {
    box-shadow: 0 0 16px rgba(5, 217, 232, 0.4);
  }

  .banner-btn.secondary {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
  }

  .banner-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  /* HOW IT WORKS PIPELINE */
  :global(.step-card) {
    flex: 1;
  }

  .step-number {
    font-size: var(--text-heading);
    font-weight: var(--weight-black);
    color: #01ffc3;
    text-shadow: 0 0 20px rgba(1, 255, 195, 0.4);
  }

  .step-heading {
    font-size: var(--text-lead);
    font-weight: var(--weight-heavy);
    color: #ffffff;
    margin: 0;
  }

  .step-body {
    font-size: var(--text-body);
    line-height: var(--leading-body);
    color: #a1a1aa;
    margin: 0;
  }

  .step-meta {
    font-size: var(--text-meta);
    font-weight: var(--weight-semibold);
    color: #05d9e8;
    margin-block-start: auto;
    padding-block-start: var(--space-2xs);
  }

  /* COMPARISON TABLE */
  :global(.comparison-table-wrap) {
    overflow-x: auto;
    border-radius: 20px;
    background: rgba(21, 17, 36, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .comparison-table {
    inline-size: 100%;
    border-collapse: collapse;
    text-align: start;
    font-size: var(--text-small);
  }

  .comparison-table th {
    padding-block: var(--space-s);
    padding-inline: var(--space-m);
    font-weight: var(--weight-heavy);
    border-block-end: 1px solid rgba(255, 255, 255, 0.1);
  }

  .col-feature {
    inline-size: 32%;
    color: #ffffff;
  }

  .col-traditional {
    inline-size: 34%;
    color: #a1a1aa;
  }

  .col-quire {
    inline-size: 34%;
    color: #01ffc3;
    background: rgba(1, 255, 195, 0.05);
  }

  .comparison-table td {
    padding-block: var(--space-s);
    padding-inline: var(--space-m);
    border-block-end: 1px solid rgba(255, 255, 255, 0.06);
    color: #d4d4d8;
    line-height: var(--leading-body);
  }

  .highlight-td {
    background: rgba(1, 255, 195, 0.04);
    font-weight: var(--weight-semibold);
    color: #ffffff;
  }

  /* FINAL CTA BANNER */
  :global(.cta-section) {
    padding-block-end: var(--space-3xl);
  }

  .cta-eyebrow {
    font-size: var(--text-meta);
    font-weight: var(--weight-heavy);
    letter-spacing: var(--tracking-display);
    color: #ff2a6d;
    text-transform: uppercase;
  }

  .cta-headline {
    font-size: var(--text-title);
    font-weight: var(--weight-black);
    letter-spacing: var(--tracking-tight);
    color: #ffffff;
    margin: 0;
  }

  .cta-description {
    font-size: var(--text-body);
    line-height: var(--leading-body);
    color: #a1a1aa;
    margin: 0;
  }
</style>
