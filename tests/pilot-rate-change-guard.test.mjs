import assert from "node:assert/strict";
import test from "node:test";
import { pilotHasMidPeriodRateChange, pilotMidPeriodRateChanges } from "../lib/payroll/pilot-rate-change-guard.ts";

const run = { periodStart: "2026-08-16", periodEnd: "2026-08-31" };

test("rate change before the pay period does not trigger the guard", () => {
  const employees = [{ id: "EMP-1", name: "Avery", rateHistory: [{ effectiveDate: "2026-08-15", rate: 30 }] }];
  assert.equal(pilotHasMidPeriodRateChange(employees, run), false);
});

test("rate change effective on the first day of the period is treated as a full-period rate", () => {
  const employees = [{ id: "EMP-1", name: "Avery", rateHistory: [{ effectiveDate: "2026-08-16", rate: 31 }] }];
  assert.equal(pilotHasMidPeriodRateChange(employees, run), false);
});

test("rate change inside the pay period triggers the guard", () => {
  const employees = [{
    id: "EMP-1",
    name: "Avery",
    rateHistory: [
      { effectiveDate: "2026-08-01", rate: 30 },
      { effectiveDate: "2026-08-24", rate: 31 },
    ],
  }];
  assert.deepEqual(pilotMidPeriodRateChanges(employees, run), [{ employeeId: "EMP-1", employeeName: "Avery", effectiveDates: ["2026-08-24"] }]);
});

test("future rate changes after the period do not trigger the guard", () => {
  const employees = [{ id: "EMP-1", name: "Avery", rateEffectiveDate: "2026-09-01" }];
  assert.equal(pilotHasMidPeriodRateChange(employees, run), false);
});
