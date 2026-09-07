import assert from "node:assert/strict";
import test from "node:test";
import {
  FICTIONAL_PILOT_EXPECTATIONS,
  FICTIONAL_PILOT_PROFILE,
  FICTIONAL_PILOT_STATE,
} from "../lib/payroll/pilot-fictional-scenario.ts";
import {
  PILOT_RUN_PERIOD,
  pilotChangeSummary,
  pilotEmployeeIsInRun,
  pilotHourlyRateSplitNeeded,
} from "../lib/payroll/pilot-uat.ts";
import { pilotUnresolvedHourlyRateChanges } from "../lib/payroll/pilot-rate-change-guard.ts";

test("fictional pilot scenario exercises the intended payroll paths", () => {
  assert.equal(FICTIONAL_PILOT_PROFILE.businessName, "Juniper Trail Coffee Co.");
  assert.equal(FICTIONAL_PILOT_PROFILE.province, "Alberta");
  assert.equal(FICTIONAL_PILOT_PROFILE.frequency, "Biweekly");

  const included = FICTIONAL_PILOT_STATE.employees.filter(pilotEmployeeIsInRun);
  assert.equal(included.length, FICTIONAL_PILOT_EXPECTATIONS.employeesInRun);
  assert.equal(included.filter((employee) => employee.payType === "Hourly").length, FICTIONAL_PILOT_EXPECTATIONS.hourlyEmployees);
  assert.equal(included.filter((employee) => employee.payType === "Salary").length, FICTIONAL_PILOT_EXPECTATIONS.salariedEmployees);

  const changed = included.filter((employee) => pilotChangeSummary(employee));
  assert.deepEqual(changed.map((employee) => employee.id), [...FICTIONAL_PILOT_EXPECTATIONS.changedEmployees]);

  const rateChangeEmployee = included.find((employee) => employee.id === FICTIONAL_PILOT_EXPECTATIONS.hourlyRateSplitEmployee);
  assert.ok(rateChangeEmployee);
  assert.equal(pilotHourlyRateSplitNeeded(rateChangeEmployee), true);

  const unresolved = pilotUnresolvedHourlyRateChanges(
    included,
    FICTIONAL_PILOT_STATE.timesheets,
    PILOT_RUN_PERIOD,
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
