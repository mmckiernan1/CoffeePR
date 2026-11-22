import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const register = await readFile(new URL("../app/uat/reports/page.tsx", import.meta.url), "utf8");
const statements = await readFile(new URL("../app/uat/statements/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const guided = await readFile(new URL("../components/comcheq/guided-payroll-run.tsx", import.meta.url), "utf8");

test("employee numbers appear in payroll register and guided workflow", () => {
  assert.match(register, /ID \{row\.id\}/);
  assert.match(guided, /ID \{employee\.id\}/);
});

test("fictional register and individual statements offer print and browser PDF", () => {
  assert.match(register, /window\.print\(\)/);
  assert.match(register, /\/uat\/statements\?employee=/);
  assert.match(statements, /window\.print\(\)/);
  assert.match(statements, /Employee ID:/);
  assert.match(statements, /Gross earnings/);
  assert.match(statements, /Income tax/);
  assert.match(statements, /CPP/);
  assert.match(statements, /EI/);
  assert.match(statements, /Net pay/);
  assert.match(css, /@media print/);
  assert.match(css, /\.no-print/);
  assert.match(css, /\.print-document/);
});

test("printable statements never claim email delivery or real payments", () => {
  assert.match(statements, /Email delivery is not enabled/);
  assert.match(statements, /Fictional demonstration statement only/);
  assert.doesNotMatch(statements, /mailto:/i);
});
