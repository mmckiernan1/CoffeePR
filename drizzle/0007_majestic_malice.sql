CREATE TABLE `employee_recurring_pay_items` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`payroll_code_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payroll_code_id`) REFERENCES `payroll_codes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recurring_pay_items_employee_effective_idx` ON `employee_recurring_pay_items` (`workspace_id`,`employee_id`,`effective_from`);--> statement-breakpoint
CREATE INDEX `recurring_pay_items_code_idx` ON `employee_recurring_pay_items` (`workspace_id`,`payroll_code_id`);--> statement-breakpoint
CREATE TABLE `payroll_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`calculation_mode` text NOT NULL,
	`taxable` integer DEFAULT false NOT NULL,
	`pensionable` integer DEFAULT false NOT NULL,
	`insurable` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_codes_workspace_code_uq` ON `payroll_codes` (`workspace_id`,`code`);--> statement-breakpoint
CREATE INDEX `payroll_codes_workspace_type_idx` ON `payroll_codes` (`workspace_id`,`type`);