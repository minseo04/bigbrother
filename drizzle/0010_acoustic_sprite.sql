CREATE TABLE `board_access` (
	`owner_id` text NOT NULL,
	`board_id` text NOT NULL,
	`person_id` text NOT NULL,
	`role` text NOT NULL,
	`added` text NOT NULL,
	PRIMARY KEY(`owner_id`, `board_id`, `person_id`)
);
--> statement-breakpoint
CREATE INDEX `board_access_person` ON `board_access` (`person_id`);--> statement-breakpoint
CREATE TABLE `connection_sources` (
	`owner_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`url` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`contributor` text DEFAULT '' NOT NULL,
	`added` text NOT NULL,
	PRIMARY KEY(`owner_id`, `connection_id`, `url`)
);
--> statement-breakpoint
CREATE TABLE `contributions` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`board_id` text NOT NULL,
	`kind` text NOT NULL,
	`target_id` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`evidence_url` text DEFAULT '' NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`contributor` text NOT NULL,
	`contributor_label` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created` text NOT NULL,
	`decided` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `contributions_owner_box` ON `contributions` (`owner_id`,`board_id`,`kind`,`status`,`created`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT 'handle_only' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_handle` ON `profiles` (`handle`);--> statement-breakpoint
ALTER TABLE `boards` ADD `visibility` text DEFAULT 'link' NOT NULL;--> statement-breakpoint
ALTER TABLE `boards` ADD `proposal_audience` text DEFAULT 'none' NOT NULL;