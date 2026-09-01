CREATE TABLE `employer_payroll_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`default_tax_method` text NOT NULL,
	`option2_available` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employer_payroll_settings_workspace_uq` ON `employer_payroll_settings` (`workspace_id`);--> statement-breakpoint
UPDATE `employee_payroll_profiles` SET `tax_method` = 'Option 1 — Periodic' WHERE `tax_method` = 'T4127 periodic';
