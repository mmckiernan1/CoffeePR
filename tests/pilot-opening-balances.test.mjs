import assert from "node:assert/strict";
import test from "node:test";
import { normalizePilotOpeningBalances, pilotOpeningBalanceMap } from "../lib/payroll/pilot-opening-balances.ts";

const balance = {
  asOfDate: "2026-08-31",
  taxableEarningsCents: 4200000,
  pensionableEarningsCents: 4200000,
  insurableEarningsCents: 4200000,
  incomeTaxCents: 680000,
  cppCents: 230000,
  cpp2Cents: 0,
  eiCents: 68000,
};

test("opening balance map converts validated import rows into employee-keyed state", () => {
  const result = pilotOpeningBalanceMap([{ employeeId: "EMP-0001", ...balance }]);
  assert.deepEqual(result, { "EMP-0001": balance });
});

test("opening balance state validates employees, cents and dates", () => {
  const allowed = new Set(["EMP-0001"]);
  assert.deepEqual(normalizePilotOpeningBalances({ "EMP-0001": balance }, allowed), { "EMP-0001": balance });
  assert.equal(normalizePilotOpeningBalances({ "EMP-9999": balance }, allowed), null);
  assert.equal(normalizePilotOpeningBalances({ "EMP-0001": { ...balance, cppCents: 12.5 } }, allowed), null);
  assert.equal(normalizePilotOpeningBalances({ "EMP-0001": { ...balance, asOfDate: "08/31/2026" } }, allowed), null);
});

test("missing opening balance state remains backward-compatible as an empty set", () => {
  assert.deepEqual(normalizePilotOpeningBalances(undefined), {});
});
