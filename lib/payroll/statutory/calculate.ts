import { assertMoneyCents, sumCents, type MoneyCents } from "../money.ts";
import { calculateCpp } from "./cpp.ts";
import { calculateEi } from "./ei.ts";
import { calculateIncomeTax } from "./income-tax.ts";
import { rulesForAlbertaPayDate } from "./rules-2026-ab.ts";

export type SupportedIncomePath = "regular-periodic";

export interface AlbertaPayrollCalculationInput {
  payDate: string;
  province: "AB";
  incomePath: SupportedIncomePath;
  payPeriodsPerYear: 12 | 24 | 26 | 52;
  periodsRemainingIncludingCurrent: number;
  contributoryMonths?: number;
  cashEarningsCents: MoneyCents;
  taxableBenefitsCents?: MoneyCents;
  pensionableEarningsCents?: MoneyCents;
  insurableEarningsCents?: MoneyCents;
  registeredPlanDeductionCents?: MoneyCents;
  unionDuesCents?: MoneyCents;
  otherAfterTaxDeductionsCents?: MoneyCents;
  additionalTaxCents?: MoneyCents;
  prescribedZoneAnnualDeductionCents?: MoneyCents;
  federalClaimCents?: MoneyCents;
  albertaClaimCents?: MoneyCents;
  cppExempt?: boolean;
  eiExempt?: boolean;
  yearToDate: {
    pensionableEarningsCents: MoneyCents;
    cppCents: MoneyCents;
    cpp2Cents: MoneyCents;
    eiCents: MoneyCents;
  };
}

export interface AlbertaPayrollCalculationResult {
  ruleset: {
    jurisdiction: "AB";
    effectiveFrom: string;
    effectiveTo: string;
    version: string;
    source: string;
  };
  audit: {
    formulaPath: string;
    formulaSelectedBy: "employee-facts";
    supportedScope: string;
  };
  remunerationCents: MoneyCents;
  annualTaxableIncomeCents: MoneyCents;
  deductions: {
    incomeTaxCents: MoneyCents;
    cppCents: MoneyCents;
    cpp2Cents: MoneyCents;
    eiCents: MoneyCents;
    registeredPlanCents: MoneyCents;
    unionDuesCents: MoneyCents;
    otherAfterTaxCents: MoneyCents;
    totalCents: MoneyCents;
  };
  employerContributions: {
    cppCents: MoneyCents;
    eiCents: MoneyCents;
    totalCents: MoneyCents;
  };
  netPayCents: MoneyCents;
  taxEvidence: {
    annualFederalTaxCents: MoneyCents;
    annualAlbertaTaxCents: MoneyCents;
    federalClaimCents: MoneyCents;
    albertaClaimCents: MoneyCents;
    annualCppBaseCreditCents: MoneyCents;
    annualEiCreditCents: MoneyCents;
  };
}

export class PayrollCalculationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PayrollCalculationError";
    this.code = code;
  }
}

function optionalMoney(value: MoneyCents | undefined, label: string): MoneyCents {
  const normalized = value ?? 0;
  assertMoneyCents(normalized, label);
  if (normalized < 0) throw new PayrollCalculationError("NEGATIVE_INPUT", `${label} cannot be negative.`);
  return normalized;
}

