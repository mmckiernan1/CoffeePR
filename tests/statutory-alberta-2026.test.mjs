import assert from "node:assert/strict";
import test from "node:test";

import { calculateAlbertaPayroll, PayrollCalculationError } from "../lib/payroll/statutory/calculate.ts";
import { calculateCpp } from "../lib/payroll/statutory/cpp.ts";
import { calculateEi } from "../lib/payroll/statutory/ei.ts";
import { ALBERTA_2026_RULES, rulesForAlbertaPayDate } from "../lib/payroll/statutory/rules-2026-ab.ts";

const emptyYtd = { pensionableEarningsCents: 0, cppCents: 0, cpp2Cents: 0, eiCents: 0 };

test("selects the pinned Alberta 2026 rule pack and rejects out-of-range dates", () => {
  assert.equal(rulesForAlbertaPayDate("2026-01-01").version, "CRA-T4127-2026-AB-v1");
  assert.equal(rulesForAlbertaPayDate("2026-12-31").version, "CRA-T4127-2026-AB-v1");
  assert.throws(() => rulesForAlbertaPayDate("2027-01-01"), /No validated Alberta statutory rules/);
});

test("reconciles the CRA T4032 Alberta below-YMPE worked example", () => {
  const result = calculateAlbertaPayroll({
    payDate: "2026-01-02",
    province: "AB",
    incomePath: "regular-periodic",
    payPeriodsPerYear: 52,
    periodsRemainingIncludingCurrent: 52,
    cashEarningsCents: 130_000,
    registeredPlanDeductionCents: 8_000,
    yearToDate: emptyYtd,
  });

  assert.equal(result.deductions.cppCents, 7_335);
  assert.equal(result.deductions.eiCents, 2_119);
  assert.equal(result.annualTaxableIncomeCents, 6_279_884);
  assert.equal(result.taxEvidence.annualFederalTaxCents, 595_785);
  assert.equal(result.taxEvidence.annualAlbertaTaxCents, 289_237);
  assert.equal(result.deductions.incomeTaxCents, 17_020);
  assert.equal(result.audit.formulaPath, "CRA_T4127_REGULAR_PERIODIC");
  assert.equal(result.audit.formulaSelectedBy, "employee-facts");
});

test("reconciles the CRA T4032 Alberta above-YMPE CPP2 worked example", () => {
  const result = calculateAlbertaPayroll({
    payDate: "2026-09-04",
    province: "AB",
    incomePath: "regular-periodic",
    payPeriodsPerYear: 52,
    periodsRemainingIncludingCurrent: 6,
    cashEarningsCents: 160_000,
    albertaClaimCents: 6_000_000,
    yearToDate: {
      pensionableEarningsCents: 7_520_000,
      cppCents: 423_045,
      cpp2Cents: 2_400,
      eiCents: 112_307,
    },
  });

  assert.equal(result.deductions.cppCents, 0);
  assert.equal(result.deductions.cpp2Cents, 6_400);
  assert.equal(result.deductions.eiCents, 0);
  assert.equal(result.annualTaxableIncomeCents, 7_987_200);
  assert.equal(result.taxEvidence.annualFederalTaxCents, 940_639);
  assert.equal(result.taxEvidence.annualAlbertaTaxCents, 152_295);
  assert.equal(result.deductions.incomeTaxCents, 21_018);
});

test("CPP and EI stop precisely at their 2026 employee maxima", () => {
  const cpp = calculateCpp({
    pensionableEarningsCents: 500_000,
    yearToDatePensionableEarningsCents: 8_000_000,
    yearToDateCppCents: 423_000,
    yearToDateCpp2Cents: 41_590,
    payPeriodsPerYear: 26,
    contributoryMonths: 12,
  }, ALBERTA_2026_RULES);
  const ei = calculateEi({ insurableEarningsCents: 500_000, yearToDateEiCents: 112_300 }, ALBERTA_2026_RULES);

  assert.equal(cpp.cppCents, 45);
  assert.equal(cpp.cpp2Cents, 10);
  assert.equal(ei.employeeEiCents, 7);
  assert.equal(ei.employerEiCents, 10);
});

test("taxable benefits increase remuneration but not cash available for net pay", () => {
  const result = calculateAlbertaPayroll({
    payDate: "2026-05-15",
    province: "AB",
    incomePath: "regular-periodic",
    payPeriodsPerYear: 26,
    periodsRemainingIncludingCurrent: 18,
    cashEarningsCents: 200_000,
    taxableBenefitsCents: 25_000,
    yearToDate: emptyYtd,
  });

  assert.equal(result.remunerationCents, 225_000);
  assert.equal(result.netPayCents, 200_000 - result.deductions.totalCents);
  assert.equal(result.employerContributions.totalCents, result.employerContributions.cppCents + result.employerContributions.eiCents);
});

test("net-pay and deduction invariants hold across representative periodic earnings", () => {
  for (const cashEarningsCents of [0, 50_000, 130_000, 350_000, 900_000]) {
    const result = calculateAlbertaPayroll({
      payDate: "2026-03-13",
      province: "AB",
      incomePath: "regular-periodic",
      payPeriodsPerYear: 26,
      periodsRemainingIncludingCurrent: 20,
      cashEarningsCents,
      yearToDate: emptyYtd,
    });
    assert.equal(result.netPayCents + result.deductions.totalCents, cashEarningsCents);
    assert.ok(result.deductions.cppCents >= 0);
    assert.ok(result.deductions.cpp2Cents >= 0);
    assert.ok(result.deductions.eiCents >= 0);
    assert.ok(result.deductions.incomeTaxCents >= 0);
  }
});

test("unsupported paths and negative net pay are blocking calculation errors", () => {
  assert.throws(() => calculateAlbertaPayroll({
    payDate: "2026-04-30",
    province: "AB",
    incomePath: "bonus",
    payPeriodsPerYear: 26,
    periodsRemainingIncludingCurrent: 18,
    cashEarningsCents: 100_000,
    yearToDate: emptyYtd,
  }), (error) => error instanceof PayrollCalculationError && error.code === "UNSUPPORTED_INCOME_PATH");

  assert.throws(() => calculateAlbertaPayroll({
    payDate: "2026-04-30",
    province: "AB",
    incomePath: "regular-periodic",
    payPeriodsPerYear: 26,
    periodsRemainingIncludingCurrent: 18,
    cashEarningsCents: 10_000,
    otherAfterTaxDeductionsCents: 20_000,
    yearToDate: emptyYtd,
  }), (error) => error instanceof PayrollCalculationError && error.code === "NEGATIVE_NET_PAY");
});
