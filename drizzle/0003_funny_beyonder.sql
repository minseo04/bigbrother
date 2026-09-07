CREATE TABLE `notes` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `notes_owner_target` ON `notes` (`owner_id`,`target_kind`,`target_id`);