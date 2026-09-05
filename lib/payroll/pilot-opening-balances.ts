import type { PilotOpeningBalance } from "./pilot-uat.ts";

function validIsoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validCents(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < 1_000_000_000;
}

export function normalizePilotOpeningBalances(
  input: unknown,
  allowedEmployeeIds?: Set<string>,
): Record<string, PilotOpeningBalance> | null {
  if (input === undefined) return {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > 250) return null;
  const result: Record<string, PilotOpeningBalance> = {};
  for (const [employeeId, raw] of entries) {
    if (!employeeId || employeeId.length > 80 || (allowedEmployeeIds && !allowedEmployeeIds.has(employeeId))) return null;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const value = raw as Record<string, unknown>;
    if (!validIsoDate(value.asOfDate)) return null;
    if (![value.taxableEarningsCents, value.pensionableEarningsCents, value.insurableEarningsCents, value.incomeTaxCents, value.cppCents, value.cpp2Cents, value.eiCents].every(validCents)) return null;
    if ((value.pensionableEarningsCents as number) > (value.taxableEarningsCents as number) * 2 || (value.insurableEarningsCents as number) > (value.taxableEarningsCents as number) * 2) return null;
    result[employeeId] = {
      asOfDate: value.asOfDate as string,
      taxableEarningsCents: value.taxableEarningsCents as number,
      pensionableEarningsCents: value.pensionableEarningsCents as number,
      insurableEarningsCents: value.insurableEarningsCents as number,
      incomeTaxCents: value.incomeTaxCents as number,
      cppCents: value.cppCents as number,
      cpp2Cents: value.cpp2Cents as number,
      eiCents: value.eiCents as number,
    };
  }
  return result;
}

export function pilotOpeningBalanceMap(rows: Array<{
  employeeId: string;
  asOfDate: string;
  taxableEarningsCents: number;
  pensionableEarningsCents: number;
  insurableEarningsCents: number;
  incomeTaxCents: number;
  cppCents: number;
  cpp2Cents: number;
  eiCents: number;
}>): Record<string, PilotOpeningBalance> {
  return Object.fromEntries(rows.map(({ employeeId, ...balance }) => [employeeId, balance]));
}