export function calculateAlbertaPayroll(input: AlbertaPayrollCalculationInput): AlbertaPayrollCalculationResult {
  if (input.province !== "AB") {
    throw new PayrollCalculationError("UNSUPPORTED_JURISDICTION", "This rule pack supports Alberta payroll only.");
  }
  if (input.incomePath !== "regular-periodic") {
    throw new PayrollCalculationError("UNSUPPORTED_INCOME_PATH", "Commission, bonus and other non-periodic paths require a separately validated calculation path.");
  }
  const rules = rulesForAlbertaPayDate(input.payDate);
  if (!rules.supportedPayPeriods.includes(input.payPeriodsPerYear)) {
    throw new PayrollCalculationError("UNSUPPORTED_PAY_FREQUENCY", "Supported frequencies are weekly, biweekly, semimonthly and monthly.");
  }

  const cashEarningsCents = optionalMoney(input.cashEarningsCents, "cashEarningsCents");
  const taxableBenefitsCents = optionalMoney(input.taxableBenefitsCents, "taxableBenefitsCents");
  const remunerationCents = sumCents([cashEarningsCents, taxableBenefitsCents]);
  const pensionableEarningsCents = input.pensionableEarningsCents ?? remunerationCents;
  const insurableEarningsCents = input.insurableEarningsCents ?? remunerationCents;
  const registeredPlanCents = optionalMoney(input.registeredPlanDeductionCents, "registeredPlanDeductionCents");
  const unionDuesCents = optionalMoney(input.unionDuesCents, "unionDuesCents");
  const otherAfterTaxCents = optionalMoney(input.otherAfterTaxDeductionsCents, "otherAfterTaxDeductionsCents");
  const prescribedZoneCents = optionalMoney(input.prescribedZoneAnnualDeductionCents, "prescribedZoneAnnualDeductionCents");
  const contributoryMonths = input.contributoryMonths ?? 12;

  const cpp = calculateCpp({
    pensionableEarningsCents,
    yearToDatePensionableEarningsCents: input.yearToDate.pensionableEarningsCents,
    yearToDateCppCents: input.yearToDate.cppCents,
    yearToDateCpp2Cents: input.yearToDate.cpp2Cents,
    payPeriodsPerYear: input.payPeriodsPerYear,
    contributoryMonths,
    exempt: input.cppExempt,
  }, rules);
  const ei = calculateEi({
    insurableEarningsCents,
    yearToDateEiCents: input.yearToDate.eiCents,
    exempt: input.eiExempt,
  }, rules);

  const taxDeductibleCppCents = cpp.cppFirstAdditionalPortionCents + cpp.cpp2Cents;
  const taxablePeriodCents = remunerationCents - registeredPlanCents - unionDuesCents - taxDeductibleCppCents;
  const annualTaxableIncomeCents = Math.max(
    0,
    taxablePeriodCents * input.payPeriodsPerYear - prescribedZoneCents,
  );
  const tax = calculateIncomeTax({
    annualTaxableIncomeCents,
    annualEmploymentIncomeCents: remunerationCents * input.payPeriodsPerYear,
    currentCppBaseCents: cpp.cppBasePortionCents,
    currentEiCents: ei.employeeEiCents,
    yearToDateCppCents: input.yearToDate.cppCents,
    yearToDateEiCents: input.yearToDate.eiCents,
    periodsRemainingIncludingCurrent: input.periodsRemainingIncludingCurrent,
    contributoryMonths,
    federalClaimCents: input.federalClaimCents,
    albertaClaimCents: input.albertaClaimCents,
    additionalTaxCents: input.additionalTaxCents,
    payPeriodsPerYear: input.payPeriodsPerYear,
  }, rules);

  const totalDeductionsCents = sumCents([
    tax.incomeTaxCents,
    cpp.cppCents,
    cpp.cpp2Cents,
    ei.employeeEiCents,
    registeredPlanCents,
    unionDuesCents,
    otherAfterTaxCents,
  ]);
  const netPayCents = cashEarningsCents - totalDeductionsCents;
  if (netPayCents < 0) {
    throw new PayrollCalculationError("NEGATIVE_NET_PAY", "Deductions exceed cash earnings; the payment must be reviewed before approval.");
  }

  return Object.freeze({
    ruleset: {
      jurisdiction: rules.jurisdiction,
      effectiveFrom: rules.effectiveFrom,
      effectiveTo: rules.effectiveTo,
      version: rules.version,
      source: `${rules.source.primary}; ${rules.source.confirmation}`,
    },
    audit: {
      formulaPath: rules.calculationPath,
      formulaSelectedBy: "employee-facts",
      supportedScope: "Alberta regular periodic salary/hourly earnings; common 12/24/26/52 frequencies",
    },
    remunerationCents,
    annualTaxableIncomeCents,
    deductions: {
      incomeTaxCents: tax.incomeTaxCents,
      cppCents: cpp.cppCents,
      cpp2Cents: cpp.cpp2Cents,
      eiCents: ei.employeeEiCents,
      registeredPlanCents,
      unionDuesCents,
      otherAfterTaxCents,
      totalCents: totalDeductionsCents,
    },
    employerContributions: {
      cppCents: cpp.employerCppCents,
      eiCents: ei.employerEiCents,
      totalCents: cpp.employerCppCents + ei.employerEiCents,
    },
    netPayCents,
    taxEvidence: {
      annualFederalTaxCents: tax.annualFederalTaxCents,
      annualAlbertaTaxCents: tax.annualAlbertaTaxCents,
      federalClaimCents: tax.federalClaimCents,
      albertaClaimCents: tax.albertaClaimCents,
      annualCppBaseCreditCents: tax.annualCppBaseCreditCents,
      annualEiCreditCents: tax.annualEiCreditCents,
    },
  });
}
