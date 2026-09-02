import assert from "node:assert/strict";
import test from "node:test";

import { validateEmployeePaymentHandoff } from "../lib/payroll/payment-handoff.ts";

test("mixed client-controlled payments balance and retain outstanding status", () => {
  const result = validateEmployeePaymentHandoff(true, [
    { employeeId: "EMP-0001", method: "EFT bank file", netPayCents: 216081, status: "Paid by client", clientReference: "EFT-4401" },
    { employeeId: "EMP-0002", method: "Business e-transfer", netPayCents: 193677, status: "Paid by client", clientReference: "ETR-8802" },
    { employeeId: "EMP-0003", method: "Business cheque", netPayCents: 276733, status: "Outstanding" },
  ]);

  assert.equal(result.controlTotalCents, 686491);
  assert.equal(result.outstandingCount, 1);
  assert.deepEqual(result.blockingErrors, []);
});

test("payment evidence cannot precede approval or reuse a confirmation reference", () => {
  const result = validateEmployeePaymentHandoff(false, [
    { employeeId: "EMP-0001", method: "Business e-transfer", netPayCents: 12500, status: "Paid by client", clientReference: "BANK-100" },
    { employeeId: "EMP-0002", method: "Business cheque", netPayCents: 9500, status: "Paid by client", clientReference: "bank-100" },
  ]);

  assert.equal(result.blockingErrors.some((error) => error.includes("approval is required")), true);
  assert.equal(result.blockingErrors.some((error) => error.includes("Duplicate client payment reference")), true);
});
