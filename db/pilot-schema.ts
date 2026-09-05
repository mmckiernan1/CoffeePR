import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { employerWorkspaces } from "./schema";

export const pilotWorkspaceProfiles = sqliteTable("pilot_workspace_profiles", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  authUserId: text("auth_user_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  businessName: text("business_name").notNull(),
  province: text("province").notNull(),
  payFrequency: text("pay_frequency").notNull(),
  expectedEmployeeCount: integer("expected_employee_count").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("pilot_workspace_profiles_user_uq").on(table.authUserId),
  uniqueIndex("pilot_workspace_profiles_workspace_uq").on(table.workspaceId),
]);

export const pilotUatStates = sqliteTable("pilot_uat_states", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  stateJson: text("state_json").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
}, (table) => [uniqueIndex("pilot_uat_states_workspace_uq").on(table.workspaceId)]);

export const pilotApprovalSnapshots = sqliteTable("pilot_approval_snapshots", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  runKey: text("run_key").notNull(),
  fingerprint: text("fingerprint").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  payDate: text("pay_date").notNull(),
  province: text("province").notNull(),
  frequency: text("frequency").notNull(),
  employeeCount: integer("employee_count").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  approvedAt: text("approved_at").notNull(),
  approvedBy: text("approved_by").notNull(),
}, (table) => [
  index("pilot_approval_snapshots_workspace_run_idx").on(table.workspaceId, table.runKey, table.approvedAt),
  index("pilot_approval_snapshots_fingerprint_idx").on(table.workspaceId, table.fingerprint),
]);
