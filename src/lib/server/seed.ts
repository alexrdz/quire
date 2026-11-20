import crypto from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { client, db, schema } from './db';
import { assertSchemaMigrated } from './db/schema-check';
import { eq, and } from 'drizzle-orm';
// Relative, not $domain: the Netlify demo-reset function bundles this file outside Vite.
import { calculateStampWindow } from '../domain/stamping';
import type { PhotoEntry } from '../domain/photo-pile';
import { allowsSampleData, getConfig, sampleDataRefusal } from './config';

/**
 * Venmo username of the sample Artist (development, test and the Demo only).
 * It may belong to a real person, so the settings page never opens it outside production.
 */
export const SAMPLE_VENMO_USERNAME = 'quire-sample-band';

/** The sample Issue whose Stamp Window is kept open so the scan flow can be tried (and e2e-tested) at any time. */
export const OPEN_WINDOW_SAMPLE_SLUG = 'neon-velvet-brooklyn-2026-10-12';

/**
 * A 48-hour Stamp Window starting one hour before `now`. Used only for the Brooklyn
 * sample Issue: its fixed 2026-10-12 window has passed, which made a valid scan of the
 * sample data impossible. Its slug and date label stay unchanged. Sample data only exists
 * in development, test and the Demo, so this never touches a real Issue.
 */
export function openSampleStampWindow(now: Date): { start: Date; end: Date } {
	const start = new Date(now.getTime() - 60 * 60 * 1000);
	const end = new Date(start.getTime() + 48 * 60 * 60 * 1000 - 1);
	return { start, end };
}

async function reopenSampleStampWindow(now: Date): Promise<void> {
	const window = openSampleStampWindow(now);
	await db
		.update(schema.issues)
		.set({ stampWindowStart: window.start, stampWindowEnd: window.end })
		.where(eq(schema.issues.slug, OPEN_WINDOW_SAMPLE_SLUG));
}

