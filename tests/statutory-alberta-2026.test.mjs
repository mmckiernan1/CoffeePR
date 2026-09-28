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


test("Juniper Trail periodic employees reconcile to the fictional UAT answer key", () => {
  const cases = [
    {
      name: "Avery Chen",
      grossCents: 307_692,
      ytd: { pensionableEarningsCents: 4_923_072, cppCents: 280_000, cpp2Cents: 0, eiCents: 80_000 },
      expected: { tax: 53_009, cpp: 17_507, cpp2: 0, ei: 5_015, net: 232_161 },
    },
    {
      name: "Noah Williams",
      grossCents: 253_625,
      ytd: { pensionableEarningsCents: 3_600_000, cppCents: 210_000, cpp2Cents: 0, eiCents: 58_000 },
      expected: { tax: 37_423, cpp: 14_290, cpp2: 0, ei: 4_134, net: 197_778 },
    },
    {
      name: "Priya Singh",
      grossCents: 426_923,
      ytd: { pensionableEarningsCents: 6_826_923, cppCents: 390_000, cpp2Cents: 0, eiCents: 111_000 },
      expected: { tax: 89_011, cpp: 24_601, cpp2: 0, ei: 1_307, net: 312_004 },
    },
    {
      name: "Liam Martin",
      grossCents: 188_800,
      ytd: { pensionableEarningsCents: 2_900_000, cppCents: 165_000, cpp2Cents: 0, eiCents: 47_000 },
      expected: { tax: 22_023, cpp: 10_433, cpp2: 0, ei: 3_077, net: 153_267 },
    },
  ];

  for (const item of cases) {
    const result = calculateAlbertaPayroll({
      payDate: "2026-09-04",
      province: "AB",
      incomePath: "regular-periodic",
      payPeriodsPerYear: 26,
      periodsRemainingIncludingCurrent: 9,
      cashEarningsCents: item.grossCents,
      federalClaimCents: 1_645_200,
      albertaClaimCents: 2_276_900,
      yearToDate: item.ytd,
    });
    assert.equal(result.deductions.incomeTaxCents, item.expected.tax, item.name);
    assert.equal(result.deductions.cppCents, item.expected.cpp, item.name);
    assert.equal(result.deductions.cpp2Cents, item.expected.cpp2, item.name);
    assert.equal(result.deductions.eiCents, item.expected.ei, item.name);
    assert.equal(result.netPayCents, item.expected.net, item.name);
  }
});
