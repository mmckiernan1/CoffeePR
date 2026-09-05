import assert from "node:assert/strict";
import test from "node:test";
import {
  appendPilotApprovalSnapshot,
  EMPTY_PILOT_PAYMENT_STATE,
  normalizePilotApprovalSnapshot,
  normalizePilotPaymentState,
} from "../lib/payroll/pilot-approval-history.ts";

function snapshot(overrides = {}) {
  return {
    snapshotId: "2026-17-pilot:uat-v1-12345678:2026-09-05T21:00:00.000Z",
    approvedAt: "2026-09-05T21:00:00.000Z",
    approvedBy: "owner@example.com",
    fingerprint: "uat-v1-12345678",
    run: {
      runKey: "2026-17-pilot",
      periodStart: "2026-08-16",
      periodEnd: "2026-08-31",
      payDate: "2026-09-04",
    },
    profile: { province: "Alberta", frequency: "Biweekly" },
    employees: [{ id: "EMP-0001", name: "Avery Chen", rate: 80000 }],
    timesheets: {},
    ...overrides,
  };
}

test("legacy payment state without approvalHistory normalizes to an empty history", () => {
  const normalized = normalizePilotPaymentState({
    approved: false,
    approvedFingerprint: null,
    paidEmployeeIds: [],
    references: {},
    completedAt: null,
  });
  assert.deepEqual(normalized, EMPTY_PILOT_PAYMENT_STATE);
});

test("approval snapshot validation rejects impossible run dates and malformed timestamps", () => {
  assert.equal(normalizePilotApprovalSnapshot(snapshot({ approvedAt: "not-a-date" })), null);
  assert.equal(normalizePilotApprovalSnapshot(snapshot({ run: { runKey: "2026-17-pilot", periodStart: "2026-09-01", periodEnd: "2026-08-31", payDate: "2026-09-04" } })), null);
  assert.equal(normalizePilotApprovalSnapshot(snapshot({ run: { runKey: "2026-17-pilot", periodStart: "2026-08-16", periodEnd: "2026-08-31", payDate: "2026-08-30" } })), null);
});

test("first approval appends one immutable input snapshot", () => {
  const source = snapshot();
  const history = appendPilotApprovalSnapshot([], source);
  assert.equal(history.length, 1);
  assert.equal(history[0].fingerprint, source.fingerprint);
  source.employees[0].name = "Changed after approval";
  assert.equal(history[0].employees[0].name, "Avery Chen");
});

test("repeated approval of the same fingerprint is idempotent", () => {
  const first = snapshot();
  const history = appendPilotApprovalSnapshot([], first);
  const repeated = appendPilotApprovalSnapshot(history, { ...snapshot(), approvedAt: "2026-09-05T21:05:00.000Z", snapshotId: "another-id" });
  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].snapshotId, first.snapshotId);
});

test("changed payroll fingerprint preserves the prior approval and appends a new snapshot", () => {
  const first = appendPilotApprovalSnapshot([], snapshot());
  const changed = appendPilotApprovalSnapshot(first, snapshot({
    snapshotId: "2026-17-pilot:uat-v1-87654321:2026-09-05T21:10:00.000Z",
    approvedAt: "2026-09-05T21:10:00.000Z",
    fingerprint: "uat-v1-87654321",
    employees: [{ id: "EMP-0001", name: "Avery Chen", rate: 82000 }],
  }));
  assert.equal(changed.length, 2);
  assert.deepEqual(changed.map((item) => item.fingerprint), ["uat-v1-12345678", "uat-v1-87654321"]);
});

test("payment-state normalization preserves approval history and rejects duplicate paid employee ids", () => {
  const state = normalizePilotPaymentState({
    approved: true,
    approvedFingerprint: "uat-v1-12345678",
    paidEmployeeIds: ["EMP-0001"],
    references: { "EMP-0001": "etransfer-123" },
    completedAt: null,
    approvalHistory: [snapshot()],
  });
  assert.equal(state?.approvalHistory.length, 1);
  assert.equal(state?.references["EMP-0001"], "etransfer-123");

  const duplicate = normalizePilotPaymentState({
    approved: true,
    approvedFingerprint: "uat-v1-12345678",
    paidEmployeeIds: ["EMP-0001", "EMP-0001"],
    references: {},
    completedAt: null,
    approvalHistory: [snapshot()],
  });
  assert.equal(duplicate, null);
});

test("approval history keeps only the newest 25 distinct fingerprints", () => {
  let history = [];
  for (let index = 0; index < 27; index += 1) {
    history = appendPilotApprovalSnapshot(history, snapshot({
      snapshotId: `snapshot-${index}`,
      fingerprint: `uat-v1-${String(index).padStart(8, "0")}`,
      approvedAt: `2026-09-05T21:${String(index).padStart(2, "0")}:00.000Z`,
    }));
  }
  assert.equal(history.length, 25);
  assert.equal(history[0].snapshotId, "snapshot-2");
  assert.equal(history.at(-1).snapshotId, "snapshot-26");
});
