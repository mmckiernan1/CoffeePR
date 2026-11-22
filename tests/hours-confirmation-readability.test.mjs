import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("partial rate-split changes explain what remains instead of disabling the Hours look right action", async () => {
  const page = await read("../app/uat/time/page.tsx");
  assert.match(page, /Regular: <strong>\{formatHours\(allocated\.regular\)\} of \{formatHours\(target\.regular\)\}/);
  assert.match(page, /Overtime: <strong>\{formatHours\(allocated\.overtime\)\} of \{formatHours\(target\.overtime\)\}/);
  assert.match(page, /Vacation: <strong>\{formatHours\(allocated\.vacation\)\} of \{formatHours\(target\.vacation\)\}/);
  assert.match(page, /setShowValidation\(true\)/);
  assert.match(page, /if \(completeRows !== hourly\.length\)/);
  assert.match(page, /aria-describedby=\{completeRows !== hourly\.length \? "hours-readiness-message"/);
  assert.doesNotMatch(page, /disabled=\{completeRows !== hourly\.length\}/);
});

test("Juniper Trail quick example is gated to the fictional employee and exact hour target", async () => {
  const page = await read("../app/uat/time/page.tsx");
  assert.match(page, /businessName !== "Juniper Trail Coffee Co\." \|\| employee\.id !== "EMP-0002"/);
  assert.match(page, /target\.regular !== 80 \|\| target\.overtime !== 2\.5/);
  assert.match(page, /dates\.length !== 2 \|\| dates\[1\] !== "2026-08-24"/);
  assert.match(page, /\{ effectiveFrom: dates\[0\], regular: 40, overtime: 0, vacation: 0 \}/);
  assert.match(page, /\{ effectiveFrom: dates\[1\], regular: 40, overtime: 2\.5, vacation: 0 \}/);
  assert.match(page, /ready: false/);
});

test("owner-facing fonts are enlarged only on-screen, without changing Coffee Payroll theme or printed statements", async () => {
  const css = await read("../app/globals.css");
  const guided = await read("../app/guided-payroll/page.tsx");
  const time = await read("../app/uat/time/page.tsx");
  const statements = await read("../app/uat/statements/page.tsx");
  assert.match(css, /@media screen \{\s*\.coffee-payroll-readable \.text-xs/);
  assert.match(css, /font-size: 0\.875rem/);
  assert.match(css, /font-size: 1rem/);
  assert.match(guided, /coffee-payroll-readable min-h-screen/);
  assert.match(time, /coffee-payroll-readable min-h-screen/);
  assert.match(statements, /coffee-payroll-readable min-h-screen/);
  assert.match(css, /--background:\s*#fffaf5/i);
  assert.match(css, /--primary:\s*#1557d8/i);
  assert.match(css, /@media print/);
});
