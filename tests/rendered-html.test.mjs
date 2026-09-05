import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("declares production Coffee Payroll metadata without a development marker", async () => {
  const layoutPath = fileURLToPath(new URL("../app/layout.tsx", import.meta.url));
  const source = await readFile(layoutPath, "utf8");

  assert.match(source, /title:\s*["']Coffee Payroll["']/);
  assert.match(source, /Stress free Canadian payroll/i);
  assert.doesNotMatch(source, /codex-preview/i);
});
