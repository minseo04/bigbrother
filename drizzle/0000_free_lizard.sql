CREATE TABLE `briefings` (
	`owner_id` text NOT NULL,
	`date` text NOT NULL,
	`content` text NOT NULL,
	`updated` text NOT NULL,
	PRIMARY KEY(`owner_id`, `date`)
);
--> statement-breakpoint
CREATE TABLE `connections` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`label` text NOT NULL,
	`evidence` text NOT NULL,
	`url` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`kind` text NOT NULL,
	`initials` text NOT NULL,
	`description` text NOT NULL,
	`aliases` text NOT NULL,
	`followed` integer DEFAULT 1 NOT NULL,
	`source` text NOT NULL,
	`color` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entities_owner_name` ON `entities` (`owner_id`,`name_key`);--> statement-breakpoint
CREATE TABLE `settings` (
	`owner_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`owner_id`, `key`)
);
