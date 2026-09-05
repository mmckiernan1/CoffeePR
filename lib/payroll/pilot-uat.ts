import { buildFinalPay, isEmployeeInPayPeriod } from "@/lib/payroll/employee-lifecycle";
import { dollarsToCents } from "@/lib/payroll/money";
import { calculateAlbertaPayroll } from "@/lib/payroll/statutory/calculate";

export type PilotFinalPay = {
  vacationPay: number;
  overtimePay: number;
  otherTaxablePay: number;
  reimbursement: number;
};

export type PilotUatEmployee = {
  id: string;
  name: string;
  payType: "Salary" | "Hourly";
  rate: number;
  status: "Active" | "New hire" | "Terminating" | "Terminated";
  hireDate?: string;
  rateEffectiveDate?: string;
  terminationDate?: string;
  extraTaxablePay?: number;
  changeNote?: string;
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
    { id: "EMP-0001", name: "Avery Chen", payType: "Salary", rate: 80000, status: "Active", hireDate: "2024-01-08" },
    { id: "EMP-0002", name: "Noah Williams", payType: "Hourly", rate: 30, status: "Active", hireDate: "2024-05-13" },
    { id: "EMP-0003", name: "Priya Singh", payType: "Salary", rate: 111000, status: "Active", hireDate: "2023-09-05" },
    { id: "EMP-0004", name: "Liam Martin", payType: "Hourly", rate: 29.5, status: "Active", hireDate: "2025-02-03" },
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

export function pilotRegularGross(
  employee: PilotUatEmployee,
  timesheets: Record<string, PilotTimesheet>,
  frequency: string,
): number {
  if (employee.payType === "Salary") return employee.rate / pilotPeriodsPerYear(frequency);
  const row = timesheets[employee.id] ?? { regular: 0, overtime: 0, vacation: 0 };
  return row.regular * employee.rate + row.overtime * employee.rate * 1.5 + row.vacation * employee.rate;
}

export function pilotCalculateEmployee(
  employee: PilotUatEmployee,
  timesheets: Record<string, PilotTimesheet>,
  frequency: string,
): PilotCalculatedEmployee {
  const ordinaryGross = pilotRegularGross(employee, timesheets, frequency);
  const final = buildFinalPay({
    vacationPayCents: dollarsToCents(String(employee.finalPay?.vacationPay ?? 0)),
    overtimePayCents: dollarsToCents(String(employee.finalPay?.overtimePay ?? 0)),
    otherTaxablePayCents: dollarsToCents(String(employee.finalPay?.otherTaxablePay ?? 0)),
    reimbursementCents: dollarsToCents(String(employee.finalPay?.reimbursement ?? 0)),
  });
  const gross = ordinaryGross + (employee.extraTaxablePay ?? 0) + final.taxableGrossCents / 100;
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
  if (employee.rateEffectiveDate) changes.push(`Pay changed ${employee.rateEffectiveDate}`);
  if ((employee.extraTaxablePay ?? 0) > 0) changes.push(`Extra pay ${money(employee.extraTaxablePay ?? 0)}`);
  if (employee.status === "Terminating" || employee.status === "Terminated") changes.push(`Final pay · last day ${employee.terminationDate ?? "date needed"}`);
  if (employee.changeNote) changes.push(`Review note: ${employee.changeNote}`);
  return changes.join(" · ");
}
