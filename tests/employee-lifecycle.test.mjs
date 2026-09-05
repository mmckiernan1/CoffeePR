import assert from "node:assert/strict";
import test from "node:test";
import { buildFinalPay, isEmployeeInPayPeriod, validateEmploymentLifecycle } from "../lib/payroll/employee-lifecycle.ts";

const run17 = { periodStart: "2026-08-16", periodEnd: "2026-08-31", payDate: "2026-09-04" };

test("new hire is included when the hire date falls inside the pay period", () => {
  assert.equal(isEmployeeInPayPeriod({ hireDate: "2026-08-20", status: "New hire" }, run17), true);
  assert.equal(isEmployeeInPayPeriod({ hireDate: "2026-09-01", status: "New hire" }, run17), false);
});

test("terminating employee remains in the period containing the termination date", () => {
  assert.equal(isEmployeeInPayPeriod({ hireDate: "2024-01-01", terminationDate: "2026-08-20", status: "Terminating" }, run17), true);
  assert.equal(isEmployeeInPayPeriod({ hireDate: "2024-01-01", terminationDate: "2026-08-15", status: "Terminated" }, run17), false);
});

test("termination lifecycle rejects impossible or incomplete dates", () => {
  assert.throws(() => validateEmploymentLifecycle({ hireDate: "2026-08-20", terminationDate: "2026-08-19", status: "Terminating" }), /before hire date/);
  assert.throws(() => validateEmploymentLifecycle({ hireDate: "2026-08-20", status: "Terminating" }), /require a termination date/);
  assert.throws(() => validateEmploymentLifecycle({ hireDate: "2026-02-30", status: "Active" }), /valid calendar date/);
});

test("final pay separates taxable earnings from reimbursements", () => {
  const result = buildFinalPay({
    regularPayCents: 180000,
    vacationPayCents: 22000,
    overtimePayCents: 15000,
    otherTaxablePayCents: 5000,
    reimbursementCents: 12500,
  });

  assert.equal(result.taxableGrossCents, 222000);
  assert.equal(result.cashPayBeforeDeductionsCents, 234500);
});
