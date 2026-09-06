export type PilotSalaryRateEntry = {
  effectiveDate: string;
  rate: number;
};

export type PilotSalaryRateProrationInput = {
  periodStart: string;
  periodEnd: string;
  periodsPerYear: number;
  fallbackAnnualRate: number;
  rateHistory?: PilotSalaryRateEntry[];
};

export type PilotSalaryRateSegment = {
  annualRate: number;
  workdays: number;
  amount: number;
};

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Date must use YYYY-MM-DD.");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Date must be valid.");
  return date;
}

function workdayStrings(start: string, end: string) {
  const first = parseIsoDate(start);
  const last = parseIsoDate(end);
  if (first > last) throw new Error("Period start must not be after period end.");
  const days: string[] = [];
  for (let current = first; current <= last; current = new Date(current.getTime() + 86_400_000)) {
    const weekday = current.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(current.toISOString().slice(0, 10));
  }
  if (days.length === 0) throw new Error("Pay period has no workdays available for salary proration.");
  return days;
}

function rateForDate(history: PilotSalaryRateEntry[], fallbackAnnualRate: number, date: string) {
  const applicable = history
    .filter((entry) => entry.effectiveDate <= date)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  return applicable.at(-1)?.rate ?? fallbackAnnualRate;
}

export function proratePilotSalaryRateChange(input: PilotSalaryRateProrationInput) {
  if (!Number.isFinite(input.fallbackAnnualRate) || input.fallbackAnnualRate <= 0) throw new Error("Fallback annual rate must be positive.");
  if (!Number.isInteger(input.periodsPerYear) || input.periodsPerYear <= 0) throw new Error("Periods per year must be a positive integer.");

  const history = [...(input.rateHistory ?? [])];
  for (const entry of history) {
    parseIsoDate(entry.effectiveDate);
    if (!Number.isFinite(entry.rate) || entry.rate <= 0) throw new Error("Salary history rates must be positive.");
  }

  const workdays = workdayStrings(input.periodStart, input.periodEnd);
  const byRate = new Map<number, number>();
  for (const day of workdays) {
    const rate = rateForDate(history, input.fallbackAnnualRate, day);
    byRate.set(rate, (byRate.get(rate) ?? 0) + 1);
  }

  const totalWorkdays = workdays.length;
  const segments: PilotSalaryRateSegment[] = [...byRate.entries()].map(([annualRate, days]) => ({
    annualRate,
    workdays: days,
    amount: (annualRate / input.periodsPerYear) * (days / totalWorkdays),
  }));

  return {
    totalWorkdays,
    segments,
    gross: segments.reduce((sum, segment) => sum + segment.amount, 0),
  };
}
