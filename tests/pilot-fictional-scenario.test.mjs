import assert from "node:assert/strict";
import test from "node:test";
import {
  FICTIONAL_PILOT_EXPECTATIONS,
  FICTIONAL_PILOT_PROFILE,
  FICTIONAL_PILOT_STATE,
} from "../lib/payroll/pilot-fictional-scenario.ts";
import { pilotUnresolvedHourlyRateChanges } from "../lib/payroll/pilot-rate-change-guard.ts";

const run = {
  periodStart: "2026-08-16",
  periodEnd: "2026-08-31",
};

test("fictional pilot scenario exercises the intended payroll paths", () => {
  assert.equal(FICTIONAL_PILOT_PROFILE.businessName, "Juniper Trail Coffee Co.");
  assert.equal(FICTIONAL_PILOT_PROFILE.province, "Alberta");
  assert.equal(FICTIONAL_PILOT_PROFILE.frequency, "Biweekly");

  const included = FICTIONAL_PILOT_STATE.employees;
  assert.equal(included.length, FICTIONAL_PILOT_EXPECTATIONS.employeesInRun);
  assert.equal(included.filter((employee) => employee.payType === "Hourly").length, FICTIONAL_PILOT_EXPECTATIONS.hourlyEmployees);
  assert.equal(included.filter((employee) => employee.payType === "Salary").length, FICTIONAL_PILOT_EXPECTATIONS.salariedEmployees);

  const changedIds = included
    .filter((employee) => Boolean(employee.rateEffectiveDate || employee.changeNote || employee.status === "Terminating" || employee.status === "Terminated"))
    .map((employee) => employee.id);
  assert.deepEqual(changedIds, [...FICTIONAL_PILOT_EXPECTATIONS.changedEmployees]);

  const rateChangeEmployee = included.find((employee) => employee.id === FICTIONAL_PILOT_EXPECTATIONS.hourlyRateSplitEmployee);
  assert.ok(rateChangeEmployee);
  assert.deepEqual(rateChangeEmployee.rateHistory, [
    { effectiveDate: "2024-05-13", rate: 29.5 },
    { effectiveDate: "2026-08-24", rate: 31 },
  ]);

  const unresolved = pilotUnresolvedHourlyRateChanges(
    included,
    FICTIONAL_PILOT_STATE.timesheets,
    run,
  );
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].employeeId, FICTIONAL_PILOT_EXPECTATIONS.hourlyRateSplitEmployee);

  const terminating = included.find((employee) => employee.id === FICTIONAL_PILOT_EXPECTATIONS.terminatingEmployee);
  assert.ok(terminating);
  assert.equal(terminating.status, "Terminating");
  assert.equal(terminating.terminationDate, "2026-08-28");
  assert.equal(terminating.finalPay?.vacationPayCents, 85000);
  assert.equal(terminating.finalPay?.reimbursementCents, 12000);

  assert.equal(FICTIONAL_PILOT_STATE.ready, false);
});
