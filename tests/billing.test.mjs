import assert from "node:assert/strict";
import test from "node:test";
import { approvedPayRunChargeCents, COMCHEQ_BILLING } from "../lib/payroll/billing.ts";

test("approved payroll billing is one base fee plus one fee per employee payment", () => {
  assert.equal(COMCHEQ_BILLING.currency, "CAD");
  assert.equal(approvedPayRunChargeCents(4), 1_800);
  assert.equal(approvedPayRunChargeCents(0), 1_000);
  assert.throws(() => approvedPayRunChargeCents(2.5), /outside the supported range/);
});
