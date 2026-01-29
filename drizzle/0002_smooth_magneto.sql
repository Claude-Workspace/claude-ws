CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `attempts` ADD `output_format` text;--> statement-breakpoint
ALTER TABLE `attempts` ADD `output_schema` text;