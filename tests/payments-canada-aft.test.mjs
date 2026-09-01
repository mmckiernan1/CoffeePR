import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoPaymentsCanadaAftFile } from "../lib/payroll/demo.ts";

test("generic Payments Canada AFT simulation preserves fixed-record controls", () => {
  const file = buildDemoPaymentsCanadaAftFile(17, [2360.81, 1936.77, 2767.33, 1428.02]);
  assert.equal(file.descriptor.mode, "SIMULATION ONLY — NOT BANK-SUBMITTABLE");
  assert.equal(file.logicalRecords[0][0], "A");
  assert.equal(file.logicalRecords.at(-1)[0], "Z");
  assert.ok(file.logicalRecords.every((record) => record.length === 1464));
  assert.equal(file.control.paymentCount, 4);
  assert.equal(file.control.totalAmountCents, 849293);
  assert.equal(file.content.startsWith("$$AA01"), false);
  assert.match(file.logicalRecords[0], /0000000000TEST/);
});
