CREATE TABLE `employer_bank_links` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`bank_name` text NOT NULL,
	`bank_url` text NOT NULL,
	`eft_adapter` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employer_bank_link_workspace_uq` ON `employer_bank_links` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `overtime_agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`agreement_type` text NOT NULL,
	`bank_rate_hundredths` integer DEFAULT 100 NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`status` text NOT NULL,
	`document_reference` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `overtime_agreements_employee_effective_idx` ON `overtime_agreements` (`workspace_id`,`employee_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `overtime_bank_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`pay_run_id` text,
	`entry_type` text NOT NULL,
	`transaction_date` text NOT NULL,
	`hours_delta_hundredths` integer NOT NULL,
	`expires_on` text,
	`source_reference` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pay_run_id`) REFERENCES `pay_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `overtime_bank_source_uq` ON `overtime_bank_entries` (`source_reference`);--> statement-breakpoint
CREATE INDEX `overtime_bank_employee_date_idx` ON `overtime_bank_entries` (`workspace_id`,`employee_id`,`transaction_date`);--> statement-breakpoint
CREATE TABLE `remittance_obligations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`payroll_account_id` text NOT NULL,
	`pay_run_id` text NOT NULL,
	`period_end` text NOT NULL,
	`due_date` text NOT NULL,
	`liability_cents` integer NOT NULL,
	`status` text NOT NULL,
	`reminder_date` text,
	`paid_date` text,
	`payment_reference` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payroll_account_id`) REFERENCES `payroll_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pay_run_id`) REFERENCES `pay_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `remittance_pay_run_uq` ON `remittance_obligations` (`pay_run_id`);--> statement-breakpoint
CREATE INDEX `remittance_workspace_due_idx` ON `remittance_obligations` (`workspace_id`,`due_date`);--> statement-breakpoint
ALTER TABLE `pay_run_draft_lines` ADD `banked_overtime_earned_hundredths` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pay_run_draft_lines` ADD `banked_overtime_used_hundredths` integer DEFAULT 0 NOT NULL;