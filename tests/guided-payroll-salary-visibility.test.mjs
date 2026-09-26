import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const guidedSource = await readFile(new URL("../components/comcheq/guided-payroll-run.tsx", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/guided-payroll/page.tsx", import.meta.url), "utf8");

test("guided payroll keeps salaried employees visible with fixed pay", () => {
  assert.match(guidedSource, /No time entry required/);
  assert.match(guidedSource, /This pay:/);
  assert.match(guidedSource, /grossPay\?: number/);
  assert.match(pageSource, /grossPay: employee\.gross/);
});

test("guided payroll continues to separate approval from payment", () => {
  assert.match(guidedSource, /Approval confirms the payroll you just reviewed\. It does not send any money/);
  assert.match(guidedSource, /Approved\. Now pay your employees\./);
});
