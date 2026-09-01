import assert from "node:assert/strict";
import test from "node:test";

import { dollarsToCents, sumCents } from "../lib/payroll/money.ts";
import { approvePayRun, transitionPayRun } from "../lib/payroll/pay-run.ts";
import {
  generateRbcCpa005CreditFile,
  toRbcJulianDate,
  validateRbcCpa005CreditFile,
} from "../lib/payroll/rbc-cpa005.ts";

const config = {
  mode: "test",
  clientNumber: "0000000000",
  fileCreationNumber: "TEST",
  fileCreationDate: "2026-08-30",
  processingCentre: "00390",
  destinationCurrency: "CAD",
  clientShortName: "COMCHEQ DEMO",
  clientLegalName: "Prairie North Services Ltd.",
  includeRoutingRecord: true,
};

function payment(index, amountCents = 12345) {
  return {
    employeeId: `EMP-${String(index).padStart(4, "0")}`,
    customerName: `Fictional Employee ${index}`,
    amountCents,
    paymentDate: "2026-09-04",
    institutionNumber: "003",
    branchTransit: String(index).padStart(5, "0"),
    accountNumber: String(1000000 + index),
    transactionCode: "200",
    customerNumber: `EMP-${String(index).padStart(4, "0")}`,
    sundryInformation: "PAY RUN 17",
  };
}

test("money is represented and summed in integer cents", () => {
  assert.equal(dollarsToCents("1,234.56"), 123456);
  assert.equal(dollarsToCents(10.1), 1010);
  assert.equal(sumCents([1, 2, 3]), 6);
  assert.throws(() => dollarsToCents("12.345"), /Invalid dollar amount/);
});

test("pay-run lifecycle rejects shortcuts and creates one approval billing event", () => {
  const base = {
    id: "run-2026-17",
    employerId: "emp-prairie-north",
    payrollYear: 2026,
    runNumber: 17,
    periodStart: "2026-08-16",
    periodEnd: "2026-08-31",
    payDate: "2026-09-04",
    status: "draft",
    ruleset: {
      jurisdiction: "AB",
      effectiveFrom: "2026-07-01",
      version: "CRA-T4127-2026-07",
      source: "CRA T4127 123rd edition",
    },
    timeEntriesReady: true,
    blockingErrors: [],
    payments: [{
      employeeId: "EMP-0001",
      employeeName: "Fictional Employee",
      grossCents: 100000,
      incomeTaxCents: 15000,
      cppCents: 5000,
      eiCents: 2000,
      otherDeductionsCents: 3000,
      netPayCents: 75000,
    }],
  };

  assert.throws(() => transitionPayRun(base, "approved"), /Invalid pay-run transition/);
  const calculated = transitionPayRun(base, "calculated");
  const reviewed = transitionPayRun(calculated, "reviewed");
  const approved = approvePayRun(reviewed, { actorId: "demo-reviewer", approvedAt: "2026-08-30T22:00:00Z" });
  assert.equal(approved.status, "approved");
  assert.equal(approved.netBankTotalCents, 75000);
  assert.equal(approved.billingEvent.totalCents, 200);
  assert.equal(approved.billingEvent.quantity, 1);
  assert.ok(Object.isFrozen(approved));
  assert.ok(Object.isFrozen(approved.payments));
});

test("RBC Julian date uses 0YYDDD", () => {
  assert.equal(toRbcJulianDate("2026-01-01"), "026001");
  assert.equal(toRbcJulianDate("2026-08-30"), "026242");
});

test("RBC CPA005 creates balanced 1464-character A/C/Z records", () => {
  const amounts = [214081, 193677, 276733, 164800];
  const file = generateRbcCpa005CreditFile(config, amounts.map((amount, index) => payment(index + 1, amount)));
  assert.equal(file.logicalRecords.length, 3);
  assert.deepEqual(file.logicalRecords.map((record) => record.length), [1464, 1464, 1464]);
  assert.equal(file.logicalRecords[0].slice(0, 1), "A");
  assert.equal(file.logicalRecords[0].slice(1, 10), "000000001");
  assert.equal(file.logicalRecords[0].slice(20, 24), "TEST");
  assert.equal(file.logicalRecords[0].slice(24, 30), "026242");
  assert.equal(file.logicalRecords[0].slice(30, 35), "00390");
  assert.equal(file.logicalRecords[0].slice(55, 58), "CAD");
  assert.equal(file.logicalRecords[1].slice(24, 27), "200");
  assert.equal(file.logicalRecords[1].slice(27, 37), "0000214081");
  assert.equal(file.logicalRecords[2].slice(46, 60), "00000000849291");
  assert.equal(file.logicalRecords[2].slice(60, 68), "00000004");
  assert.match(file.content, /^\$\$AA01CPA1464\[TEST\[NL\$\$\r\nA/);
  assert.deepEqual(validateRbcCpa005CreditFile(file.content), file.control);
});

test("RBC CPA005 starts a second C record after six payments", () => {
  const file = generateRbcCpa005CreditFile(config, Array.from({ length: 7 }, (_, index) => payment(index + 1, 100 + index)));
  assert.equal(file.logicalRecords.length, 4);
  assert.equal(file.logicalRecords[3].slice(1, 10), "000000004");
  assert.equal(file.logicalRecords[3].slice(60, 68), "00000007");
});

test("RBC CPA005 blocks unsafe production placeholders and malformed accounts", () => {
  assert.throws(() => generateRbcCpa005CreditFile({
    ...config,
    mode: "production",
    fileCreationNumber: "0001",
  }, [payment(1)]), /RBC-assigned client number/);
  assert.throws(() => generateRbcCpa005CreditFile(config, [{ ...payment(1), accountNumber: "1234567890123" }]), /1 to 12 digits/);
});

test("RBC validator detects a tampered control total", () => {
  const file = generateRbcCpa005CreditFile(config, [payment(1)]);
  const lines = file.content.split("\r\n");
  lines[2] = `${lines[2].slice(0, 27)}0000009999${lines[2].slice(37)}`;
  assert.throws(() => validateRbcCpa005CreditFile(lines.join("\r\n")), /trailer amount/);
});
