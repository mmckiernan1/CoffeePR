import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const base = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, base), "utf8");
const [safety, register, statement] = await Promise.all([
  read("lib/payroll/pilot-report-readiness.ts"),
  read("app/uat/reports/page.tsx"),
  read("app/uat/statements/page.tsx"),
]);

test("print safety checks missing hourly rate splits, hour confirmation and approved fingerprint", () => {
  assert.match(safety, /pilotHourlyRateSplitReady\(/);
  assert.match(safety, /if \(!state\.ready\)/);
  assert.match(safety, /if \(!approval\.approved\)/);
  assert.match(safety, /approval\.approvedFingerprint !== currentFingerprint/);
  assert.match(safety, /pilotRunFingerprint\(/);
});

test("register and statements do not print unapproved or incomplete payroll amounts", () => {
  assert.match(register, /const canPrint = loaded && reportReadiness\.ready/);
  assert.match(register, /disabled=\{!canPrint\}/);
  assert.match(register, /\{canPrint && <>/);
  assert.match(statement, /const canPrint = loaded && reportReadiness\.ready/);
  assert.match(statement, /disabled=\{!row\}/);
  assert.match(statement, /!canPrint \?/);
  assert.match(statement, /approvedFingerprint/);
});
