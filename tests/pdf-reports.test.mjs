import assert from "node:assert/strict";
import test from "node:test";

import { buildBrandedPdf, buildPayrollRegisterPdf } from "../lib/payroll/pdf.ts";

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

test("payroll register fits eight bordered employees per page and sorts by employee number", () => {
  const employees = Array.from({ length: 9 }, (_, index) => ({
    employeeNumber: `EMP-${String(9 - index).padStart(4, "0")}`,
    employeeName: `Employee ${9 - index}`,
    regularHours: "80.00", overtimeHours: "0.00", gross: "$2,000.00", incomeTax: "$250.00", cpp: "$100.00", ei: "$35.00", otherDeductions: "$0.00", netPay: "$1,615.00",
  }));
  const content = new TextDecoder().decode(buildPayrollRegisterPdf({ clientName: "Prairie North Services Ltd.", period: "Aug 16-31, 2026", payDate: "Sep 4, 2026", runLabel: "17 of 26", employees, grossTotal: "$18,000.00", deductionTotal: "$3,465.00", netTotal: "$14,535.00" }));
  assert.match(content, /\/Count 2/);
  assert.ok(content.indexOf("EMP-0001") < content.indexOf("EMP-0008"));
  assert.ok(content.indexOf("EMP-0008") < content.indexOf("EMP-0009"));
  assert.match(content, /NET PAY TOTAL/);
  assert.match(content, /Page 2 of 2/);
});
