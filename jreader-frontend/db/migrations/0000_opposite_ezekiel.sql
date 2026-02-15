CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expression` text NOT NULL,
	`reading` text,
	`definitions` text NOT NULL,
	`sentence` text,
	`pitch_accent` text,
	`frequency` text,
	`expression_audio` text,
	`document_title` text,
	`anki_note_id` text,
	`anki_model` text,
	`anki_deck` text,
	`sync_status` text DEFAULT 'local_only' NOT NULL,
	`synced_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dictionary_index` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`revision` text NOT NULL,
	`type` text NOT NULL,
	`has_images` integer DEFAULT false,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kanji_state` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kanji` text NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `table_of_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_id` text NOT NULL,
	`label` text NOT NULL,
	`content_src` text NOT NULL,
	`play_order` integer NOT NULL,
	`page_number` integer NOT NULL,
	FOREIGN KEY (`upload_id`) REFERENCES `user_uploads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`term_order` text DEFAULT '' NOT NULL,
	`term_disabled` text DEFAULT '' NOT NULL,
	`term_spoiler` text DEFAULT '' NOT NULL,
	`freq_order` text DEFAULT '' NOT NULL,
	`freq_disabled` text DEFAULT '' NOT NULL,
	`kanji_highlighting_enabled` integer DEFAULT true,
	`show_known_kanji` integer DEFAULT true,
	`show_encountered_kanji` integer DEFAULT true,
	`show_unknown_kanji` integer DEFAULT true,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text,
	`author` text,
	`directory_name` text NOT NULL,
	`total_pages` integer NOT NULL,
	`cover_path` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_webnovel` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`webnovel_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`webnovel_id`) REFERENCES `webnovel`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`tier` integer DEFAULT 0 NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `webnovel` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`url` text NOT NULL,
	`source` text NOT NULL,
	`directory_name` text NOT NULL,
	`total_pages` integer NOT NULL,
	`cover_path` text,
	`syosetu_metadata` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webnovel_url_unique` ON `webnovel` (`url`);