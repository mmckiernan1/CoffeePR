import assert from "node:assert/strict";
import test from "node:test";

import {
  approvePilotLocalPayroll,
  reconcilePilotLocalApproval,
} from "../lib/payroll/pilot-local-payment-state.ts";

const base = {
  approved: false,
  approvedFingerprint: null,
  paidEmployeeIds: [],
  references: {},
  completedAt: null,
};

test("device-only approval stores the current payroll fingerprint", () => {
  const approved = approvePilotLocalPayroll(base, "uat-v1-current");
  assert.equal(approved.approved, true);
  assert.equal(approved.approvedFingerprint, "uat-v1-current");
  assert.deepEqual(approved.paidEmployeeIds, []);
  assert.deepEqual(approved.references, {});
});

test("device-only approval invalidates payment evidence when payroll inputs change", () => {
  const prior = {
    approved: true,
    approvedFingerprint: "uat-v1-old",
    paidEmployeeIds: ["EMP-1"],
    references: { "EMP-1": "BANK-123" },
    completedAt: "2026-09-04T12:00:00.000Z",
  };
  const result = reconcilePilotLocalApproval(prior, "uat-v1-new");
  assert.equal(result.approvalStale, true);
  assert.equal(result.state.approved, false);
  assert.equal(result.state.approvedFingerprint, null);
  assert.deepEqual(result.state.paidEmployeeIds, []);
  assert.deepEqual(result.state.references, {});
  assert.equal(result.state.completedAt, null);
});

test("device-only approval preserves evidence while the approved payroll is unchanged", () => {
  const prior = {
    approved: true,
    approvedFingerprint: "uat-v1-current",
    paidEmployeeIds: ["EMP-1"],
    references: { "EMP-1": "BANK-123" },
    completedAt: null,
  };
  const reconciled = reconcilePilotLocalApproval(prior, "uat-v1-current");
  assert.equal(reconciled.approvalStale, false);
  assert.deepEqual(reconciled.state, prior);

  const reapproved = approvePilotLocalPayroll(prior, "uat-v1-current");
  assert.deepEqual(reapproved.paidEmployeeIds, ["EMP-1"]);
  assert.deepEqual(reapproved.references, { "EMP-1": "BANK-123" });
});
