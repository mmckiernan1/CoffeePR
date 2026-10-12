import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const guided = await readFile(new URL("../components/comcheq/guided-payroll-run.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/guided-payroll/page.tsx", import.meta.url), "utf8");

test("quick payroll skips repetitive navigation, not essential hours review", () => {
  assert.match(guided, /function useQuickPayroll\(\)/);
  assert.match(guided, /const next = timeReady \? 3 : 2/);
  assert.match(guided, /changesConfirmed: true, employeesConfirmed: true/);
  assert.match(guided, /onClick=\{useQuickPayroll\}/);
  assert.match(guided, /Check hours & pay/);
  assert.match(guided, /Review payroll/);
});

test("quick path leaves statutory setup, midperiod rate allocation and approval guards intact", () => {
  assert.match(page, /if \(!state\.ready\)/);
  assert.match(page, /if \(pendingTaxSetup\.length > 0\)/);
  assert.match(page, /if \(unresolvedHourlyRateChanges\.length > 0\)/);
  assert.match(page, /approvePilotLocalPayroll\(payments, fingerprint\)/);
  assert.doesNotMatch(guided, /onClick=\{useQuickPayroll\}[^\n]*onApprove/);
});

test("routine salary is carried forward and employee exceptions stay visible", () => {
  assert.match(guided, /const salariedCount = employees\.length - hourlyEmployees\.length/);
  assert.match(guided, /existing employee/);
  assert.match(guided, /Salary carried forward automatically/);
  assert.match(guided, /Add another change/);
});
