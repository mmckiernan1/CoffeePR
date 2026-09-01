import assert from "node:assert/strict";
import test from "node:test";
import { calculateSalaryRetro, selectEffectiveRecord, validateEffectiveTimeline } from "../lib/payroll/effective-dating.ts";

test("effective record selection reproduces the value in force on a payroll date", () => {
  const records = [
    { id: "salary-1", effectiveFrom: "2026-01-01", effectiveTo: "2026-07-31", value: { annualSalaryCents: 8_000_000 } },
    { id: "salary-2", effectiveFrom: "2026-08-01", effectiveTo: null, value: { annualSalaryCents: 8_400_000 } },
  ];
  assert.equal(selectEffectiveRecord(records, "2026-07-15")?.id, "salary-1");
  assert.equal(selectEffectiveRecord(records, "2026-09-18")?.id, "salary-2");
  assert.equal(selectEffectiveRecord(records, "2025-12-31"), null);
});

test("timeline validation rejects overlapping effective records", () => {
  assert.throws(() => validateEffectiveTimeline([
    { id: "position-1", effectiveFrom: "2026-01-01", effectiveTo: "2026-08-31", value: "Manager" },
    { id: "position-2", effectiveFrom: "2026-08-15", effectiveTo: null, value: "Director" },
  ]), /overlaps/);
});

test("two fully retroactive semi-monthly salary periods calculate in integer cents", () => {
  const result = calculateSalaryRetro({
    effectiveDate: "2026-08-01",
    previousAnnualSalaryCents: 8_000_000,
    newAnnualSalaryCents: 8_400_000,
    periodsPerYear: 24,
    prorationBasis: "workdays",
    closedPeriods: [
      { id: "run-15", periodStart: "2026-08-01", periodEnd: "2026-08-15", paidSalaryCents: 333_333 },
      { id: "run-16", periodStart: "2026-08-16", periodEnd: "2026-08-31", paidSalaryCents: 333_333 },
    ],
  });
  assert.equal(result.previousPeriodicCents, 333_333);
  assert.equal(result.newPeriodicCents, 350_000);
  assert.equal(result.totalRetroactiveDifferenceCents, 33_334);
  assert.deepEqual(result.periods.map((period) => period.retroactiveDifferenceCents), [16_667, 16_667]);
  assert.equal(result.rulesetVersion, "COMCHEQ-EFFECTIVE-DATING-AB-2026-v1");
});

test("mid-period salary changes prorate only eligible workdays", () => {
  const result = calculateSalaryRetro({
    effectiveDate: "2026-08-10",
    previousAnnualSalaryCents: 8_000_000,
    newAnnualSalaryCents: 8_400_000,
    periodsPerYear: 24,
    prorationBasis: "workdays",
    closedPeriods: [{ id: "run-15", periodStart: "2026-08-01", periodEnd: "2026-08-15", paidSalaryCents: 333_333 }],
  });
  assert.equal(result.periods[0].previousRateDays, 5);
  assert.equal(result.periods[0].newRateDays, 5);
  assert.equal(result.periods[0].recalculatedSalaryCents, 341_667);
  assert.equal(result.totalRetroactiveDifferenceCents, 8_334);
});
