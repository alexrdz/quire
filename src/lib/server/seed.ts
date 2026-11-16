import crypto from 'node:crypto';
import { db, schema } from './db';
import { eq } from 'drizzle-orm';
import { calculateStampWindow } from '$domain/stamping';

export async function seedDatabase() {
	console.log('🌱 Seeding Quire database...');

	// Check if already seeded
	const existingArtist = await db.query.artists.findFirst({
		where: eq(schema.artists.slug, 'the-neon-velvet')
	});

	if (existingArtist) {
		console.log('✓ Database already seeded with "The Neon Velvet"');
		return existingArtist;
	}

	const now = new Date();

	// 1. Create Demo Artist User
	const artistUserId = crypto.randomUUID();
	await db.insert(schema.users).values({
		id: artistUserId,
		name: 'The Neon Velvet',
		email: 'demo@neonvelvet.band',
		emailVerified: true,
		accountType: 'artist',
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
		coverArtUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=1200',
		accentColor: '#05D9E8',
		typePairing: 'sans-serif',
		tipPresetsJson: '[3, 5, 10, 25]',
		linksJson: JSON.stringify([
			{ label: 'Bandcamp', url: 'https://bandcamp.com' },
			{ label: 'Tour Tickets', url: 'https://dice.fm' },
			{ label: 'Vinyl Merch', url: 'https://hellomerch.com' }
		]),
		stripeAccountId: 'acct_demo_neon_velvet',
		payoutsEnabled: true,
		verified: true,
		generalWallApproveFirst: false,
		createdAt: now,
		updatedAt: now
	});

	// 4. Create Master Template Pages
	await db.insert(schema.templatePages).values({
		id: crypto.randomUUID(),
		artistId,
		position: 1,
		kind: 'text',
		contentJson: JSON.stringify({
			body: 'The Neon Velvet was born in damp rehearsal basements across Greenpoint. We believe physical presence and shared vibrations outlast algorithmic feeds.'
		}),
		createdAt: now
	});

	// 5. Create 3-City Tour Issues
	// Gig 1: Brooklyn, NY (Baby's All Right)
	const issue1Window = calculateStampWindow('2026-10-12', 'America/New_York');
	const issue1Id = crypto.randomUUID();
	await db.insert(schema.issues).values({
		id: issue1Id,
		artistId,
		slug: 'neon-velvet-brooklyn-2026-10-12',
		city: 'Brooklyn',
		venue: "Baby's All Right",
		date: '2026-10-12',
		timezone: 'America/New_York',
		coverNote: 'Tour kickoff show! Playing the entire new record with extended fuzz jams.',
		secretKey: 'kickoff_babys_secret_2026',
		status: 'published',
		stampWindowStart: issue1Window.ok ? issue1Window.value.start : now,
		stampWindowEnd: issue1Window.ok ? issue1Window.value.end : now,
		approveFirst: false,
		publishedAt: new Date('2026-10-12T12:00:00Z'),
		createdAt: now,
		updatedAt: now
	});

	// Gig 2: Philadelphia, PA (Johnny Brenda's)
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

	// Gig 3: Washington, DC (Black Cat)
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

	// Bespoke Setlists
	await db.insert(schema.issuePages).values({
		id: crypto.randomUUID(),
		issueId: issue1Id,
		position: 1,
		kind: 'setlist',
		contentJson: JSON.stringify({
			songs: ['Static Bloom', 'Echoes on the Waterfront', 'Velvet Wire', 'Afterglow', 'Subway Static (Encore)']
		}),
		createdAt: now
	});

	// Tips for Gig 1
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
		}
	]);

	// Wall Notes & Replies for Gig 1
	const note1Id = crypto.randomUUID();
	await db.insert(schema.notes).values({
		id: note1Id,
		artistId,
		issueId: issue1Id,
		fanUserId: fan1Id,
		body: 'Best show you guys have ever played in Brooklyn! That bass fuzz was vibrating my chest.',
		status: 'live',
		flagCount: 0,
		flagImmune: false,
		createdAt: new Date('2026-10-12T23:20:00Z')
	});

	await db.insert(schema.noteReplies).values({
		id: crypto.randomUUID(),
		noteId: note1Id,
		artistId,
		body: 'Thank you Maya! We dialled in the fuzz pedalboard just for this room. See you at the merch table!',
		createdAt: new Date('2026-10-12T23:40:00Z')
	});

	const note2Id = crypto.randomUUID();
	await db.insert(schema.notes).values({
		id: note2Id,
		artistId,
		issueId: issue1Id,
		fanUserId: fan2Id,
		body: 'Came all the way from Jersey City for this kickoff. Worth every minute in traffic!',
		status: 'live',
		flagCount: 0,
		flagImmune: false,
		createdAt: new Date('2026-10-12T23:35:00Z')
	});

	// Stamped Collections
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
		}
	]);

	console.log('✅ Seeding complete: "The Neon Velvet" 3-city tour ready!');
	return { artistId, artistUserId };
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
