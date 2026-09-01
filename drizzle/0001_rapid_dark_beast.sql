CREATE TABLE `billing_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`pay_run_id` text NOT NULL,
	`event_type` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pay_run_id`) REFERENCES `pay_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_events_idempotency_uq` ON `billing_events` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `billing_events_workspace_time_idx` ON `billing_events` (`workspace_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`payroll_account_id` text NOT NULL,
	`legal_name` text NOT NULL,
	`email` text NOT NULL,
	`role_title` text NOT NULL,
	`department` text NOT NULL,
	`pay_type` text NOT NULL,
	`pay_rate` text NOT NULL,
	`hire_date` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payroll_account_id`) REFERENCES `payroll_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `employees_workspace_account_idx` ON `employees` (`workspace_id`,`payroll_account_id`);--> statement-breakpoint
CREATE TABLE `employer_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `memberships_workspace_email_idx` ON `employer_memberships` (`workspace_id`,`email`);--> statement-breakpoint
CREATE TABLE `pay_run_outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`pay_run_id` text NOT NULL,
	`output_type` text NOT NULL,
	`status` text NOT NULL,
	`item_count` integer NOT NULL,
	`control_total_cents` integer NOT NULL,
	`reference` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pay_run_id`) REFERENCES `pay_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pay_run_outputs_run_type_uq` ON `pay_run_outputs` (`pay_run_id`,`output_type`);--> statement-breakpoint
CREATE INDEX `pay_run_outputs_workspace_idx` ON `pay_run_outputs` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `pay_run_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`pay_run_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text NOT NULL,
	`gross_cents` integer NOT NULL,
	`income_tax_cents` integer NOT NULL,
	`cpp_cents` integer NOT NULL,
	`ei_cents` integer NOT NULL,
	`other_deductions_cents` integer NOT NULL,
	`net_pay_cents` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pay_run_id`) REFERENCES `pay_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pay_run_payments_run_employee_uq` ON `pay_run_payments` (`pay_run_id`,`employee_id`);--> statement-breakpoint
CREATE INDEX `pay_run_payments_workspace_idx` ON `pay_run_payments` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `pay_runs` (
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
	`ruleset_effective_from` text NOT NULL,
	`gross_cents` integer NOT NULL,
	`net_cents` integer NOT NULL,
	`employee_payment_count` integer NOT NULL,
	`approved_at` text,
	`approved_by` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payroll_account_id`) REFERENCES `payroll_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pay_runs_account_year_number_uq` ON `pay_runs` (`payroll_account_id`,`payroll_year`,`run_number`);--> statement-breakpoint
CREATE INDEX `pay_runs_workspace_pay_date_idx` ON `pay_runs` (`workspace_id`,`pay_date`);--> statement-breakpoint
ALTER TABLE `offboarding_drafts` ADD `employee_id` text REFERENCES employees(id);