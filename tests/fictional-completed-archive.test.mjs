import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const base = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, base), "utf8");
const [archive, payments, register, statements, complete] = await Promise.all([
  read("lib/payroll/pilot-completed-archive.ts"),
  read("app/uat/payments/page.tsx"),
  read("app/uat/reports/page.tsx"),
  read("app/uat/statements/page.tsx"),
  read("app/uat/complete/page.tsx"),
]);

test("completed snapshots require unchanged approved inputs, employee payment confirmations and references", () => {
  assert.match(archive, /pilotReportReadiness\(state, profile, payments\)\.ready/);
  assert.match(archive, /payments\.completedAt/);
  assert.match(archive, /payments\.paidEmployeeIds\.includes\(employee\.id\)/);
  assert.match(archive, /payments\.references\[employee\.id\]/);
  assert.match(archive, /pilotCalculateEmployee\(/);
  assert.match(archive, /paymentReference:/);
  assert.match(archive, /approvedFingerprint/);
});

test("archives are append-only and never silently erased by subsequent saves", () => {
  assert.match(archive, /const history = readPilotCompletedArchive\(storage\)/);
  assert.match(archive, /previous\.id === snapshot\.id/);
  assert.match(archive, /JSON\.stringify\(\[\.\.\.history, snapshot\]\)/);
  assert.match(archive, /Existing fictional payroll archive is invalid/);
  assert.doesNotMatch(payments, /removeItem\(PILOT_COMPLETED_ARCHIVE_KEY\)/);
});

test("completed payment action archives snapshot before navigating to Done", () => {
  const finish = payments.slice(payments.indexOf("async function finishPayroll()"));
  assert.match(finish, /createPilotCompletedSnapshot\(/);
  assert.match(finish, /savePilotCompletedSnapshot\(window\.localStorage, snapshot\)/);
  assert.ok(finish.indexOf("savePilotCompletedSnapshot(") < finish.indexOf('router.push("/uat/complete")'));
});

test("completed register, individual statements and Done screen can access saved history", () => {
  assert.match(register, /latestPilotCompletedSnapshot\(readPilotCompletedArchive\(window\.localStorage\)\)/);
  assert.match(register, /archived\.rows\.map/);
  assert.match(statements, /archived\.rows\.find/);
  assert.match(complete, /View historical register/);
  assert.match(complete, /This does not mark the current draft complete/);
});
