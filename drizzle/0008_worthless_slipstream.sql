CREATE TABLE `shares` (
	`token` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`board_id` text NOT NULL,
	`title` text NOT NULL,
	`created` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`last_viewed` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shares_owner_board` ON `shares` (`owner_id`,`board_id`);