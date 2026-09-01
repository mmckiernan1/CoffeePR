CREATE TABLE `billing_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`pay_run_id` text NOT NULL,
	`billing_event_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`provider_reference` text NOT NULL,
	`attempted_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pay_run_id`) REFERENCES `pay_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`billing_event_id`) REFERENCES `billing_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_charges_pay_run_uq` ON `billing_charges` (`pay_run_id`);--> statement-breakpoint
CREATE INDEX `billing_charges_workspace_status_idx` ON `billing_charges` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `billing_payment_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider` text NOT NULL,
	`method_type` text NOT NULL,
	`display_label` text NOT NULL,
	`provider_customer_token` text NOT NULL,
	`automatic_charge` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_payment_profiles_workspace_uq` ON `billing_payment_profiles` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `contractor_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`contractor_id` text NOT NULL,
	`payment_date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`notes` text NOT NULL,
	`t4a_box` text DEFAULT '048' NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contractor_id`) REFERENCES `contractors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `contractor_payments_contractor_date_idx` ON `contractor_payments` (`workspace_id`,`contractor_id`,`payment_date`);--> statement-breakpoint
CREATE TABLE `contractors` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`contractor_number` text NOT NULL,
	`legal_name` text NOT NULL,
	`email` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contractors_workspace_number_uq` ON `contractors` (`workspace_id`,`contractor_number`);--> statement-breakpoint
CREATE INDEX `contractors_workspace_status_idx` ON `contractors` (`workspace_id`,`status`);