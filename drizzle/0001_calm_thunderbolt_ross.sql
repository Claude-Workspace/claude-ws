PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`prompt` text NOT NULL,
	`display_prompt` text,
	`status` text DEFAULT 'running' NOT NULL,
	`session_id` text,
	`branch` text,
	`diff_additions` integer DEFAULT 0 NOT NULL,
	`diff_deletions` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cache_creation_tokens` integer DEFAULT 0 NOT NULL,
	`cache_read_tokens` integer DEFAULT 0 NOT NULL,
	`total_cost_usd` text DEFAULT '0' NOT NULL,
	`num_turns` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`context_used` integer DEFAULT 0 NOT NULL,
	`context_limit` integer DEFAULT 200000 NOT NULL,
	`context_percentage` integer DEFAULT 0 NOT NULL,
	`baseline_context` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_attempts`("id", "task_id", "prompt", "display_prompt", "status", "session_id", "branch", "diff_additions", "diff_deletions", "total_tokens", "input_tokens", "output_tokens", "cache_creation_tokens", "cache_read_tokens", "total_cost_usd", "num_turns", "duration_ms", "context_used", "context_limit", "context_percentage", "baseline_context", "created_at", "completed_at") SELECT "id", "task_id", "prompt", "display_prompt", "status", "session_id", "branch", "diff_additions", "diff_deletions", "total_tokens", "input_tokens", "output_tokens", "cache_creation_tokens", "cache_read_tokens", "total_cost_usd", "num_turns", "duration_ms", "context_used", "context_limit", "context_percentage", "baseline_context", "created_at", "completed_at" FROM `attempts`;--> statement-breakpoint
DROP TABLE `attempts`;--> statement-breakpoint
ALTER TABLE `__new_attempts` RENAME TO `attempts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_attempts_task` ON `attempts` (`task_id`,`created_at`);