import { buildFinalPay, isEmployeeInPayPeriod } from "@/lib/payroll/employee-lifecycle";
import { dollarsToCents } from "@/lib/payroll/money";
import { calculateAlbertaPayroll } from "@/lib/payroll/statutory/calculate";

export type PilotFinalPay = {
  vacationPayCents: number;
  overtimePayCents: number;
  otherTaxablePayCents: number;
  reimbursementCents: number;
};

export type PilotRateHistoryEntry = {
  effectiveDate: string;
  rate: number;
};

type LegacyPilotFinalPay = {
  vacationPay?: number;
  overtimePay?: number;
  otherTaxablePay?: number;
  reimbursement?: number;
};

type LegacyPilotExtraPay = {
  extraTaxablePay?: number;
};

export type PilotUatEmployee = {
  id: string;
  name: string;
  payType: "Salary" | "Hourly";
  rate: number;
  rateHistory?: PilotRateHistoryEntry[];
  status: "Active" | "New hire" | "Terminating" | "Terminated";
  hireDate?: string;
  rateEffectiveDate?: string;
  terminationDate?: string;
  extraTaxablePayCents?: number;
  changeNote?: string;
  taxSetupComplete?: boolean;
  finalPay?: PilotFinalPay;
};

export type PilotTimesheet = {
  regular: number;
  overtime: number;
  vacation: number;
};

export type PilotUatState = {
  employees: PilotUatEmployee[];
  timesheets: Record<string, PilotTimesheet>;
  ready: boolean;
};

export type PilotProfile = {
  businessName: string;
  province: string;
  frequency: string;
  employeeCount: number;
};

export type PilotCalculatedEmployee = PilotUatEmployee & {
  appliedRate: number;
  gross: number;
  reimbursement: number;
  incomeTax: number;
  cpp: number;
  cpp2: number;
  ei: number;
  net: number;
  employerCpp: number;
  employerEi: number;
};

export const PILOT_UAT_STORAGE_KEY = "coffee-payroll:pilot-uat";

export const PILOT_RUN_PERIOD = {
  periodStart: "2026-08-16",
  periodEnd: "2026-08-31",
  payDate: "2026-09-04",
} as const;

export const PILOT_STARTER_STATE: PilotUatState = {
  employees: [
    { id: "EMP-0001", name: "Avery Chen", payType: "Salary", rate: 80000, rateHistory: [{ effectiveDate: "2024-01-08", rate: 80000 }], status: "Active", hireDate: "2024-01-08", taxSetupComplete: true },
    { id: "EMP-0002", name: "Noah Williams", payType: "Hourly", rate: 30, rateHistory: [{ effectiveDate: "2024-05-13", rate: 30 }], status: "Active", hireDate: "2024-05-13", taxSetupComplete: true },
    { id: "EMP-0003", name: "Priya Singh", payType: "Salary", rate: 111000, rateHistory: [{ effectiveDate: "2023-09-05", rate: 111000 }], status: "Active", hireDate: "2023-09-05", taxSetupComplete: true },
    { id: "EMP-0004", name: "Liam Martin", payType: "Hourly", rate: 29.5, rateHistory: [{ effectiveDate: "2025-02-03", rate: 29.5 }], status: "Active", hireDate: "2025-02-03", taxSetupComplete: true },
  ],
  timesheets: {
    "EMP-0002": { regular: 80, overtime: 2.5, vacation: 0 },
    "EMP-0004": { regular: 72, overtime: 0, vacation: 0 },
  },
  ready: false,
};

const baselineYtd: Record<string, {
  pensionableEarningsCents: number;
  cppCents: number;
  cpp2Cents: number;
  eiCents: number;
}> = {
  "EMP-0001": { pensionableEarningsCents: 4_923_072, cppCents: 280_000, cpp2Cents: 0, eiCents: 80_000 },
  "EMP-0002": { pensionableEarningsCents: 3_600_000, cppCents: 210_000, cpp2Cents: 0, eiCents: 58_000 },
  "EMP-0003": { pensionableEarningsCents: 6_826_923, cppCents: 390_000, cpp2Cents: 0, eiCents: 111_000 },
  "EMP-0004": { pensionableEarningsCents: 2_900_000, cppCents: 165_000, cpp2Cents: 0, eiCents: 47_000 },
};

export function pilotPeriodsPerYear(frequency: string): 12 | 24 | 26 | 52 {
  if (frequency === "Weekly") return 52;
  if (frequency === "Semi-monthly") return 24;
  if (frequency === "Monthly") return 12;
  return 26;
}

export function pilotEmployeeIsInRun(employee: PilotUatEmployee): boolean {
  try {
    return isEmployeeInPayPeriod({
      hireDate: employee.hireDate ?? "2020-01-01",
      terminationDate: employee.terminationDate ?? null,
      status: employee.status,
    }, PILOT_RUN_PERIOD);
  } catch {
    return true;
  }
}

export function pilotTaxSetupReady(employee: PilotUatEmployee): boolean {
  return employee.status !== "New hire" || employee.taxSetupComplete === true;
}

export function pilotRateForDate(employee: PilotUatEmployee, date = PILOT_RUN_PERIOD.periodEnd): number {
  const history = (employee.rateHistory ?? [])
    .filter((entry) => entry.effectiveDate <= date)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  return history.at(-1)?.rate ?? employee.rate;
}

