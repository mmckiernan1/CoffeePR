CREATE TABLE `pay_run_draft_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text NOT NULL,
	`pay_type` text NOT NULL,
	`regular_hours_hundredths` integer DEFAULT 0 NOT NULL,
	`overtime_hours_hundredths` integer DEFAULT 0 NOT NULL,
	`other_earnings_cents` integer DEFAULT 0 NOT NULL,
	`other_deductions_cents` integer DEFAULT 0 NOT NULL,
	`gross_cents` integer DEFAULT 0 NOT NULL,
	`income_tax_cents` integer DEFAULT 0 NOT NULL,
	`cpp_cents` integer DEFAULT 0 NOT NULL,
	`ei_cents` integer DEFAULT 0 NOT NULL,
	`net_pay_cents` integer DEFAULT 0 NOT NULL,
	`exceptions_json` text DEFAULT '[]' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`draft_id`) REFERENCES `pay_run_drafts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pay_run_draft_lines_draft_employee_uq` ON `pay_run_draft_lines` (`draft_id`,`employee_id`);--> statement-breakpoint
CREATE INDEX `pay_run_draft_lines_workspace_idx` ON `pay_run_draft_lines` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `pay_run_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`payroll_account_id` text NOT NULL,
	`payroll_year` integer NOT NULL,
	`run_number` integer NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`pay_date` text NOT NULL,
	`status` text NOT NULL,
	`ruleset_version` text NOT NULL,
	`gross_cents` integer DEFAULT 0 NOT NULL,
	`net_cents` integer DEFAULT 0 NOT NULL,
	`blocking_exception_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payroll_account_id`) REFERENCES `payroll_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pay_run_drafts_account_year_number_uq` ON `pay_run_drafts` (`payroll_account_id`,`payroll_year`,`run_number`);--> statement-breakpoint
CREATE INDEX `pay_run_drafts_workspace_idx` ON `pay_run_drafts` (`workspace_id`);