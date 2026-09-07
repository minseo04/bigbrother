CREATE TABLE `article_entities` (
	`owner_id` text NOT NULL,
	`article_id` text NOT NULL,
	`entity_id` text NOT NULL,
	PRIMARY KEY(`owner_id`, `article_id`, `entity_id`)
);
--> statement-breakpoint
CREATE INDEX `article_entities_owner_entity` ON `article_entities` (`owner_id`,`entity_id`);--> statement-breakpoint
CREATE TABLE `articles` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`source` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`published` text NOT NULL,
	`first_seen` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `articles_owner_published` ON `articles` (`owner_id`,`published`);