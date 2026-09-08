CREATE TABLE `board_nodes` (
	`owner_id` text NOT NULL,
	`board_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	PRIMARY KEY(`owner_id`, `board_id`, `entity_id`)
);
--> statement-breakpoint
CREATE INDEX `board_nodes_owner_board` ON `board_nodes` (`owner_id`,`board_id`);--> statement-breakpoint
CREATE TABLE `boards` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`pattern` text DEFAULT 'dots' NOT NULL,
	`pattern_color` text DEFAULT '#2e3c48' NOT NULL,
	`surface` text DEFAULT '#131d26' NOT NULL,
	`gap` integer DEFAULT 22 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `boards_owner_sort` ON `boards` (`owner_id`,`sort`);