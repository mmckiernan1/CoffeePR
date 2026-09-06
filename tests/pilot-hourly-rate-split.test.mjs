import assert from "node:assert/strict";
import test from "node:test";
import {
  pilotHourlyGrossFromSplits,
  pilotHourlyRateSegmentDates,
  pilotHourlyRateSplitsComplete,
} from "../lib/payroll/pilot-hourly-rate-split.ts";

const run = { periodStart: "2026-08-16", periodEnd: "2026-08-31" };
const employee = {
  rate: 30,
  rateHistory: [
    { effectiveDate: "2026-01-01", rate: 30 },
    { effectiveDate: "2026-08-24", rate: 32 },
  ],
};

test("hourly split dates include the period start and each in-period rate change", () => {
  assert.deepEqual(pilotHourlyRateSegmentDates(employee, run), ["2026-08-16", "2026-08-24"]);
});

test("split allocation is incomplete until every rate segment is present", () => {
  assert.equal(pilotHourlyRateSplitsComplete(employee, run, [{ effectiveFrom: "2026-08-16", regular: 32, overtime: 0, vacation: 0 }]), false);
  assert.equal(pilotHourlyRateSplitsComplete(employee, run, [
    { effectiveFrom: "2026-08-16", regular: 32, overtime: 0, vacation: 0 },
    { effectiveFrom: "2026-08-24", regular: 48, overtime: 2, vacation: 0 },
  ]), true);
});

test("hourly gross applies the correct rate to each segment including overtime", () => {
  const gross = pilotHourlyGrossFromSplits(employee, [
    { effectiveFrom: "2026-08-16", regular: 32, overtime: 0, vacation: 0 },
    { effectiveFrom: "2026-08-24", regular: 48, overtime: 2, vacation: 0 },
  ]);
  assert.equal(gross, 32 * 30 + 48 * 32 + 2 * 32 * 1.5);
});

test("ordinary single-rate hourly payroll does not require split rows", () => {
  const stable = { rate: 30, rateHistory: [{ effectiveDate: "2026-01-01", rate: 30 }] };
  assert.equal(pilotHourlyRateSplitsComplete(stable, run, undefined), true);
});
