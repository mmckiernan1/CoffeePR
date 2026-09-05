import assert from "node:assert/strict";
import test from "node:test";
import { pilotRunFingerprint } from "../lib/payroll/pilot-run-fingerprint.ts";

function sample() {
  return {
    runKey: "2026-17-pilot",
    periodStart: "2026-08-16",
    periodEnd: "2026-08-31",
    payDate: "2026-09-04",
    province: "Alberta",
    frequency: "Biweekly",
    employees: [
      { id: "EMP-2", name: "Noah", payType: "Hourly", rate: 30, status: "Active" },
      { id: "EMP-1", name: "Avery", payType: "Salary", rate: 80000, status: "Active" },
    ],
    timesheets: { "EMP-2": { regular: 80, overtime: 2.5, vacation: 0 } },
  };
}

test("same payroll inputs produce the same fingerprint regardless of employee/key ordering", () => {
  const first = sample();
  const second = sample();
  second.employees.reverse();
  second.timesheets = { "EMP-2": { vacation: 0, overtime: 2.5, regular: 80 } };
  assert.equal(pilotRunFingerprint(first), pilotRunFingerprint(second));
});

test("rate, time and lifecycle/final-pay changes invalidate an approval fingerprint", () => {
  const base = sample();
  const fingerprint = pilotRunFingerprint(base);

  const rate = sample();
  rate.employees[0].rate = 31.5;
  assert.notEqual(pilotRunFingerprint(rate), fingerprint);

  const time = sample();
  time.timesheets["EMP-2"].overtime = 3;
  assert.notEqual(pilotRunFingerprint(time), fingerprint);

  const finalPay = sample();
  finalPay.employees[0] = { ...finalPay.employees[0], status: "Terminating", terminationDate: "2026-08-31", finalPay: { vacationPay: 250, overtimePay: 0, otherTaxablePay: 0, reimbursement: 40 } };
  assert.notEqual(pilotRunFingerprint(finalPay), fingerprint);
});

test("new-hire statutory review evidence is part of the approved payroll fingerprint", () => {
  const pending = sample();
  pending.employees[0] = {
    ...pending.employees[0],
    status: "New hire",
    taxSetupComplete: false,
  };
  const pendingFingerprint = pilotRunFingerprint(pending);

  const reviewed = sample();
  reviewed.employees[0] = {
    ...reviewed.employees[0],
    status: "New hire",
    taxSetupComplete: true,
    taxSetupReview: {
      federalTd1: true,
      provincialTd1: true,
      cppEi: true,
      openingYtd: true,
      reviewedAt: "2026-09-05T22:00:00.000Z",
    },
  };
  assert.notEqual(pilotRunFingerprint(reviewed), pendingFingerprint);
});
