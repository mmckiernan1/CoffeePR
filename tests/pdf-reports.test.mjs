import assert from "node:assert/strict";
import test from "node:test";

import { buildBrandedPdf } from "../lib/payroll/pdf.ts";

test("branded payroll reports produce a valid one-page PDF with required statement labels", () => {
  const bytes = buildBrandedPdf({
    clientName: "Prairie North Services Ltd.",
    title: "Pay statement",
    subtitle: "Pay run 17",
    metadata: [{ label: "Statement period", value: "Aug 16-31, 2026" }],
    sections: [{ title: "Hours and rates", rows: [{ label: "Regular hours", detail: "Rate $30.00", value: "80.00" }] }],
    footer: "Confidential employee statement - view and print access provided.",
  });
  const content = new TextDecoder().decode(bytes);
  assert.match(content, /^%PDF-1\.4/);
  assert.match(content, /Prairie North Services Ltd\./);
  assert.match(content, /STATEMENT PERIOD/);
  assert.match(content, /Regular hours/);
  assert.match(content, /startxref\n\d+\n%%EOF/);
});
