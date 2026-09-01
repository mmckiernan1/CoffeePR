CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`occurred_at` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`summary` text NOT NULL,
	`payload_json` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_workspace_time_idx` ON `audit_events` (`workspace_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `employer_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`province` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `offboarding_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`employee_name` text NOT NULL,
	`reason_code` text NOT NULL,
	`last_day` text NOT NULL,
	`final_pay_method` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `offboarding_workspace_idx` ON `offboarding_drafts` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `payroll_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`program_account_masked` text NOT NULL,
	`remitter_type` text NOT NULL,
	`status` text NOT NULL,
	`employee_count` integer DEFAULT 0 NOT NULL,
	`next_run` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payroll_accounts_workspace_idx` ON `payroll_accounts` (`workspace_id`);