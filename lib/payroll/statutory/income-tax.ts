import { assertMoneyCents, type MoneyCents } from "../money.ts";
import { multiplyFraction, multiplyRate, nonNegative, roundDivide } from "./math.ts";
import type { Alberta2026Rules, TaxBracket } from "./rules-2026-ab.ts";

export interface IncomeTaxCalculationInput {
  annualTaxableIncomeCents: MoneyCents;
  annualEmploymentIncomeCents: MoneyCents;
  currentCppBaseCents: MoneyCents;
  currentEiCents: MoneyCents;
  yearToDateCppCents: MoneyCents;
  yearToDateEiCents: MoneyCents;
  periodsRemainingIncludingCurrent: number;
  contributoryMonths: number;
  federalClaimCents?: MoneyCents;
  albertaClaimCents?: MoneyCents;
  additionalTaxCents?: MoneyCents;
  payPeriodsPerYear: number;
}

export interface IncomeTaxCalculationResult {
  incomeTaxCents: MoneyCents;
  annualFederalTaxCents: MoneyCents;
  annualAlbertaTaxCents: MoneyCents;
  federalClaimCents: MoneyCents;
  albertaClaimCents: MoneyCents;
  annualCppBaseCreditCents: MoneyCents;
  annualEiCreditCents: MoneyCents;
}

function selectBracket(annualIncomeCents: MoneyCents, brackets: readonly TaxBracket[]): TaxBracket {
  return [...brackets].reverse().find((bracket) => annualIncomeCents >= bracket.thresholdCents) ?? brackets[0];
}

function federalBasicPersonalAmount(annualIncomeCents: MoneyCents, rules: Alberta2026Rules): MoneyCents {
  const federal = rules.federal;
  if (annualIncomeCents <= federal.basicPersonalPhaseoutStartCents) return federal.basicPersonalMaximumCents;
  if (annualIncomeCents >= federal.basicPersonalPhaseoutEndCents) return federal.basicPersonalMinimumCents;
  const phaseout = roundDivide(
    (annualIncomeCents - federal.basicPersonalPhaseoutStartCents)
      * (federal.basicPersonalMaximumCents - federal.basicPersonalMinimumCents),
    federal.basicPersonalPhaseoutEndCents - federal.basicPersonalPhaseoutStartCents,
  );
  return federal.basicPersonalMaximumCents - phaseout;
}

export function calculateIncomeTax(input: IncomeTaxCalculationInput, rules: Alberta2026Rules): IncomeTaxCalculationResult {
  for (const [label, value] of Object.entries({
    annualTaxableIncomeCents: input.annualTaxableIncomeCents,
    annualEmploymentIncomeCents: input.annualEmploymentIncomeCents,
    currentCppBaseCents: input.currentCppBaseCents,
    currentEiCents: input.currentEiCents,
    yearToDateCppCents: input.yearToDateCppCents,
    yearToDateEiCents: input.yearToDateEiCents,
    additionalTaxCents: input.additionalTaxCents ?? 0,
  })) {
    assertMoneyCents(value, label);
    if (value < 0) throw new RangeError(`${label} cannot be negative.`);
  }
  if (!Number.isInteger(input.periodsRemainingIncludingCurrent)
    || input.periodsRemainingIncludingCurrent < 1
    || input.periodsRemainingIncludingCurrent > input.payPeriodsPerYear) {
    throw new RangeError("periodsRemainingIncludingCurrent must be within the payroll year.");
  }

  const annualIncome = nonNegative(input.annualTaxableIncomeCents);
  const cppBaseMaximum = roundDivide(rules.cpp.maxBaseContributionCents * input.contributoryMonths, 12);
  const ytdCppBase = multiplyFraction(
    input.yearToDateCppCents,
    rules.cpp.baseRateBasisPoints,
    rules.cpp.employeeRateBasisPoints,
  );
  const annualCppBaseCreditCents = Math.min(
    cppBaseMaximum,
    ytdCppBase + input.periodsRemainingIncludingCurrent * input.currentCppBaseCents,
  );
  const annualEiCreditCents = Math.min(
    rules.ei.maxEmployeePremiumCents,
    input.yearToDateEiCents + input.periodsRemainingIncludingCurrent * input.currentEiCents,
  );
  const federalClaimCents = input.federalClaimCents
    ?? federalBasicPersonalAmount(annualIncome, rules);
  const albertaClaimCents = input.albertaClaimCents ?? rules.alberta.basicPersonalAmountCents;
  assertMoneyCents(federalClaimCents, "federalClaimCents");
  assertMoneyCents(albertaClaimCents, "albertaClaimCents");
  if (federalClaimCents < 0 || albertaClaimCents < 0) throw new RangeError("TD1 claim amounts cannot be negative.");

  const federalBracket = selectBracket(annualIncome, rules.federal.brackets);
  const federalTaxBeforeCredits = nonNegative(
    multiplyRate(annualIncome, federalBracket.rateBasisPoints) - federalBracket.constantCents,
  );
  const canadaEmploymentBase = Math.min(input.annualEmploymentIncomeCents, rules.federal.canadaEmploymentAmountCents);
  const federalCreditBase = federalClaimCents + annualCppBaseCreditCents + annualEiCreditCents + canadaEmploymentBase;
  const annualFederalTaxCents = nonNegative(
    federalTaxBeforeCredits - multiplyRate(federalCreditBase, rules.federal.lowestRateBasisPoints),
  );

  const albertaBracket = selectBracket(annualIncome, rules.alberta.brackets);
  const albertaTaxBeforeCredits = nonNegative(
    multiplyRate(annualIncome, albertaBracket.rateBasisPoints) - albertaBracket.constantCents,
  );
  const albertaCreditBase = albertaClaimCents + annualCppBaseCreditCents + annualEiCreditCents;
  const albertaRegularCredits = multiplyRate(albertaCreditBase, rules.alberta.lowestRateBasisPoints);
  const albertaSupplementalCredit = multiplyRate(
    nonNegative(albertaRegularCredits - rules.alberta.supplementalCreditThresholdCents),
    rules.alberta.supplementalCreditRateBasisPoints,
  );
  const annualAlbertaTaxCents = nonNegative(
    albertaTaxBeforeCredits - albertaRegularCredits - albertaSupplementalCredit,
  );

  const incomeTaxCents = roundDivide(
    annualFederalTaxCents + annualAlbertaTaxCents,
    input.payPeriodsPerYear,
  ) + (input.additionalTaxCents ?? 0);

  return {
    incomeTaxCents,
    annualFederalTaxCents,
    annualAlbertaTaxCents,
    federalClaimCents,
    albertaClaimCents,
    annualCppBaseCreditCents,
    annualEiCreditCents,
  };
}
