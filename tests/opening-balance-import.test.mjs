import assert from "node:assert/strict";
import test from "node:test";
import { openingBalanceCsvTemplate, parseOpeningBalanceCsv } from "../lib/payroll/opening-balance-import.ts";

const employees = [
  { id: "EMP-0001", name: "Avery Chen" },
  { id: "EMP-0002", name: "Noah Williams" },
];

test("opening-balance template creates one row per current employee", () => {
  const result = parseOpeningBalanceCsv(openingBalanceCsvTemplate(employees), employees);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].employeeId, "EMP-0001");
  assert.equal(result.rows[0].taxableEarningsCents, 0);
});

test("opening-balance CSV converts dollars to cents and validates employee ownership", () => {
  const csv = [
    "employee_id,employee_name,as_of_date,taxable_earnings,pensionable_earnings,insurable_earnings,income_tax,cpp,cpp2,ei",
    "EMP-0001,Avery Chen,2026-08-31,42000.25,41000.00,40000,6800.10,2300.00,0,680.55",
  ].join("\n");
  const result = parseOpeningBalanceCsv(csv, employees);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].taxableEarningsCents, 4_200_025);
  assert.equal(result.rows[0].incomeTaxCents, 680_010);
  assert.equal(result.rows[0].eiCents, 68_055);

  const wrongEmployee = parseOpeningBalanceCsv(csv.replace("EMP-0001", "EMP-9999"), employees);
  assert.equal(wrongEmployee.rows.length, 0);
  assert.match(wrongEmployee.errors[0], /not in this Coffee Payroll workspace/);
});

test("opening-balance CSV rejects invalid dates, negative amounts and duplicate employees", () => {
  const invalid = [
    "employee_id,employee_name,as_of_date,taxable_earnings,pensionable_earnings,insurable_earnings,income_tax,cpp,cpp2,ei",
    "EMP-0001,Avery Chen,08/31/2026,-1,0,0,0,0,0,0",
  ].join("\n");
  const invalidResult = parseOpeningBalanceCsv(invalid, employees);
  assert.equal(invalidResult.rows.length, 0);
  assert.equal(invalidResult.errors.length, 2);

  const duplicate = [
    "employee_id,employee_name,as_of_date,taxable_earnings,pensionable_earnings,insurable_earnings,income_tax,cpp,cpp2,ei",
    "EMP-0001,Avery Chen,2026-08-31,0,0,0,0,0,0,0",
    "EMP-0001,Avery Chen,2026-08-31,1,1,1,1,1,0,1",
  ].join("\n");
  const duplicateResult = parseOpeningBalanceCsv(duplicate, employees);
  assert.match(duplicateResult.errors.at(-1), /duplicate employee IDs/);
});
