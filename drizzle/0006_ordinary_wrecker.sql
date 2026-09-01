CREATE TABLE `employee_payroll_profile_versions` (
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
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pay_schedule_id`) REFERENCES `pay_schedules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `profile_versions_employee_effective_idx` ON `employee_payroll_profile_versions` (`workspace_id`,`employee_id`,`effective_from`);