import assert from "node:assert/strict";
import test from "node:test";
import { proratePilotSalaryRateChange } from "../lib/payroll/pilot-salary-rate-proration.ts";

test("salary proration splits a mid-period rate change across workdays", () => {
  const result = proratePilotSalaryRateChange({
    periodStart: "2026-08-16",
    periodEnd: "2026-08-31",
    periodsPerYear: 26,
    fallbackAnnualRate: 52000,
    rateHistory: [
      { effectiveDate: "2026-01-01", rate: 52000 },
      { effectiveDate: "2026-08-24", rate: 57200 },
    ],
  });
  assert.equal(result.totalWorkdays, 11);
  assert.equal(result.segments.length, 2);
  assert.deepEqual(result.segments.map((segment) => [segment.annualRate, segment.workdays]), [[52000, 5], [57200, 6]]);
  assert.equal(Number(result.gross.toFixed(2)), 2109.09);
});

test("salary proration uses one rate when the change starts on period start", () => {
  const result = proratePilotSalaryRateChange({
    periodStart: "2026-08-16",
    periodEnd: "2026-08-31",
    periodsPerYear: 26,
    fallbackAnnualRate: 52000,
    rateHistory: [{ effectiveDate: "2026-08-16", rate: 57200 }],
  });
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].annualRate, 57200);
  assert.equal(Number(result.gross.toFixed(2)), 2200);
});

test("salary proration supports multiple changes in one period", () => {
  const result = proratePilotSalaryRateChange({
    periodStart: "2026-08-16",
    periodEnd: "2026-08-31",
    periodsPerYear: 26,
    fallbackAnnualRate: 52000,
    rateHistory: [
      { effectiveDate: "2026-01-01", rate: 52000 },
      { effectiveDate: "2026-08-20", rate: 54600 },
      { effectiveDate: "2026-08-27", rate: 57200 },
    ],
  });
  assert.equal(result.segments.length, 3);
  assert.equal(result.segments.reduce((sum, segment) => sum + segment.workdays, 0), 11);
});
