import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

/**
 * Better Auth Tables (Extended with accountType)
 */
export const users = sqliteTable(
	'users',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull().unique(),
		emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
		image: text('image'),
		accountType: text('account_type', { enum: ['artist', 'fan'] }).default('fan').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [index('users_account_type_idx').on(table.accountType)]
);

export const sessions = sqliteTable(
	'sessions',
	{
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
	},
	(table) => [
		index('sessions_user_id_idx').on(table.userId),
		index('sessions_expires_at_idx').on(table.expiresAt)
	]
);

export const accounts = sqliteTable(
	'accounts',
	{
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
	},
	(table) => [
		index('accounts_user_id_idx').on(table.userId),
		uniqueIndex('accounts_provider_account_unique').on(table.providerId, table.accountId)
	]
);

export const verifications = sqliteTable(
	'verifications',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
	},
	(table) => [
		index('verifications_identifier_idx').on(table.identifier),
		index('verifications_expires_at_idx').on(table.expiresAt)
	]
);

/**
 * Quire Domain Entities
 */
export const artists = sqliteTable(
	'artists',
	{
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
		tipPresetsJson: text('tip_presets_json').default('[3, 5, 10]').notNull(),
		linksJson: text('links_json').default('[]').notNull(),
		stripeAccountId: text('stripe_account_id'),
		payoutsEnabled: integer('payouts_enabled', { mode: 'boolean' }).default(false).notNull(),
		verified: integer('verified', { mode: 'boolean' }).default(false).notNull(),
		generalWallApproveFirst: integer('general_wall_approve_first', { mode: 'boolean' })
			.default(false)
			.notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('artists_user_id_idx').on(table.userId),
		index('artists_stripe_account_id_idx').on(table.stripeAccountId)
	]
);

/**
 * Payout account change confirmation tokens (SPEC Section 6.4):
 * Changing the payout account requires re-entering the password and confirming by email.
 */
export const payoutChangeTokens = sqliteTable(
	'payout_change_tokens',
	{
		id: text('id').primaryKey(),
		artistId: text('artist_id')
			.notNull()
			.references(() => artists.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull().unique(),
		action: text('action', { enum: ['connect', 'replace', 'disconnect'] })
			.default('connect')
			.notNull(),
		targetStripeAccountId: text('target_stripe_account_id'),
		status: text('status', { enum: ['pending', 'confirmed', 'expired', 'cancelled'] })
			.default('pending')
			.notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('payout_change_tokens_artist_status_idx').on(table.artistId, table.status),
		index('payout_change_tokens_expires_at_idx').on(table.expiresAt)
	]
);

export const PAGE_KINDS = [
	'text',
	'image',
	'photo',
	'audio',
	'video',
	'setlist',
	'bespoke'
] as const;

export const templatePages = sqliteTable(
	'template_pages',
	{
		id: text('id').primaryKey(),
		artistId: text('artist_id')
			.notNull()
			.references(() => artists.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		kind: text('kind', { enum: PAGE_KINDS }).notNull(),
		contentJson: text('content_json').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [index('template_pages_artist_position_idx').on(table.artistId, table.position)]
);

export const issues = sqliteTable(
	'issues',
	{
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
		archivedAt: integer('archived_at', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('issues_artist_status_idx').on(table.artistId, table.status),
		index('issues_artist_date_idx').on(table.artistId, table.date)
	]
);

export const issuePages = sqliteTable(
	'issue_pages',
	{
		id: text('id').primaryKey(),
		issueId: text('issue_id')
			.notNull()
			.references(() => issues.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		kind: text('kind', { enum: PAGE_KINDS }).notNull(),
		contentJson: text('content_json').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [index('issue_pages_issue_position_idx').on(table.issueId, table.position)]
);

export const tips = sqliteTable(
	'tips',
	{
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
		stripePaymentId: text('stripe_payment_id').notNull().unique(),
		status: text('status', { enum: ['succeeded', 'refunded', 'disputed'] })
			.default('succeeded')
			.notNull(),
		refundedAt: integer('refunded_at', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('tips_artist_created_idx').on(table.artistId, table.createdAt),
		index('tips_issue_id_idx').on(table.issueId),
		index('tips_status_idx').on(table.status)
	]
);

export const notes = sqliteTable(
	'notes',
	{
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
	},
	(table) => [
		index('notes_artist_status_created_idx').on(table.artistId, table.status, table.createdAt),
		index('notes_issue_status_idx').on(table.issueId, table.status),
		index('notes_fan_user_id_idx').on(table.fanUserId)
	]
);

export const noteReplies = sqliteTable(
	'note_replies',
	{
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
	},
	(table) => [index('note_replies_artist_id_idx').on(table.artistId)]
);

export const noteFlags = sqliteTable(
	'note_flags',
	{
		id: text('id').primaryKey(),
		noteId: text('note_id')
			.notNull()
			.references(() => notes.id, { onDelete: 'cascade' }),
		fanUserId: text('fan_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [uniqueIndex('note_flags_note_fan_unique').on(table.noteId, table.fanUserId)]
);

export const blocks = sqliteTable(
	'blocks',
	{
		id: text('id').primaryKey(),
		artistId: text('artist_id')
			.notNull()
			.references(() => artists.id, { onDelete: 'cascade' }),
		fanUserId: text('fan_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [uniqueIndex('blocks_artist_fan_unique').on(table.artistId, table.fanUserId)]
);

export const collections = sqliteTable(
	'collections',
	{
		id: text('id').primaryKey(),
		fanUserId: text('fan_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		issueId: text('issue_id')
			.notNull()
			.references(() => issues.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['saved', 'stamped'] }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		uniqueIndex('collections_fan_issue_unique').on(table.fanUserId, table.issueId),
		index('collections_issue_kind_idx').on(table.issueId, table.kind)
	]
);

export const scans = sqliteTable(
	'scans',
	{
		id: text('id').primaryKey(),
		issueId: text('issue_id')
			.notNull()
			.references(() => issues.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull(),
		scannedAt: integer('scanned_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('scans_token_hash_idx').on(table.tokenHash),
		index('scans_issue_scanned_idx').on(table.issueId, table.scannedAt)
	]
);

/**
 * Drizzle Relations Definitions
 */
export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
	artists: many(artists),
	notes: many(notes),
	noteFlags: many(noteFlags),
	blocks: many(blocks),
	collections: many(collections),
	payoutChangeTokens: many(payoutChangeTokens)
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	})
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	})
}));

export const artistsRelations = relations(artists, ({ one, many }) => ({
	user: one(users, {
		fields: [artists.userId],
		references: [users.id]
	}),
	issues: many(issues),
	templatePages: many(templatePages),
	tips: many(tips),
	notes: many(notes),
	noteReplies: many(noteReplies),
	blocks: many(blocks),
	payoutChangeTokens: many(payoutChangeTokens)
}));

export const payoutChangeTokensRelations = relations(payoutChangeTokens, ({ one }) => ({
	artist: one(artists, {
		fields: [payoutChangeTokens.artistId],
		references: [artists.id]
	}),
	user: one(users, {
		fields: [payoutChangeTokens.userId],
		references: [users.id]
	})
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

export const blocksRelations = relations(blocks, ({ one }) => ({
	artist: one(artists, {
		fields: [blocks.artistId],
		references: [artists.id]
	}),
	fanUser: one(users, {
		fields: [blocks.fanUserId],
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
