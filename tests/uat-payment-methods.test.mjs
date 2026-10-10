import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/uat/payments/page.tsx", import.meta.url), "utf8");

test("fictional UAT offers only e-transfer and cheque employee payment methods", () => {
  assert.match(source, /Business e-transfer/);
  assert.match(source, /Business cheque/);
  assert.doesNotMatch(source, /EFT bank file/);
  assert.match(source, /Cheque number/);
  assert.match(source, /Bank confirmation \/ reference/);
});

const hubSource = await readFile(new URL("../app/uat/page.tsx", import.meta.url), "utf8");
const guidedSource = await readFile(new URL("../app/guided-payroll/page.tsx", import.meta.url), "utf8");
const apiSource = await readFile(new URL("../app/api/pilot/payments/route.ts", import.meta.url), "utf8");

test("switching payment methods clears previous payment evidence", () => {
  assert.match(source, /const nextReferences = \{ \.\.\.current\.references \}/);
  assert.match(source, /delete nextReferences\[id\]/);
  assert.match(source, /references: nextReferences/);
});

test("reset fictional scenario also clears payment evidence and guided progress", () => {
  assert.match(hubSource, /localStorage\.removeItem\("coffee-payroll:pilot-payment-methods"\)/);
  assert.match(hubSource, /localStorage\.setItem\("coffee-payroll:pilot-payments"/);
  assert.match(hubSource, /sessionStorage\.removeItem/);
});

test("both device-only and hosted approval require confirmed hours", () => {
  assert.match(guidedSource, /if \(!state\.ready\)/);
  assert.match(apiSource, /if \(uatState\.ready !== true\)/);
  assert.match(apiSource, /HOURS_NOT_READY/);
});
