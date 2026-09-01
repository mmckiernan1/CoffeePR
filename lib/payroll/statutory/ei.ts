import { assertMoneyCents, type MoneyCents } from "../money.ts";
import { multiplyFraction, multiplyRate, nonNegative } from "./math.ts";
import type { Alberta2026Rules } from "./rules-2026-ab.ts";

export interface EiCalculationInput {
  insurableEarningsCents: MoneyCents;
  yearToDateEiCents: MoneyCents;
  exempt?: boolean;
}

export interface EiCalculationResult {
  employeeEiCents: MoneyCents;
  employerEiCents: MoneyCents;
}

export function calculateEi(input: EiCalculationInput, rules: Alberta2026Rules): EiCalculationResult {
  assertMoneyCents(input.insurableEarningsCents, "insurableEarningsCents");
  assertMoneyCents(input.yearToDateEiCents, "yearToDateEiCents");
  if (input.insurableEarningsCents < 0 || input.yearToDateEiCents < 0) {
    throw new RangeError("EI earnings and year-to-date premiums cannot be negative.");
  }
  if (input.exempt) return { employeeEiCents: 0, employerEiCents: 0 };

  const remaining = nonNegative(rules.ei.maxEmployeePremiumCents - input.yearToDateEiCents);
  const employeeEiCents = Math.min(remaining, multiplyRate(input.insurableEarningsCents, rules.ei.employeeRateBasisPoints));
  return {
    employeeEiCents,
    employerEiCents: multiplyFraction(
      employeeEiCents,
      rules.ei.employerMultiplierNumerator,
      rules.ei.employerMultiplierDenominator,
    ),
  };
}
