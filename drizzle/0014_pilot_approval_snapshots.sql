CREATE TABLE IF NOT EXISTS `pilot_approval_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `run_key` text NOT NULL,
  `fingerprint` text NOT NULL,
  `period_start` text NOT NULL,
  `period_end` text NOT NULL,
  `pay_date` text NOT NULL,
  `province` text NOT NULL,
  `frequency` text NOT NULL,
  `employee_count` integer NOT NULL,
  `snapshot_json` text NOT NULL,
  `approved_at` text NOT NULL,
  `approved_by` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `employer_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pilot_approval_snapshots_workspace_run_idx` ON `pilot_approval_snapshots` (`workspace_id`, `run_key`, `approved_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pilot_approval_snapshots_fingerprint_idx` ON `pilot_approval_snapshots` (`workspace_id`, `fingerprint`);
