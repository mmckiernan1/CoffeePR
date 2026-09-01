CREATE TABLE `pay_run_compliance_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`check_code` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`severity` text NOT NULL,
	`summary` text NOT NULL,
	`evidence_json` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`draft_id`) REFERENCES `pay_run_drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `compliance_checks_draft_code_uq` ON `pay_run_compliance_checks` (`draft_id`,`check_code`);--> statement-breakpoint
CREATE INDEX `compliance_checks_workspace_idx` ON `pay_run_compliance_checks` (`workspace_id`,`draft_id`);--> statement-breakpoint
CREATE TABLE `pay_run_draft_components` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`category` text NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL,
	`quantity_hundredths` integer,
	`rate_cents` integer,
	`amount_cents` integer NOT NULL,
	`display_order` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`draft_id`) REFERENCES `pay_run_drafts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `draft_components_draft_employee_order_uq` ON `pay_run_draft_components` (`draft_id`,`employee_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `draft_components_workspace_idx` ON `pay_run_draft_components` (`workspace_id`,`draft_id`);--> statement-breakpoint
CREATE TABLE `pay_run_payment_components` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`pay_run_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`category` text NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL,
	`quantity_hundredths` integer,
	`rate_cents` integer,
	`amount_cents` integer NOT NULL,
	`display_order` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pay_run_id`) REFERENCES `pay_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_components_run_employee_order_uq` ON `pay_run_payment_components` (`pay_run_id`,`employee_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `payment_components_workspace_idx` ON `pay_run_payment_components` (`workspace_id`,`pay_run_id`);