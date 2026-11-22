import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("completion screens show practical after-payroll guidance", async () => {
  const [finished, guided, tasks] = await Promise.all([
    read("../app/uat/complete/page.tsx"),
    read("../components/comcheq/guided-payroll-run.tsx"),
    read("../components/comcheq/after-payroll-next-steps.tsx"),
  ]);

  assert.match(finished, /<AfterPayrollNextSteps/);
  assert.match(guided, /<AfterPayrollNextSteps/);
  assert.match(finished, /onOpenCra=\{\(\) => router\.push\("\/uat\/review"\)\}/);
  assert.match(guided, /craAmount=\{remittance\}/);
  assert.match(tasks, /Give employees their pay statements/);
  assert.match(tasks, /Take care of the CRA remittance/);
  assert.match(tasks, /Keep your payroll records/);
  assert.match(tasks, /Open pay statements/);
  assert.match(tasks, /Review CRA calculation/);
  assert.match(tasks, /Open payroll register/);
});

test("after-payroll guidance never implies automatic payments, remittance or email delivery", async () => {
  const tasks = await read("../components/comcheq/after-payroll-next-steps.tsx");
  const finished = await read("../app/uat/complete/page.tsx");
  assert.match(tasks, /does not email them in this pilot/);
  assert.match(tasks, /neither schedules nor sends the remittance/);
  assert.match(tasks, /no money has been transferred/);
  assert.match(tasks, /no CRA remittance has been made/);
  assert.match(tasks, /not a payment made by Coffee Payroll/);
  assert.match(finished, /Scheduling the next run is not enabled in this pilot/);
});

test("after-payroll next steps follow the original coffee theme and readable type", async () => {
  const tasks = await read("../components/comcheq/after-payroll-next-steps.tsx");
  assert.match(tasks, /#fffaf5/i);
  assert.match(tasks, /#332118/i);
  assert.match(tasks, /#1557d8/i);
  assert.match(tasks, /text-lg/);
  assert.match(tasks, /min-h-11/);
});
