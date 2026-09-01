import type { MoneyCents } from "../money.ts";

export interface TaxBracket {
  thresholdCents: MoneyCents;
  rateBasisPoints: number;
  constantCents: MoneyCents;
}

export const ALBERTA_2026_RULES = Object.freeze({
  jurisdiction: "AB",
  effectiveFrom: "2026-01-01",
  effectiveTo: "2026-12-31",
  version: "CRA-T4127-2026-AB-v1",
  calculationPath: "CRA_T4127_REGULAR_PERIODIC",
  source: {
    primary: "CRA T4127 122nd edition, effective January 1, 2026",
    confirmation: "CRA T4127 123rd edition, effective July 1, 2026 (no Alberta change)",
    validation: "CRA T4032-AB 2026 worked examples",
  },
  supportedPayPeriods: [12, 24, 26, 52],
  cpp: {
    ympeCents: 7_460_000,
    yampeCents: 8_500_000,
    basicExemptionCents: 350_000,
    employeeRateBasisPoints: 595,
    baseRateBasisPoints: 495,
    firstAdditionalRateBasisPoints: 100,
    maxEmployeeContributionCents: 423_045,
    maxBaseContributionCents: 351_945,
    cpp2RateBasisPoints: 400,
    maxCpp2ContributionCents: 41_600,
  },
  ei: {
    maxInsurableEarningsCents: 6_890_000,
    employeeRateBasisPoints: 163,
    employerMultiplierNumerator: 14,
    employerMultiplierDenominator: 10,
    maxEmployeePremiumCents: 112_307,
  },
  federal: {
    lowestRateBasisPoints: 1_400,
    brackets: [
      { thresholdCents: 0, rateBasisPoints: 1_400, constantCents: 0 },
      { thresholdCents: 5_852_300, rateBasisPoints: 2_050, constantCents: 380_400 },
      { thresholdCents: 11_704_500, rateBasisPoints: 2_600, constantCents: 1_024_100 },
      { thresholdCents: 18_144_000, rateBasisPoints: 2_900, constantCents: 1_568_500 },
      { thresholdCents: 25_848_200, rateBasisPoints: 3_300, constantCents: 2_602_400 },
    ] satisfies readonly TaxBracket[],
    basicPersonalMaximumCents: 1_645_200,
    basicPersonalMinimumCents: 1_482_900,
    basicPersonalPhaseoutStartCents: 18_144_000,
    basicPersonalPhaseoutEndCents: 25_848_200,
    canadaEmploymentAmountCents: 150_100,
  },
  alberta: {
    lowestRateBasisPoints: 800,
    brackets: [
      { thresholdCents: 0, rateBasisPoints: 800, constantCents: 0 },
      { thresholdCents: 6_120_000, rateBasisPoints: 1_000, constantCents: 122_400 },
      { thresholdCents: 15_425_900, rateBasisPoints: 1_200, constantCents: 430_900 },
      { thresholdCents: 18_511_100, rateBasisPoints: 1_300, constantCents: 616_000 },
      { thresholdCents: 24_681_300, rateBasisPoints: 1_400, constantCents: 862_800 },
      { thresholdCents: 37_022_000, rateBasisPoints: 1_500, constantCents: 1_233_100 },
    ] satisfies readonly TaxBracket[],
    basicPersonalAmountCents: 2_276_900,
    supplementalCreditThresholdCents: 489_600,
    supplementalCreditRateBasisPoints: 2_500,
  },
} as const);

export type Alberta2026Rules = typeof ALBERTA_2026_RULES;

export function rulesForAlbertaPayDate(payDate: string): Alberta2026Rules {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate)) {
    throw new TypeError("payDate must use YYYY-MM-DD format.");
  }
  if (payDate < ALBERTA_2026_RULES.effectiveFrom || payDate > ALBERTA_2026_RULES.effectiveTo) {
    throw new RangeError(`No validated Alberta statutory rules for pay date ${payDate}.`);
  }
  return ALBERTA_2026_RULES;
}
