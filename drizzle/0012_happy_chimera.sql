CREATE TABLE `client_onboarding_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`service_path` text DEFAULT 'Self-service' NOT NULL,
	`status` text DEFAULT 'In progress' NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_onboarding_profiles_workspace_uq` ON `client_onboarding_profiles` (`workspace_id`);