export function pilotRateHistoryWithChange(employee: PilotUatEmployee, effectiveDate: string, rate: number): PilotRateHistoryEntry[] {
  const baselineDate = employee.hireDate ?? "2020-01-01";
  const existing = employee.rateHistory?.length
    ? employee.rateHistory
    : [{ effectiveDate: employee.rateEffectiveDate ?? baselineDate, rate: employee.rate }];
  const withoutSameDate = existing.filter((entry) => entry.effectiveDate !== effectiveDate);
  return [...withoutSameDate, { effectiveDate, rate }].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

function pilotFinalPayCents(finalPay: PilotFinalPay | undefined): PilotFinalPay {
  if (!finalPay) return { vacationPayCents: 0, overtimePayCents: 0, otherTaxablePayCents: 0, reimbursementCents: 0 };
  const candidate = finalPay as PilotFinalPay & LegacyPilotFinalPay;
  if ([candidate.vacationPayCents, candidate.overtimePayCents, candidate.otherTaxablePayCents, candidate.reimbursementCents].every(Number.isSafeInteger)) {
    return {
      vacationPayCents: candidate.vacationPayCents,
      overtimePayCents: candidate.overtimePayCents,
      otherTaxablePayCents: candidate.otherTaxablePayCents,
      reimbursementCents: candidate.reimbursementCents,
    };
  }
  return {
    vacationPayCents: dollarsToCents(String(candidate.vacationPay ?? 0)),
    overtimePayCents: dollarsToCents(String(candidate.overtimePay ?? 0)),
    otherTaxablePayCents: dollarsToCents(String(candidate.otherTaxablePay ?? 0)),
    reimbursementCents: dollarsToCents(String(candidate.reimbursement ?? 0)),
  };
}

export function pilotFinalPayDollars(finalPay: PilotFinalPay | undefined) {
  const cents = pilotFinalPayCents(finalPay);
  return {
    vacationPay: cents.vacationPayCents / 100,
    overtimePay: cents.overtimePayCents / 100,
    otherTaxablePay: cents.otherTaxablePayCents / 100,
    reimbursement: cents.reimbursementCents / 100,
  };
}

export function pilotExtraTaxablePayCents(employee: PilotUatEmployee): number {
  if (Number.isSafeInteger(employee.extraTaxablePayCents) && (employee.extraTaxablePayCents ?? 0) >= 0) {
    return employee.extraTaxablePayCents ?? 0;
  }
  const legacy = employee as PilotUatEmployee & LegacyPilotExtraPay;
  return dollarsToCents(String(legacy.extraTaxablePay ?? 0));
}

export function pilotExtraTaxablePayDollars(employee: PilotUatEmployee): number {
  return pilotExtraTaxablePayCents(employee) / 100;
}

export function pilotRegularGross(
  employee: PilotUatEmployee,
  timesheets: Record<string, PilotTimesheet>,
  frequency: string,
): number {
  const rate = pilotRateForDate(employee);
  if (employee.payType === "Salary") return rate / pilotPeriodsPerYear(frequency);
  const row = timesheets[employee.id] ?? { regular: 0, overtime: 0, vacation: 0 };
  return row.regular * rate + row.overtime * rate * 1.5 + row.vacation * rate;
}

export function pilotCalculateEmployee(
  employee: PilotUatEmployee,
  timesheets: Record<string, PilotTimesheet>,
  frequency: string,
): PilotCalculatedEmployee {
  const appliedRate = pilotRateForDate(employee);
  const ordinaryGross = pilotRegularGross(employee, timesheets, frequency);
  const finalPay = pilotFinalPayCents(employee.finalPay);
  const final = buildFinalPay(finalPay);
  const gross = ordinaryGross + pilotExtraTaxablePayDollars(employee) + final.taxableGrossCents / 100;
  const reimbursement = final.reimbursementCents / 100;
  const ppy = pilotPeriodsPerYear(frequency);
  const result = calculateAlbertaPayroll({
    payDate: PILOT_RUN_PERIOD.payDate,
    province: "AB",
    incomePath: "regular-periodic",
    payPeriodsPerYear: ppy,
    periodsRemainingIncludingCurrent: Math.max(1, Math.round(ppy * 0.33)),
    cashEarningsCents: dollarsToCents(gross.toFixed(2)),
    federalClaimCents: 1_645_200,
    albertaClaimCents: 2_276_900,
    yearToDate: baselineYtd[employee.id] ?? {
      pensionableEarningsCents: 0,
      cppCents: 0,
      cpp2Cents: 0,
      eiCents: 0,
    },
  });

  return {
    ...employee,
    appliedRate,
    gross,
    reimbursement,
    incomeTax: result.deductions.incomeTaxCents / 100,
    cpp: result.deductions.cppCents / 100,
    cpp2: result.deductions.cpp2Cents / 100,
    ei: result.deductions.eiCents / 100,
    net: result.netPayCents / 100 + reimbursement,
    employerCpp: result.employerContributions.cppCents / 100,
    employerEi: result.employerContributions.eiCents / 100,
  };
}

export function pilotChangeSummary(employee: PilotUatEmployee, currency = false): string {
  const changes: string[] = [];
  const money = (value: number) => currency
    ? value.toLocaleString("en-CA", { style: "currency", currency: "CAD" })
    : `$${value.toFixed(2)}`;
  if (employee.status === "New hire") changes.push(`New hire${employee.hireDate ? ` · hired ${employee.hireDate}` : ""}`);
  if (employee.status === "New hire" && !pilotTaxSetupReady(employee)) changes.push("Tax setup needed");
  if (employee.rateEffectiveDate) changes.push(`Pay changed ${employee.rateEffectiveDate}`);
  const extraPay = pilotExtraTaxablePayDollars(employee);
  if (extraPay > 0) changes.push(`Extra pay ${money(extraPay)}`);
  if (employee.status === "Terminating" || employee.status === "Terminated") changes.push(`Final pay · last day ${employee.terminationDate ?? "date needed"}`);
  if (employee.changeNote) changes.push(`Review note: ${employee.changeNote}`);
  return changes.join(" · ");
}
