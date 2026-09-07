import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function applyMigration(db, path) {
  const sql = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
    .replaceAll("--> statement-breakpoint", "");
  db.exec(sql);
}

test("pilot D1 migrations allow payroll and payment states in one workspace and snapshot approval", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("CREATE TABLE employer_workspaces (id text PRIMARY KEY NOT NULL)");

  applyMigration(db, "drizzle/0013_pilot_workspace_state.sql");
  applyMigration(db, "drizzle/0014_pilot_approval_snapshots.sql");
  applyMigration(db, "drizzle/0015_pilot_approval_snapshot_trigger.sql");

  const workspaceId = "WS-PILOT-user-alpha";
  db.prepare("INSERT INTO employer_workspaces (id) VALUES (?)").run(workspaceId);

  const insertState = db.prepare(`
    INSERT INTO pilot_uat_states (id, workspace_id, state_json, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertState.run(
    "UAT-user-alpha",
    workspaceId,
    JSON.stringify({ employees: [] }),
    "2026-09-07T20:00:00.000Z",
    "user-alpha",
  );
  insertState.run(
    "PAY-UAT-user-alpha",
    workspaceId,
    JSON.stringify({ approved: false, approvedFingerprint: null, approvalHistory: [] }),
    "2026-09-07T20:00:00.000Z",
    "user-alpha",
  );

  const stateRows = db.prepare(
    "SELECT id FROM pilot_uat_states WHERE workspace_id = ? ORDER BY id",
  ).all(workspaceId);
  assert.deepEqual(
    stateRows.map((row) => row.id),
    ["PAY-UAT-user-alpha", "UAT-user-alpha"],
  );

  const approvalSnapshot = {
    snapshotId: "SNAP-user-alpha-001",
    fingerprint: "fingerprint-001",
    approvedAt: "2026-09-07T20:05:00.000Z",
    approvedBy: "user-alpha",
    run: {
      runKey: "2026-09-15-semi-monthly",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-15",
      payDate: "2026-09-15",
    },
    profile: {
      province: "AB",
      frequency: "semi-monthly",
    },
    employees: [{ id: "EMP-001" }],
  };

  db.prepare(`
    UPDATE pilot_uat_states
    SET state_json = ?, updated_at = ?
    WHERE id = ? AND workspace_id = ?
  `).run(
    JSON.stringify({
      approved: true,
      approvedFingerprint: approvalSnapshot.fingerprint,
      approvalHistory: [approvalSnapshot],
    }),
    approvalSnapshot.approvedAt,
    "PAY-UAT-user-alpha",
    workspaceId,
  );

  const storedSnapshot = db.prepare(`
    SELECT id, workspace_id, run_key, fingerprint, province, frequency, employee_count,
           approved_at, approved_by
    FROM pilot_approval_snapshots
    WHERE id = ?
  `).get(approvalSnapshot.snapshotId);

  assert.deepEqual(storedSnapshot, {
    id: approvalSnapshot.snapshotId,
    workspace_id: workspaceId,
    run_key: approvalSnapshot.run.runKey,
    fingerprint: approvalSnapshot.fingerprint,
    province: approvalSnapshot.profile.province,
    frequency: approvalSnapshot.profile.frequency,
    employee_count: 1,
    approved_at: approvalSnapshot.approvedAt,
    approved_by: approvalSnapshot.approvedBy,
  });

  db.close();
});
