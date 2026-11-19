CREATE TABLE `tip_taps` (
	`id` text PRIMARY KEY NOT NULL,
	`artist_id` text NOT NULL,
	`issue_id` text,
	`amount_selected_cents` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tip_taps_artist_issue_idx` ON `tip_taps` (`artist_id`,`issue_id`);--> statement-breakpoint
CREATE TABLE `venmo_change_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`artist_id` text NOT NULL,
	`new_username` text,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venmo_change_tokens_token_hash_unique` ON `venmo_change_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `venmo_change_tokens_artist_idx` ON `venmo_change_tokens` (`artist_id`);--> statement-breakpoint
CREATE INDEX `venmo_change_tokens_expires_at_idx` ON `venmo_change_tokens` (`expires_at`);--> statement-breakpoint
ALTER TABLE `artists` ADD `venmo_username` text;