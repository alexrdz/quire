CREATE TABLE `payout_change_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`artist_id` text NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`action` text DEFAULT 'connect' NOT NULL,
	`target_stripe_account_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`confirmed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payout_change_tokens_token_hash_unique` ON `payout_change_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `payout_change_tokens_artist_status_idx` ON `payout_change_tokens` (`artist_id`,`status`);--> statement-breakpoint
CREATE INDEX `payout_change_tokens_expires_at_idx` ON `payout_change_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `slug_petitions` (
	`id` text PRIMARY KEY NOT NULL,
	`requested_slug` text NOT NULL,
	`existing_artist_id` text NOT NULL,
	`existing_artist_closed` integer DEFAULT false NOT NULL,
	`petitioner_name` text NOT NULL,
	`petitioner_email` text NOT NULL,
	`evidence_url` text,
	`rationale` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`existing_artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `slug_petitions_slug_status_idx` ON `slug_petitions` (`requested_slug`,`status`);--> statement-breakpoint
CREATE INDEX `slug_petitions_artist_idx` ON `slug_petitions` (`existing_artist_id`);--> statement-breakpoint
CREATE INDEX `slug_petitions_email_idx` ON `slug_petitions` (`petitioner_email`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_artists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text DEFAULT '',
	`cover_art_url` text,
	`accent_color` text DEFAULT '#05D9E8' NOT NULL,
	`type_pairing` text DEFAULT 'sans-serif' NOT NULL,
	`tip_presets_json` text DEFAULT '[3, 5, 10]' NOT NULL,
	`links_json` text DEFAULT '[]' NOT NULL,
	`stripe_account_id` text,
	`payouts_enabled` integer DEFAULT false NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`general_wall_approve_first` integer DEFAULT false NOT NULL,
	`account_status` text DEFAULT 'active' NOT NULL,
	`closed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_artists`("id", "user_id", "slug", "display_name", "bio", "cover_art_url", "accent_color", "type_pairing", "tip_presets_json", "links_json", "stripe_account_id", "payouts_enabled", "verified", "general_wall_approve_first", "created_at", "updated_at") SELECT "id", "user_id", "slug", "display_name", "bio", "cover_art_url", "accent_color", "type_pairing", "tip_presets_json", "links_json", "stripe_account_id", "payouts_enabled", "verified", "general_wall_approve_first", "created_at", "updated_at" FROM `artists`;--> statement-breakpoint
DROP TABLE `artists`;--> statement-breakpoint
ALTER TABLE `__new_artists` RENAME TO `artists`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `artists_slug_unique` ON `artists` (`slug`);--> statement-breakpoint
CREATE INDEX `artists_user_id_idx` ON `artists` (`user_id`);--> statement-breakpoint
CREATE INDEX `artists_stripe_account_id_idx` ON `artists` (`stripe_account_id`);--> statement-breakpoint
CREATE INDEX `artists_account_status_idx` ON `artists` (`account_status`);--> statement-breakpoint
ALTER TABLE `issues` ADD `archived_at` integer;--> statement-breakpoint
CREATE INDEX `issues_artist_status_idx` ON `issues` (`artist_id`,`status`);--> statement-breakpoint
CREATE INDEX `issues_artist_date_idx` ON `issues` (`artist_id`,`date`);--> statement-breakpoint
ALTER TABLE `tips` ADD `status` text DEFAULT 'succeeded' NOT NULL;--> statement-breakpoint
ALTER TABLE `tips` ADD `refunded_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `tips_stripe_payment_id_unique` ON `tips` (`stripe_payment_id`);--> statement-breakpoint
CREATE INDEX `tips_artist_created_idx` ON `tips` (`artist_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `tips_issue_id_idx` ON `tips` (`issue_id`);--> statement-breakpoint
CREATE INDEX `tips_status_idx` ON `tips` (`status`);--> statement-breakpoint
CREATE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_provider_account_unique` ON `accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `blocks_artist_fan_unique` ON `blocks` (`artist_id`,`fan_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `collections_fan_issue_unique` ON `collections` (`fan_user_id`,`issue_id`);--> statement-breakpoint
CREATE INDEX `collections_issue_kind_idx` ON `collections` (`issue_id`,`kind`);--> statement-breakpoint
CREATE INDEX `issue_pages_issue_position_idx` ON `issue_pages` (`issue_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `note_flags_note_fan_unique` ON `note_flags` (`note_id`,`fan_user_id`);--> statement-breakpoint
CREATE INDEX `note_replies_artist_id_idx` ON `note_replies` (`artist_id`);--> statement-breakpoint
CREATE INDEX `notes_artist_status_created_idx` ON `notes` (`artist_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `notes_issue_status_idx` ON `notes` (`issue_id`,`status`);--> statement-breakpoint
CREATE INDEX `notes_fan_user_id_idx` ON `notes` (`fan_user_id`);--> statement-breakpoint
CREATE INDEX `scans_token_hash_idx` ON `scans` (`token_hash`);--> statement-breakpoint
CREATE INDEX `scans_issue_scanned_idx` ON `scans` (`issue_id`,`scanned_at`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `template_pages_artist_position_idx` ON `template_pages` (`artist_id`,`position`);--> statement-breakpoint
CREATE INDEX `users_account_type_idx` ON `users` (`account_type`);--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);--> statement-breakpoint
CREATE INDEX `verifications_expires_at_idx` ON `verifications` (`expires_at`);