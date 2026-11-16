import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

/**
 * Better Auth Tables (Extended with accountType)
 */
export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
	image: text('image'),
	accountType: text('account_type', { enum: ['artist', 'fan'] }).default('fan').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const accounts = sqliteTable('accounts', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	expiresAt: integer('expires_at', { mode: 'timestamp' }),
	accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const verifications = sqliteTable('verifications', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
});

/**
 * Quire Domain Entities
 */
export const artists = sqliteTable('artists', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	slug: text('slug').notNull().unique(),
	displayName: text('display_name').notNull(),
	bio: text('bio').default(''),
	coverArtUrl: text('cover_art_url'),
	accentColor: text('accent_color').default('#05D9E8').notNull(),
	typePairing: text('type_pairing').default('sans-serif').notNull(),
	tipPresetsJson: text('tip_presets_json').default('[3, 5, 10, 20]').notNull(),
	linksJson: text('links_json').default('[]').notNull(),
	stripeAccountId: text('stripe_account_id'),
	payoutsEnabled: integer('payouts_enabled', { mode: 'boolean' }).default(false).notNull(),
	verified: integer('verified', { mode: 'boolean' }).default(false).notNull(),
	generalWallApproveFirst: integer('general_wall_approve_first', { mode: 'boolean' }).default(false).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const templatePages = sqliteTable('template_pages', {
	id: text('id').primaryKey(),
	artistId: text('artist_id')
		.notNull()
		.references(() => artists.id, { onDelete: 'cascade' }),
	position: integer('position').notNull(),
	kind: text('kind').notNull(),
	contentJson: text('content_json').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const issues = sqliteTable('issues', {
	id: text('id').primaryKey(),
	artistId: text('artist_id')
		.notNull()
		.references(() => artists.id, { onDelete: 'cascade' }),
	slug: text('slug').notNull().unique(),
	city: text('city').notNull(),
	venue: text('venue').notNull(),
	date: text('date').notNull(), // YYYY-MM-DD
	timezone: text('timezone').default('America/New_York').notNull(),
	coverNote: text('cover_note').default('').notNull(),
	secretKey: text('secret_key').notNull(),
	status: text('status', { enum: ['draft', 'published', 'cancelled', 'archived'] })
		.default('draft')
		.notNull(),
	stampWindowStart: integer('stamp_window_start', { mode: 'timestamp' }),
	stampWindowEnd: integer('stamp_window_end', { mode: 'timestamp' }),
	approveFirst: integer('approve_first', { mode: 'boolean' }).default(false).notNull(),
	publishedAt: integer('published_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const issuePages = sqliteTable('issue_pages', {
	id: text('id').primaryKey(),
	issueId: text('issue_id')
		.notNull()
		.references(() => issues.id, { onDelete: 'cascade' }),
	position: integer('position').notNull(),
	kind: text('kind').notNull(),
	contentJson: text('content_json').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const tips = sqliteTable('tips', {
	id: text('id').primaryKey(),
	artistId: text('artist_id')
		.notNull()
		.references(() => artists.id, { onDelete: 'cascade' }),
	issueId: text('issue_id').references(() => issues.id, { onDelete: 'set null' }),
	amountGross: integer('amount_gross').notNull(), // in cents
	feeStripe: integer('fee_stripe').notNull(), // in cents
	feePlatform: integer('fee_platform').notNull(), // in cents
	amountNet: integer('amount_net').notNull(), // in cents
	fanCoveredFees: integer('fan_covered_fees', { mode: 'boolean' }).default(false).notNull(),
	stripePaymentId: text('stripe_payment_id').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const notes = sqliteTable('notes', {
	id: text('id').primaryKey(),
	artistId: text('artist_id')
		.notNull()
		.references(() => artists.id, { onDelete: 'cascade' }),
	issueId: text('issue_id').references(() => issues.id, { onDelete: 'set null' }),
	fanUserId: text('fan_user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	body: text('body').notNull(),
	status: text('status', { enum: ['live', 'pending', 'hidden'] })
		.default('live')
		.notNull(),
	flagCount: integer('flag_count').default(0).notNull(),
	flagImmune: integer('flag_immune', { mode: 'boolean' }).default(false).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const noteReplies = sqliteTable('note_replies', {
	id: text('id').primaryKey(),
	noteId: text('note_id')
		.notNull()
		.unique()
		.references(() => notes.id, { onDelete: 'cascade' }),
	artistId: text('artist_id')
		.notNull()
		.references(() => artists.id, { onDelete: 'cascade' }),
	body: text('body').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const noteFlags = sqliteTable('note_flags', {
	id: text('id').primaryKey(),
	noteId: text('note_id')
		.notNull()
		.references(() => notes.id, { onDelete: 'cascade' }),
	fanUserId: text('fan_user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const blocks = sqliteTable('blocks', {
	id: text('id').primaryKey(),
	artistId: text('artist_id')
		.notNull()
		.references(() => artists.id, { onDelete: 'cascade' }),
	fanUserId: text('fan_user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const collections = sqliteTable('collections', {
	id: text('id').primaryKey(),
	fanUserId: text('fan_user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	issueId: text('issue_id')
		.notNull()
		.references(() => issues.id, { onDelete: 'cascade' }),
	kind: text('kind', { enum: ['saved', 'stamped'] }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const scans = sqliteTable('scans', {
	id: text('id').primaryKey(),
	issueId: text('issue_id')
		.notNull()
		.references(() => issues.id, { onDelete: 'cascade' }),
	tokenHash: text('token_hash').notNull(),
	scannedAt: integer('scanned_at', { mode: 'timestamp' }).notNull()
});

/**
 * Drizzle Relations Definitions
 */
export const usersRelations = relations(users, ({ many }) => ({
	artists: many(artists),
	notes: many(notes),
	collections: many(collections)
}));

export const artistsRelations = relations(artists, ({ one, many }) => ({
	user: one(users, {
		fields: [artists.userId],
		references: [users.id]
	}),
	issues: many(issues),
	templatePages: many(templatePages),
	tips: many(tips),
	notes: many(notes)
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
	artist: one(artists, {
		fields: [issues.artistId],
		references: [artists.id]
	}),
	issuePages: many(issuePages),
	tips: many(tips),
	notes: many(notes),
	collections: many(collections),
	scans: many(scans)
}));

export const issuePagesRelations = relations(issuePages, ({ one }) => ({
	issue: one(issues, {
		fields: [issuePages.issueId],
		references: [issues.id]
	})
}));

export const templatePagesRelations = relations(templatePages, ({ one }) => ({
	artist: one(artists, {
		fields: [templatePages.artistId],
		references: [artists.id]
	})
}));

export const tipsRelations = relations(tips, ({ one }) => ({
	artist: one(artists, {
		fields: [tips.artistId],
		references: [artists.id]
	}),
	issue: one(issues, {
		fields: [tips.issueId],
		references: [issues.id]
	})
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
	artist: one(artists, {
		fields: [notes.artistId],
		references: [artists.id]
	}),
	issue: one(issues, {
		fields: [notes.issueId],
		references: [issues.id]
	}),
	author: one(users, {
		fields: [notes.fanUserId],
		references: [users.id]
	}),
	replies: many(noteReplies),
	flags: many(noteFlags)
}));

export const noteRepliesRelations = relations(noteReplies, ({ one }) => ({
	note: one(notes, {
		fields: [noteReplies.noteId],
		references: [notes.id]
	}),
	artist: one(artists, {
		fields: [noteReplies.artistId],
		references: [artists.id]
	})
}));

export const noteFlagsRelations = relations(noteFlags, ({ one }) => ({
	note: one(notes, {
		fields: [noteFlags.noteId],
		references: [notes.id]
	}),
	fanUser: one(users, {
		fields: [noteFlags.fanUserId],
		references: [users.id]
	})
}));

export const collectionsRelations = relations(collections, ({ one }) => ({
	fan: one(users, {
		fields: [collections.fanUserId],
		references: [users.id]
	}),
	issue: one(issues, {
		fields: [collections.issueId],
		references: [issues.id]
	})
}));

export const scansRelations = relations(scans, ({ one }) => ({
	issue: one(issues, {
		fields: [scans.issueId],
		references: [issues.id]
	})
}));
