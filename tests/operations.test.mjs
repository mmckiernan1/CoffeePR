import assert from "node:assert/strict";
import test from "node:test";
import { addUtcMonths, monthlyRemittanceDueDate, remittanceDueDate, remittanceLiabilityCents, validateOvertimeBankMovement } from "../lib/payroll/operations.ts";

test("Alberta overtime bank credits expire six months after period end", () => {
  assert.equal(addUtcMonths("2026-08-31", 6), "2027-02-28");
});

test("monthly remittance is due on the 15th of the following month", () => {
  assert.equal(monthlyRemittanceDueDate("2026-09-04"), "2026-10-15");
});

test("remitter schedule supports quarterly and both accelerated thresholds", () => {
  assert.equal(remittanceDueDate("Quarterly", "2026-02-12"), "2026-04-15");
  assert.equal(remittanceDueDate("Threshold 1", "2026-09-12"), "2026-09-25");
  assert.equal(remittanceDueDate("Threshold 1", "2026-09-22"), "2026-10-10");
  assert.equal(remittanceDueDate("Threshold 2", "2026-09-16"), "2026-09-24");
  assert.equal(remittanceDueDate("Threshold 2", "2026-09-26"), "2026-10-05");
});

test("remittance liability includes employee and employer CPP and EI", () => {
  assert.equal(remittanceLiabilityCents([{ incomeTaxCents: 10_000, cppCents: 2_000, cpp2Cents: 100, eiCents: 1_000 }]), 16_600);
});

test("overtime bank cannot be overdrawn or credited without an agreement", () => {
  assert.equal(validateOvertimeBankMovement({ earnedHundredths: 200, usedHundredths: 100, currentBalanceHundredths: 300, agreementActive: true }), 400);
  assert.throws(() => validateOvertimeBankMovement({ earnedHundredths: 100, usedHundredths: 0, currentBalanceHundredths: 0, agreementActive: false }), /written overtime agreement/);
  assert.throws(() => validateOvertimeBankMovement({ earnedHundredths: 0, usedHundredths: 101, currentBalanceHundredths: 100, agreementActive: true }), /available balance/);
});
