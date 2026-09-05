CREATE TABLE IF NOT EXISTS `pilot_workspace_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `auth_user_id` text NOT NULL,
  `owner_email` text NOT NULL,
  `business_name` text NOT NULL,
  `province` text NOT NULL,
  `pay_frequency` text NOT NULL,
  `expected_employee_count` integer NOT NULL DEFAULT 1,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `pilot_workspace_profiles_user_uq` ON `pilot_workspace_profiles` (`auth_user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `pilot_workspace_profiles_workspace_uq` ON `pilot_workspace_profiles` (`workspace_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pilot_uat_states` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `state_json` text NOT NULL,
  `updated_at` text NOT NULL,
  `updated_by` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `pilot_uat_states_workspace_uq` ON `pilot_uat_states` (`workspace_id`);
