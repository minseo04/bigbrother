ALTER TABLE `boards` ADD `image` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `boards` ADD `image_fit` text DEFAULT 'cover' NOT NULL;--> statement-breakpoint
ALTER TABLE `entities` ADD `image` text DEFAULT '' NOT NULL;