ALTER TABLE `entities` ADD `market_profile` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX `entities_owner_kind` ON `entities` (`owner_id`,`kind`);