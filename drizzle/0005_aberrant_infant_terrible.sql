ALTER TABLE `pay_run_drafts` ADD `tax_method` text DEFAULT 'Option 1 — Periodic' NOT NULL;--> statement-breakpoint
ALTER TABLE `pay_runs` ADD `tax_method` text DEFAULT 'Option 1 — Periodic' NOT NULL;