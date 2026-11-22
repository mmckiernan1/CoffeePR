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

test("Coffee Payroll theme keeps original espresso and cream surfaces, cobalt actions and green success", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /--background:\s*#fffaf5/i);
  assert.match(css, /--foreground:\s*#332118/i);
  assert.match(css, /--primary:\s*#1557d8/i);
  assert.match(css, /--chart-2:\s*#5f7d4e/i);
});

test("Coffee Payroll design contract retains the original cup and six friendly payroll steps", async () => {
  const [standard, favicon, shell, fictional, register] = await Promise.all([
    readFile(new URL("../docs/COFFEE_PAYROLL_THEME_STANDARD.md", import.meta.url), "utf8"),
    readFile(new URL("../public/favicon.svg", import.meta.url), "utf8"),
    readFile(new URL("../components/comcheq/run-payroll-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/uat/fictional/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/uat/reports/page.tsx", import.meta.url), "utf8"),
  ]);

  // These are the adopted identity, not placeholder fintech colours.
  for (const colour of ["#332118", "#5A321F", "#FFFAF5", "#FFFDF9", "#F7EFE6", "#1557D8", "#5F7D4E"]) {
    assert.ok(standard.toUpperCase().includes(colour), `Theme standard lost ${colour}`);
  }
  assert.match(favicon, /M6\.5 8\.25H16/); // Original cup body silhouette.
  assert.match(favicon, /#5A321F/i);
  assert.match(favicon, /#1557D8/i);
  for (const step of ["Changes", "Employees", "Hours & pay", "Review", "Approve & pay", "Done"]) {
    assert.ok(shell.includes(`label: "${step}"`), `Guided step lost: ${step}`);
  }
  assert.match(fictional, /bg-\[#f7efe6\]/i);
  assert.match(register, /bg-\[#f7efe6\]/i);
  assert.match(register, /Fictional demonstration register only/);
});
