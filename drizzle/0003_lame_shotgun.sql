CREATE TABLE `employee_payroll_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`pay_schedule_id` text NOT NULL,
	`tax_method` text NOT NULL,
	`salary_periodic_cents` integer DEFAULT 0 NOT NULL,
	`hourly_rate_cents` integer DEFAULT 0 NOT NULL,
	`standard_hours_hundredths` integer DEFAULT 0 NOT NULL,
	`federal_claim_cents` integer NOT NULL,
	`alberta_claim_cents` integer NOT NULL,
	`additional_tax_cents` integer DEFAULT 0 NOT NULL,
	`cpp_exempt` integer DEFAULT false NOT NULL,
	`ei_exempt` integer DEFAULT false NOT NULL,
	`effective_from` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pay_schedule_id`) REFERENCES `pay_schedules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employee_payroll_profiles_employee_uq` ON `employee_payroll_profiles` (`employee_id`);--> statement-breakpoint
CREATE INDEX `employee_payroll_profiles_workspace_idx` ON `employee_payroll_profiles` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `pay_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`payroll_account_id` text NOT NULL,
	`name` text NOT NULL,
	`frequency` text NOT NULL,
	`periods_per_year` integer NOT NULL,
	`next_run_number` integer NOT NULL,
	`next_period_start` text NOT NULL,
	`next_period_end` text NOT NULL,
	`next_pay_date` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payroll_account_id`) REFERENCES `payroll_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pay_schedules_workspace_account_idx` ON `pay_schedules` (`workspace_id`,`payroll_account_id`);--> statement-breakpoint
CREATE TABLE `statutory_ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`pay_run_id` text,
	`tax_year` integer NOT NULL,
	`entry_type` text NOT NULL,
	`pay_date` text NOT NULL,
	`taxable_earnings_cents` integer NOT NULL,
	`pensionable_earnings_cents` integer NOT NULL,
	`insurable_earnings_cents` integer NOT NULL,
	`income_tax_cents` integer NOT NULL,
	`cpp_cents` integer NOT NULL,
	`cpp2_cents` integer NOT NULL,
	`ei_cents` integer NOT NULL,
	`source_reference` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pay_run_id`) REFERENCES `pay_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `statutory_ledger_source_uq` ON `statutory_ledger_entries` (`source_reference`);--> statement-breakpoint
CREATE INDEX `statutory_ledger_employee_year_idx` ON `statutory_ledger_entries` (`workspace_id`,`employee_id`,`tax_year`);--> statement-breakpoint
ALTER TABLE `pay_run_draft_lines` ADD `cpp2_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pay_run_payments` ADD `cpp2_cents` integer DEFAULT 0 NOT NULL;