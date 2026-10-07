import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const userFacingFiles = [
  "../app/admin/page.tsx",
  "../app/admin/workspace.tsx",
  "../app/layout.tsx",
  "../app/login/page.tsx",
  "../app/onboarding/page.tsx",
  "../app/setup/page.tsx",
  "../app/guided-payroll/page.tsx",
  "../app/uat/page.tsx",
  "../app/uat/fictional/page.tsx",
  "../app/uat/lifecycle/page.tsx",
  "../app/uat/time/page.tsx",
  "../app/uat/review/page.tsx",
  "../app/uat/payments/page.tsx",
  "../app/uat/complete/page.tsx",
  "../components/comcheq/guided-payroll-run.tsx",
  "../components/comcheq/run-payroll-shell.tsx",
  "../public/favicon.svg",
];

test("Coffee Payroll user-facing surfaces do not expose legacy brand styling", async () => {
  const sources = await Promise.all(userFacingFiles.map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const combined = sources.join("\n");
  assert.doesNotMatch(combined, /Comcheq Payroll|Comcheq support/i);
  assert.doesNotMatch(combined, /#6d4aff|#7757e8|#5b35c7|#00a29a|#8d70ff|#00a9a5/i);
  assert.doesNotMatch(combined, /<button[\\s\\S]{0,260}?bg-\\[#5a321f\\]/i);
});

test("Coffee Payroll theme keeps light-neutral surfaces, cobalt actions and green success", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /--background:\\s*#f5f7fa/i);
  assert.match(css, /--foreground:\\s*#1a2930/i);
  assert.match(css, /--primary:\s*#1557d8/i);
  assert.match(css, /--chart-2:\s*#5f7d4e/i);
});
