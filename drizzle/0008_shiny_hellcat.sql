CREATE TABLE `correction_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`payroll_account_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`linked_pay_run_id` text,
	`correction_type` text NOT NULL,
	`effective_date` text NOT NULL,
	`pay_date` text NOT NULL,
	`gross_cents` integer NOT NULL,
	`deductions_cents` integer NOT NULL,
	`net_pay_cents` integer NOT NULL,
	`status` text NOT NULL,
	`explanation` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`approved_at` text,
	`approved_by` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payroll_account_id`) REFERENCES `payroll_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_pay_run_id`) REFERENCES `pay_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `correction_runs_employee_idx` ON `correction_runs` (`workspace_id`,`employee_id`);--> statement-breakpoint
CREATE INDEX `correction_runs_status_idx` ON `correction_runs` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `employee_jurisdiction_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`residence_province` text NOT NULL,
	`work_province` text NOT NULL,
	`tax_province` text NOT NULL,
	`employment_standards_jurisdiction` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `employee_jurisdictions_effective_idx` ON `employee_jurisdiction_versions` (`workspace_id`,`employee_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `employment_change_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`change_type` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`previous_value_json` text NOT NULL,
	`new_value_json` text NOT NULL,
	`ruleset_version` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `employment_changes_employee_effective_idx` ON `employment_change_versions` (`workspace_id`,`employee_id`,`effective_from`);--> statement-breakpoint
CREATE INDEX `employment_changes_type_idx` ON `employment_change_versions` (`workspace_id`,`change_type`);--> statement-breakpoint
CREATE TABLE `opening_balance_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`tax_year` integer NOT NULL,
	`as_of_date` text NOT NULL,
	`taxable_earnings_cents` integer NOT NULL,
	`pensionable_earnings_cents` integer NOT NULL,
	`insurable_earnings_cents` integer NOT NULL,
	`income_tax_cents` integer NOT NULL,
	`cpp_cents` integer NOT NULL,
	`cpp2_cents` integer DEFAULT 0 NOT NULL,
	`ei_cents` integer NOT NULL,
	`vacation_hours_hundredths` integer DEFAULT 0 NOT NULL,
	`vacation_dollars_cents` integer DEFAULT 0 NOT NULL,
	`source_reference` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opening_balances_employee_year_uq` ON `opening_balance_entries` (`workspace_id`,`employee_id`,`tax_year`);--> statement-breakpoint
CREATE INDEX `opening_balances_workspace_idx` ON `opening_balance_entries` (`workspace_id`);--> statement-breakpoint
ALTER TABLE `payroll_codes` ADD `vacationable` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `payroll_codes` ADD `holiday_average_eligible` integer DEFAULT false NOT NULL;