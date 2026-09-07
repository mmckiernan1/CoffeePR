export type HourlyRateHistoryEntry = { effectiveDate: string; rate: number };
export type HourlyRateSplitEmployee = { rate: number; rateHistory?: HourlyRateHistoryEntry[] };
export type HourlyRateSplitRow = { effectiveFrom: string; regular: number; overtime: number; vacation: number };
export type HourlyRateSplitPeriod = { periodStart: string; periodEnd: string };
export type HourlyRateSplitDetail = HourlyRateSplitRow & { rate: number; gross: number };

function validHours(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 10_000;
}

export function pilotHourlyRateSegmentDates(employee: HourlyRateSplitEmployee, run: HourlyRateSplitPeriod): string[] {
  const dates = new Set<string>([run.periodStart]);
  for (const entry of employee.rateHistory ?? []) {
    if (entry.effectiveDate > run.periodStart && entry.effectiveDate <= run.periodEnd) dates.add(entry.effectiveDate);
  }
  return [...dates].sort();
}

export function pilotHourlyRateForSegment(employee: HourlyRateSplitEmployee, effectiveFrom: string): number {
  const history = (employee.rateHistory ?? [])
    .filter((entry) => entry.effectiveDate <= effectiveFrom)
    .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
  return history.at(-1)?.rate ?? employee.rate;
}

export function pilotHourlyRateSplitsComplete(
  employee: HourlyRateSplitEmployee,
  run: HourlyRateSplitPeriod,
  splits: unknown,
): splits is HourlyRateSplitRow[] {
  const expectedDates = pilotHourlyRateSegmentDates(employee, run);
  if (expectedDates.length <= 1) return true;
  if (!Array.isArray(splits) || splits.length !== expectedDates.length) return false;
  const ordered = [...splits].sort((left, right) => String(left?.effectiveFrom ?? "").localeCompare(String(right?.effectiveFrom ?? "")));
  return ordered.every((row, index) => row && typeof row === "object" && row.effectiveFrom === expectedDates[index] && validHours(row.regular) && validHours(row.overtime) && validHours(row.vacation));
}

export function pilotHourlyRateSplitDetails(employee: HourlyRateSplitEmployee, splits: HourlyRateSplitRow[]): HourlyRateSplitDetail[] {
  return [...splits]
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
    .map((split) => {
      const rate = pilotHourlyRateForSegment(employee, split.effectiveFrom);
      const gross = split.regular * rate + split.overtime * rate * 1.5 + split.vacation * rate;
      return { ...split, rate, gross };
    });
}

export function pilotHourlyGrossFromSplits(employee: HourlyRateSplitEmployee, splits: HourlyRateSplitRow[]): number {
  return pilotHourlyRateSplitDetails(employee, splits).reduce((total, split) => total + split.gross, 0);
}

export function normalizeHourlyRateSplits(input: unknown): HourlyRateSplitRow[] | null | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length > 12) return null;
  const rows: HourlyRateSplitRow[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    if (typeof row.effectiveFrom !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.effectiveFrom) || seen.has(row.effectiveFrom)) return null;
    if (![row.regular, row.overtime, row.vacation].every(validHours)) return null;
    seen.add(row.effectiveFrom);
    rows.push({ effectiveFrom: row.effectiveFrom, regular: row.regular as number, overtime: row.overtime as number, vacation: row.vacation as number });
  }
  return rows.sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
}
