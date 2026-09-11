CREATE TABLE `entity_attributes` (
	`owner_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`origin` text DEFAULT 'owner' NOT NULL,
	`contributor` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL,
	PRIMARY KEY(`owner_id`, `entity_id`, `key`)
);
--> statement-breakpoint
CREATE INDEX `entity_attributes_owner_key` ON `entity_attributes` (`owner_id`,`key`);