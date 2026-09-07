import assert from "node:assert/strict";
import test from "node:test";
import { employeeCsvTemplate, parseEmployeeCsv } from "../lib/payroll/employee-import.ts";

test("employee CSV template imports salary and hourly employees", () => {
  const result = parseEmployeeCsv(employeeCsvTemplate(), 10);
  assert.deepEqual(result.errors, []);
  assert.equal(result.employees.length, 2);
  assert.equal(result.employees[0].id, "EMP-0010");
  assert.equal(result.employees[0].payType, "Salary");
  assert.equal(result.employees[1].rate, 30);
  assert.equal(result.employees[1].taxSetupComplete, false);
});

test("employee CSV accepts quoted names and rejects bad rows", () => {
  const valid = parseEmployeeCsv('employee_name,pay_type,rate,hire_date\n"Singh, Priya",Salary,111000,2023-09-05\n');
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.employees[0].name, "Singh, Priya");

  const invalid = parseEmployeeCsv("employee_name,pay_type,rate,hire_date\nNoah,Contractor,0,09/05/2024\n");
  assert.equal(invalid.employees.length, 0);
  assert.equal(invalid.errors.length, 3);
});

test("employee CSV reports missing required columns", () => {
  const result = parseEmployeeCsv("name,pay_type,rate\nAvery,Salary,80000\n");
  assert.equal(result.employees.length, 0);
  assert.match(result.errors[0], /employee_name/);
  assert.match(result.errors[0], /hire_date/);
});