/** A sample Unsplash photo (the CSP's img-src allows images.unsplash.com in every mode). */
function samplePhotoUrl(photoId: string): string {
	return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&q=80&w=1000`;
}

/**
 * The Brooklyn Tour Diary pile: five photos, most captioned so they flip, one
 * left bare so the pile shows both kinds. The first photo is the one this page
 * has always had.
 */
export const BROOKLYN_TOUR_DIARY_PHOTOS: readonly PhotoEntry[] = [
	{
		url: samplePhotoUrl('1598387181032-a3103a2db5b3'),
		caption: 'Song three. The barricade gave up before we did.'
	},
	{
		url: samplePhotoUrl('1498038432885-c6f3f1b912ee'),
		caption: 'Velvet Wire ran eleven minutes. Nobody asked us to stop.'
	},
	{ url: samplePhotoUrl('1511671782779-c97d3d27a1d4') },
	{
		url: samplePhotoUrl('1501386761578-eac5c94b800a'),
		caption: 'Front row knew every word of Static Bloom. It came out last week.'
	},
	{
		url: samplePhotoUrl('1493225457124-a3eb161ffa5f'),
		caption: 'The Baby’s crew lent us their fog machine. We used all of it.'
	}
];

/** The Philadelphia Tour Diary pile: three captioned photos. */
export const PHILLY_TOUR_DIARY_PHOTOS: readonly PhotoEntry[] = [
	{
		url: samplePhotoUrl('1540039155733-5bb30b53aa14'),
		caption: 'The balcony shook during the chorus. We felt it through the monitors.'
	},
	{
		url: samplePhotoUrl('1510915361894-db8b60106cb1'),
		caption: 'Fishtown Rain was not on the setlist. It is now.'
	},
	{
		url: samplePhotoUrl('1459749411175-04bf5292ceea'),
		caption: 'Lights down for Night Bus to Girard. Cheesesteaks after.'
	}
];

/**
 * Photo page content in the format the Bookbinder saves: `photos` for the pile,
 * and `imageUrl` mirroring the first photo for readers of the one-photo format.
 */
function photoPageContent(input: { title: string; body: string; photos: readonly PhotoEntry[] }) {
	return {
		title: input.title,
		imageUrl: input.photos[0].url,
		photos: input.photos.map((photo) => ({ ...photo })),
		body: input.body
	};
}

export const SEED_REFUSED_MESSAGE =
	'Refusing to seed sample data in production mode. Run it with NODE_ENV=development or DEMO_MODE=true (ADR 0007).';

/**
 * Loads the sample Artist, Fan and Issues. Development, test and the Demo only:
 * throws in production so sample accounts with known passwords never reach a real database.
 * In development it also throws for a remote DATABASE_URL (see `sampleDataRefusal`).
 */
export async function seedDatabase() {
	const config = getConfig();
	if (!allowsSampleData(config.mode)) {
		throw new Error(SEED_REFUSED_MESSAGE);
	}
	// Development seeds only a file: database, never a remote one (B1-T10).
	const refusal = sampleDataRefusal(config);
	if (refusal) throw new Error(refusal);

	// Seeding only inserts data: the schema comes from `pnpm db:migrate` (PRODUCTION_PLAN 3.5).
	await assertSchemaMigrated(client);

	const existingArtist = await db.query.artists.findFirst({
		where: eq(schema.artists.slug, 'the-neon-velvet'),
		with: {
			issues: {
				with: {
					tips: true,
					issuePages: true
				}
			}
		}
	});

	const now = new Date();

	if (existingArtist) {
		await ensureArtistPasswordCredential(existingArtist.userId);
		await reopenSampleStampWindow(now);
		return existingArtist;
	}

	console.log('Seeding Quire database...');

	// 1. Create Artist User with real Better Auth credential hash (password: neonvelvet123)
	const artistUserId = crypto.randomUUID();
	const hashedPassword = await hashPassword('neonvelvet123');

	await db.insert(schema.users).values({
		id: artistUserId,
		name: 'The Neon Velvet',
		email: 'demo@neonvelvet.band',
		emailVerified: true,
		accountType: 'artist',
		createdAt: now,
		updatedAt: now
	});

	await db.insert(schema.accounts).values({
		id: crypto.randomUUID(),
		accountId: artistUserId,
		providerId: 'credential',
		userId: artistUserId,
		password: hashedPassword,
		createdAt: now,
		updatedAt: now
	});

	// 2. Create Fan Users
	const fan1Id = crypto.randomUUID();
	await db.insert(schema.users).values({
		id: fan1Id,
		name: 'Maya Lin',
		email: 'maya@example.com',
		emailVerified: true,
		accountType: 'fan',
		createdAt: now,
		updatedAt: now
	});

	const fan2Id = crypto.randomUUID();
	await db.insert(schema.users).values({
		id: fan2Id,
		name: 'Devon Vance',
		email: 'devon@example.com',
		emailVerified: true,
		accountType: 'fan',
		createdAt: now,
		updatedAt: now
	});

	const fan3Id = crypto.randomUUID();
	await db.insert(schema.users).values({
		id: fan3Id,
		name: 'Samir Patel',
		email: 'samir@example.com',
		emailVerified: true,
		accountType: 'fan',
		createdAt: now,
		updatedAt: now
	});

	// 3. Create Artist Profile
	const artistId = crypto.randomUUID();
	await db.insert(schema.artists).values({
		id: artistId,
		userId: artistUserId,
		slug: 'the-neon-velvet',
		displayName: 'The Neon Velvet',
		bio: 'Electric fuzz, analog synths, and post-punk grit from Brooklyn, NY. Catch us on the East Coast Fall Run.',
		coverArtUrl:
			'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=1200',
		accentColor: '#05D9E8',
		typePairing: 'sans-serif',
		tipPresetsJson: '[3, 5, 10]',
		linksJson: JSON.stringify([
			{ label: 'Bandcamp', url: 'https://bandcamp.com' },
			{ label: 'Tour Tickets', url: 'https://dice.fm' },
			{ label: 'Vinyl Merch', url: 'https://hellomerch.com' }
		]),
		venmoUsername: SAMPLE_VENMO_USERNAME,
		stripeAccountId: 'acct_demo_neon_velvet',
		payoutsEnabled: true,
		verified: true,
		generalWallApproveFirst: false,
		createdAt: now,
		updatedAt: now
	});

	// 4. Create Master Template Pages
	await db.insert(schema.templatePages).values([
		{
			id: crypto.randomUUID(),
			artistId,
			position: 1,
			kind: 'text',
			contentJson: JSON.stringify({
				title: 'Liner Notes: The East Coast Run',
				body: 'The Neon Velvet was born in damp rehearsal basements across Greenpoint. We believe physical presence and shared vibrations outlast algorithmic feeds. Every song on this run was tracked live to 2-inch tape.'
			}),
			createdAt: now
		},
		{
			id: crypto.randomUUID(),
			artistId,
			position: 2,
			kind: 'audio',
			contentJson: JSON.stringify({
				title: 'Studio Session 04 (Rough Bridge Mix)',
				duration: '03:42',
				body: 'Unreleased four-track bounce from our Greenpoint loft before loading the van. Needs more fuzz on the outro.'
			}),
			createdAt: now
		}
	]);

	// 5. Create 3-City Tour Issues
	const issue1Window = openSampleStampWindow(now);
	const issue1Id = crypto.randomUUID();
	await db.insert(schema.issues).values({
		id: issue1Id,
		artistId,
		slug: OPEN_WINDOW_SAMPLE_SLUG,
		city: 'Brooklyn',
		venue: "Baby's All Right",
		date: '2026-10-12',
		timezone: 'America/New_York',
		coverNote: 'Tour kickoff show! Playing the entire new record with extended fuzz jams.',
		secretKey: 'kickoff_babys_secret_2026',
		status: 'published',
		stampWindowStart: issue1Window.start,
		stampWindowEnd: issue1Window.end,
		approveFirst: false,
		publishedAt: new Date('2026-10-12T12:00:00Z'),
		createdAt: now,
		updatedAt: now
	});

	const issue2Window = calculateStampWindow('2026-10-15', 'America/New_York');
	const issue2Id = crypto.randomUUID();
	await db.insert(schema.issues).values({
		id: issue2Id,
		slug: 'neon-velvet-philly-2026-10-15',
		artistId,
		city: 'Philadelphia',
		venue: "Johnny Brenda's",
		date: '2026-10-15',
		timezone: 'America/New_York',
		coverNote: 'Balcony was shaking during the chorus. Fish & chips downstairs after the set.',
		secretKey: 'philly_jb_secret_2026',
		status: 'published',
		stampWindowStart: issue2Window.ok ? issue2Window.value.start : now,
		stampWindowEnd: issue2Window.ok ? issue2Window.value.end : now,
		approveFirst: false,
		publishedAt: new Date('2026-10-15T12:00:00Z'),
		createdAt: now,
		updatedAt: now
	});

	const issue3Window = calculateStampWindow('2026-10-18', 'America/New_York');
	const issue3Id = crypto.randomUUID();
	await db.insert(schema.issues).values({
		id: issue3Id,
		slug: 'neon-velvet-dc-2026-10-18',
		artistId,
		city: 'Washington, DC',
		venue: 'Black Cat',
		date: '2026-10-18',
		timezone: 'America/New_York',
		coverNote: 'Main stage tonight. Soundcheck sounded massive.',
		secretKey: 'dc_blackcat_secret_2026',
		status: 'published',
		stampWindowStart: issue3Window.ok ? issue3Window.value.start : now,
		stampWindowEnd: issue3Window.ok ? issue3Window.value.end : now,
		approveFirst: false,
		publishedAt: new Date('2026-10-18T12:00:00Z'),
		createdAt: now,
		updatedAt: now
	});

	// Bespoke Pages across all 3 issues
	await db.insert(schema.issuePages).values([
		{
			id: crypto.randomUUID(),
			issueId: issue1Id,
			position: 1,
			kind: 'setlist',
			contentJson: JSON.stringify({
				songs: [
					'Static Bloom',
					'Echoes on the Waterfront',
					'Velvet Wire',
					'Afterglow',
					'Subway Static (Encore)'
				]
			}),
			createdAt: now
		},
		{
			id: crypto.randomUUID(),
			issueId: issue1Id,
			position: 2,
			kind: 'photo',
			contentJson: JSON.stringify(
				photoPageContent({
					title: 'Tour Diary: Brooklyn Kickoff',
					body: 'Sold out the back room at Baby’s. You animals broke the barricade on song three.',
					photos: BROOKLYN_TOUR_DIARY_PHOTOS
				})
			),
			createdAt: now
		},
		{
			id: crypto.randomUUID(),
			issueId: issue2Id,
			position: 1,
			kind: 'setlist',
			contentJson: JSON.stringify({
				songs: [
					'Concrete Choir',
					'Static Bloom',
					'Fishtown Rain (Improv)',
					'Velvet Wire',
					'Night Bus to Girard'
				]
			}),
			createdAt: now
		},
		{
			id: crypto.randomUUID(),
			issueId: issue2Id,
			position: 2,
			kind: 'photo',
			contentJson: JSON.stringify(
				photoPageContent({
					title: 'Tour Diary: Philly Balcony',
					body: 'Three frames from Johnny Brenda’s, shot from the side of the stage between songs.',
					photos: PHILLY_TOUR_DIARY_PHOTOS
				})
			),
			createdAt: now
		},
		{
			id: crypto.randomUUID(),
			issueId: issue3Id,
			position: 1,
			kind: 'setlist',
			contentJson: JSON.stringify({
				songs: [
					'14th Street Hum',
					'Static Bloom',
					'Echoes on the Waterfront',
					'Red Room Synth Jam',
					'Subway Static (Extended)'
				]
			}),
			createdAt: now
		},
		{
			id: crypto.randomUUID(),
			issueId: issue3Id,
			position: 2,
			kind: 'text',
			contentJson: JSON.stringify({
				title: 'Late Night at Black Cat',
				body: 'Drove down I-95 through pouring rain, loaded the Rhodes up the freight elevator, and walked out to a packed floor. DC always shows up loud.'
			}),
			createdAt: now
		}
	]);

	// Tip taps (ADR 0008) across Gig 1, Gig 2, Gig 3 and the General Back Page.
	// Taps only: a Fan opened Venmo. They never represent money received.
	const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
	await db.insert(schema.tipTaps).values([
		{ id: crypto.randomUUID(), artistId, issueId: issue1Id, amountSelectedCents: 500, createdAt: hoursAgo(30) },
		{ id: crypto.randomUUID(), artistId, issueId: issue1Id, amountSelectedCents: 1000, createdAt: hoursAgo(29) },
		{ id: crypto.randomUUID(), artistId, issueId: issue1Id, amountSelectedCents: 300, createdAt: hoursAgo(28) },
		{ id: crypto.randomUUID(), artistId, issueId: issue2Id, amountSelectedCents: 500, createdAt: hoursAgo(20) },
		{ id: crypto.randomUUID(), artistId, issueId: issue2Id, amountSelectedCents: 500, createdAt: hoursAgo(19) },
		{ id: crypto.randomUUID(), artistId, issueId: issue3Id, amountSelectedCents: 1000, createdAt: hoursAgo(6) },
		{ id: crypto.randomUUID(), artistId, issueId: null, amountSelectedCents: 300, createdAt: hoursAgo(48) },
		{ id: crypto.randomUUID(), artistId, issueId: null, amountSelectedCents: 500, createdAt: hoursAgo(2) }
	]);

	// Tips across Gig 1, Gig 2, Gig 3, and General Back Page
	await db.insert(schema.tips).values([
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue1Id,
			amountGross: 1000,
			feeStripe: 59,
			feePlatform: 50,
			amountNet: 891,
			fanCoveredFees: false,
			stripePaymentId: 'pi_demo_seed_1',
			createdAt: new Date('2026-10-12T22:15:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue1Id,
			amountGross: 2500,
			feeStripe: 103,
			feePlatform: 125,
			amountNet: 2375,
			fanCoveredFees: true,
			stripePaymentId: 'pi_demo_seed_2',
			createdAt: new Date('2026-10-12T22:45:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue1Id,
			amountGross: 500,
			feeStripe: 45,
			feePlatform: 25,
			amountNet: 430,
			fanCoveredFees: false,
			stripePaymentId: 'pi_demo_seed_3',
			createdAt: new Date('2026-10-12T23:05:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue2Id,
			amountGross: 1500,
			feeStripe: 74,
			feePlatform: 75,
			amountNet: 1351,
			fanCoveredFees: false,
			stripePaymentId: 'pi_demo_seed_4',
			createdAt: new Date('2026-10-15T22:20:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue2Id,
			amountGross: 1000,
			feeStripe: 59,
			feePlatform: 50,
			amountNet: 891,
			fanCoveredFees: false,
			stripePaymentId: 'pi_demo_seed_5',
			createdAt: new Date('2026-10-15T23:10:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue3Id,
			amountGross: 2000,
			feeStripe: 88,
			feePlatform: 100,
			amountNet: 1812,
			fanCoveredFees: false,
			stripePaymentId: 'pi_demo_seed_6',
			createdAt: new Date('2026-10-18T22:10:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue3Id,
			amountGross: 1000,
			feeStripe: 59,
			feePlatform: 50,
			amountNet: 950,
			fanCoveredFees: true,
			stripePaymentId: 'pi_demo_seed_7',
			createdAt: new Date('2026-10-18T22:55:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: null,
			amountGross: 1000,
			feeStripe: 59,
			feePlatform: 50,
			amountNet: 891,
			fanCoveredFees: false,
			stripePaymentId: 'pi_demo_seed_general',
			createdAt: new Date('2026-10-19T14:00:00Z')
		}
	]);

	// Wall Notes & Replies
	const note1Id = crypto.randomUUID();
	const note2Id = crypto.randomUUID();
	const note3Id = crypto.randomUUID();
	const note4Id = crypto.randomUUID();
	const noteGeneralId = crypto.randomUUID();

	await db.insert(schema.notes).values([
		{
			id: note1Id,
			artistId,
			issueId: issue1Id,
			fanUserId: fan1Id,
			body: 'Best show you guys have ever played in Brooklyn! That bass fuzz was vibrating my chest.',
			status: 'live',
			flagCount: 0,
			flagImmune: false,
			createdAt: new Date('2026-10-12T23:20:00Z')
		},
		{
			id: note2Id,
			artistId,
			issueId: issue1Id,
			fanUserId: fan2Id,
			body: 'Came all the way from Jersey City for this kickoff. Worth every minute in traffic!',
			status: 'live',
			flagCount: 0,
			flagImmune: false,
			createdAt: new Date('2026-10-12T23:35:00Z')
		},
		{
			id: note3Id,
			artistId,
			issueId: issue2Id,
			fanUserId: fan2Id,
			body: 'Johnny Brenda’s upstairs room was electric tonight. Please press Fishtown Rain on 7-inch!',
			status: 'live',
			flagCount: 0,
			flagImmune: false,
			createdAt: new Date('2026-10-15T23:30:00Z')
		},
		{
			id: note4Id,
			artistId,
			issueId: issue3Id,
			fanUserId: fan1Id,
			body: 'Front row at Black Cat! The analog synth transition into Subway Static gave me chills.',
			status: 'live',
			flagCount: 0,
			flagImmune: false,
			createdAt: new Date('2026-10-18T23:15:00Z')
		},
		{
			id: noteGeneralId,
			artistId,
			issueId: null,
			fanUserId: fan3Id,
			body: 'Spinning the Bandcamp cassette nonstop in Boston—come north on the winter leg!',
			status: 'live',
			flagCount: 0,
			flagImmune: false,
			createdAt: new Date('2026-10-19T12:00:00Z')
		}
	]);

	await db.insert(schema.noteReplies).values({
		id: crypto.randomUUID(),
		noteId: note1Id,
		artistId,
		body: 'Thank you Maya! We dialled in the fuzz pedalboard just for this room. See you at the merch table!',
		createdAt: new Date('2026-10-12T23:40:00Z')
	});

	// Stamped & Saved Collections across all 3 issues
	await db.insert(schema.collections).values([
		{
			id: crypto.randomUUID(),
			fanUserId: fan1Id,
			issueId: issue1Id,
			kind: 'stamped',
			createdAt: new Date('2026-10-12T21:45:00Z')
		},
		{
			id: crypto.randomUUID(),
			fanUserId: fan2Id,
			issueId: issue1Id,
			kind: 'stamped',
			createdAt: new Date('2026-10-12T22:00:00Z')
		},
		{
			id: crypto.randomUUID(),
			fanUserId: fan3Id,
			issueId: issue1Id,
			kind: 'saved',
			createdAt: new Date('2026-10-13T10:00:00Z')
		},
		{
			id: crypto.randomUUID(),
			fanUserId: fan2Id,
			issueId: issue2Id,
			kind: 'stamped',
			createdAt: new Date('2026-10-15T21:50:00Z')
		},
		{
			id: crypto.randomUUID(),
			fanUserId: fan1Id,
			issueId: issue3Id,
			kind: 'stamped',
			createdAt: new Date('2026-10-18T21:30:00Z')
		},
		{
			id: crypto.randomUUID(),
			fanUserId: fan2Id,
			issueId: issue3Id,
			kind: 'stamped',
			createdAt: new Date('2026-10-18T21:45:00Z')
		},
		{
			id: crypto.randomUUID(),
			fanUserId: fan3Id,
			issueId: issue3Id,
			kind: 'saved',
			createdAt: new Date('2026-10-18T23:50:00Z')
		}
	]);

	console.log('Seeding complete: "The Neon Velvet" 3-city tour ready!');
	return { artistId, artistUserId };
}

async function ensureArtistPasswordCredential(userId: string) {
	const existingAccount = await db.query.accounts.findFirst({
		where: and(
			eq(schema.accounts.userId, userId),
			eq(schema.accounts.providerId, 'credential')
		)
	});
	if (!existingAccount) {
		const now = new Date();
		const hashedPassword = await hashPassword('neonvelvet123');
		await db.insert(schema.accounts).values({
			id: crypto.randomUUID(),
			accountId: userId,
			providerId: 'credential',
			userId,
			password: hashedPassword,
			createdAt: now,
			updatedAt: now
		});
	}
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('seed.ts')) {
	seedDatabase()
		.then(() => process.exit(0))
		.catch((e) => {
			console.error(e);
			process.exit(1);
		});
}
