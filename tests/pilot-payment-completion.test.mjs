import assert from "node:assert/strict";
import test from "node:test";
import { pilotPaymentCompletionCheck } from "../lib/payroll/pilot-payment-completion.ts";

const employeeIds = ["EMP-1", "EMP-2"];

test("completion requires approval, every employee paid, and a bank reference for each employee", () => {
  const incomplete = pilotPaymentCompletionCheck(employeeIds, {
    approved: true,
    paidEmployeeIds: ["EMP-1", "EMP-2"],
    references: { "EMP-1": "REF-1" },
  });
  assert.equal(incomplete.ready, false);
  assert.deepEqual(incomplete.missingReferenceEmployeeIds, ["EMP-2"]);

  const complete = pilotPaymentCompletionCheck(employeeIds, {
    approved: true,
    paidEmployeeIds: ["EMP-1", "EMP-2"],
    references: { "EMP-1": "REF-1", "EMP-2": "REF-2" },
  });
  assert.equal(complete.ready, true);
});

test("completion rejects payment evidence for employees outside the current run", () => {
  const result = pilotPaymentCompletionCheck(employeeIds, {
    approved: true,
    paidEmployeeIds: ["EMP-1", "EMP-2", "EMP-3"],
    references: { "EMP-1": "REF-1", "EMP-2": "REF-2", "EMP-3": "REF-3" },
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.unexpectedPaidEmployeeIds, ["EMP-3"]);
  assert.deepEqual(result.unexpectedReferenceEmployeeIds, ["EMP-3"]);
});

test("completion never succeeds without an approved payroll or payable employees", () => {
  assert.equal(pilotPaymentCompletionCheck(employeeIds, {
    approved: false,
    paidEmployeeIds: employeeIds,
    references: { "EMP-1": "REF-1", "EMP-2": "REF-2" },
  }).ready, false);
  assert.equal(pilotPaymentCompletionCheck([], { approved: true, paidEmployeeIds: [], references: {} }).ready, false);
});
