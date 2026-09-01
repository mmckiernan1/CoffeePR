import { assertMoneyCents, type MoneyCents } from "../money.ts";
import { multiplyFraction, multiplyRate, nonNegative, roundDivide } from "./math.ts";
import type { Alberta2026Rules } from "./rules-2026-ab.ts";

export interface CppCalculationInput {
  pensionableEarningsCents: MoneyCents;
  yearToDatePensionableEarningsCents: MoneyCents;
  yearToDateCppCents: MoneyCents;
  yearToDateCpp2Cents: MoneyCents;
  payPeriodsPerYear: number;
  contributoryMonths: number;
  exempt?: boolean;
}

export interface CppCalculationResult {
  cppCents: MoneyCents;
  cppBasePortionCents: MoneyCents;
  cppFirstAdditionalPortionCents: MoneyCents;
  cpp2Cents: MoneyCents;
  employerCppCents: MoneyCents;
}

export function calculateCpp(input: CppCalculationInput, rules: Alberta2026Rules): CppCalculationResult {
  for (const [label, value] of Object.entries({
    pensionableEarningsCents: input.pensionableEarningsCents,
    yearToDatePensionableEarningsCents: input.yearToDatePensionableEarningsCents,
    yearToDateCppCents: input.yearToDateCppCents,
    yearToDateCpp2Cents: input.yearToDateCpp2Cents,
  })) {
    assertMoneyCents(value, label);
    if (value < 0) throw new RangeError(`${label} cannot be negative.`);
  }
  if (!Number.isInteger(input.payPeriodsPerYear) || input.payPeriodsPerYear <= 0) {
    throw new RangeError("payPeriodsPerYear must be a positive integer.");
  }
  if (!Number.isInteger(input.contributoryMonths) || input.contributoryMonths < 1 || input.contributoryMonths > 12) {
    throw new RangeError("contributoryMonths must be between 1 and 12.");
  }
  if (input.exempt) {
    return { cppCents: 0, cppBasePortionCents: 0, cppFirstAdditionalPortionCents: 0, cpp2Cents: 0, employerCppCents: 0 };
  }

  const cppMaximum = roundDivide(rules.cpp.maxEmployeeContributionCents * input.contributoryMonths, 12);
  const cppRemaining = nonNegative(cppMaximum - input.yearToDateCppCents);
  const contributoryNumerator = input.pensionableEarningsCents * input.payPeriodsPerYear - rules.cpp.basicExemptionCents;
  const currentCpp = nonNegative(roundDivide(
    Math.max(0, contributoryNumerator) * rules.cpp.employeeRateBasisPoints,
    input.payPeriodsPerYear * 10_000,
  ));
  const cppCents = Math.min(cppRemaining, currentCpp);
  const cppBasePortionCents = multiplyFraction(
    cppCents,
    rules.cpp.baseRateBasisPoints,
    rules.cpp.employeeRateBasisPoints,
  );
  const cppFirstAdditionalPortionCents = multiplyFraction(
    cppCents,
    rules.cpp.firstAdditionalRateBasisPoints,
    rules.cpp.employeeRateBasisPoints,
  );

  const cpp2Maximum = roundDivide(rules.cpp.maxCpp2ContributionCents * input.contributoryMonths, 12);
  const cpp2Remaining = nonNegative(cpp2Maximum - input.yearToDateCpp2Cents);
  const proratedYmpe = roundDivide(rules.cpp.ympeCents * input.contributoryMonths, 12);
  const w = Math.max(input.yearToDatePensionableEarningsCents, proratedYmpe);
  const cpp2ContributoryCents = nonNegative(
    input.yearToDatePensionableEarningsCents + input.pensionableEarningsCents - w,
  );
  const cpp2Cents = Math.min(cpp2Remaining, multiplyRate(cpp2ContributoryCents, rules.cpp.cpp2RateBasisPoints));

  return {
    cppCents,
    cppBasePortionCents,
    cppFirstAdditionalPortionCents,
    cpp2Cents,
    employerCppCents: cppCents + cpp2Cents,
  };
}
