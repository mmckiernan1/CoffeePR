import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/uat/payments/page.tsx", import.meta.url), "utf8");

test("fictional UAT offers only e-transfer and cheque employee payment methods", () => {
  assert.match(source, /Business e-transfer/);
  assert.match(source, /Business cheque/);
  assert.doesNotMatch(source, /EFT bank file/);
  assert.match(source, /Cheque number/);
  assert.match(source, /Bank confirmation \/ reference/);
});
