import { pilotHourlyRateSplitsComplete } from "./pilot-hourly-rate-split";

export type PilotRateChangeEmployee = {
  id: string;
  name?: string;
  payType?: "Salary" | "Hourly";
  rate: number;
  rateEffectiveDate?: string;
  rateHistory?: Array<{ effectiveDate: string; rate: number }>;
};

export type PilotRunWindow = {
  periodStart: string;
  periodEnd: string;
};

export type PilotMidPeriodRateChange = {
  employeeId: string;
  employeeName?: string;
  effectiveDates: string[];
};

export function pilotMidPeriodRateChanges(
  employees: PilotRateChangeEmployee[],
  run: PilotRunWindow,
): PilotMidPeriodRateChange[] {
  return employees.flatMap((employee) => {
    if (employee.payType === "Salary") return [];
    const dates = new Set<string>();
    for (const entry of employee.rateHistory ?? []) {
      if (entry.effectiveDate > run.periodStart && entry.effectiveDate <= run.periodEnd) dates.add(entry.effectiveDate);
    }
    if (employee.rateEffectiveDate && employee.rateEffectiveDate > run.periodStart && employee.rateEffectiveDate <= run.periodEnd) {
      dates.add(employee.rateEffectiveDate);
    }
    const effectiveDates = [...dates].sort();
    return effectiveDates.length > 0
      ? [{ employeeId: employee.id, employeeName: employee.name, effectiveDates }]
      : [];
  });
}

export function pilotUnresolvedHourlyRateChanges(
  employees: PilotRateChangeEmployee[],
  timesheets: Record<string, unknown>,
  run: PilotRunWindow,
): PilotMidPeriodRateChange[] {
  return pilotMidPeriodRateChanges(employees, run).filter((change) => {
    const employee = employees.find((item) => item.id === change.employeeId);
    if (!employee) return true;
    const row = timesheets[change.employeeId] as { rateSplits?: unknown } | undefined;
    return !pilotHourlyRateSplitsComplete(employee, run, row?.rateSplits);
  });
}

export function pilotHasMidPeriodRateChange(
  employees: PilotRateChangeEmployee[],
  run: PilotRunWindow,
): boolean {
  return pilotMidPeriodRateChanges(employees, run).length > 0;
}
