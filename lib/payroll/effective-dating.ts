export type EffectiveRecord<T> = {
  id: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  value: T;
};

export type SalaryPeriod = {
  id: string;
  periodStart: string;
  periodEnd: string;
  paidSalaryCents: number;
};

export type SalaryRetroInput = {
  effectiveDate: string;
  previousAnnualSalaryCents: number;
  newAnnualSalaryCents: number;
  periodsPerYear: number;
  closedPeriods: SalaryPeriod[];
  prorationBasis?: "full-period" | "calendar-days" | "workdays";
};

export type SalaryRetroPeriodResult = SalaryPeriod & {
  previousRateDays: number;
  newRateDays: number;
  recalculatedSalaryCents: number;
  retroactiveDifferenceCents: number;
};

function assertIsoDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${field} must be a valid YYYY-MM-DD date.`);
  }
}

function toDate(value: string) {
  assertIsoDate(value, "Date");
  return new Date(`${value}T00:00:00Z`);
}

function dateRange(start: string, end: string) {
  const first = toDate(start);
  const last = toDate(end);
  if (first > last) throw new Error("Period start must not be after period end.");
  const dates: Date[] = [];
  for (let current = first; current <= last; current = new Date(current.getTime() + 86_400_000)) dates.push(current);
  return dates;
}

function eligibleDates(period: SalaryPeriod, basis: NonNullable<SalaryRetroInput["prorationBasis"]>) {
  const dates = dateRange(period.periodStart, period.periodEnd);
  if (basis !== "workdays") return dates;
  return dates.filter((date) => date.getUTCDay() !== 0 && date.getUTCDay() !== 6);
}

export function selectEffectiveRecord<T>(records: EffectiveRecord<T>[], asOfDate: string): EffectiveRecord<T> | null {
  assertIsoDate(asOfDate, "As-of date");
  const matching = records
    .filter((record) => record.effectiveFrom <= asOfDate && (!record.effectiveTo || record.effectiveTo >= asOfDate))
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom));
  if (matching.length > 1 && matching[0].effectiveFrom === matching[1].effectiveFrom) {
    throw new Error(`Conflicting effective records begin on ${matching[0].effectiveFrom}.`);
  }
  return matching[0] ?? null;
}

export function validateEffectiveTimeline<T>(records: EffectiveRecord<T>[]) {
  const sorted = [...records].sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
  sorted.forEach((record) => {
    assertIsoDate(record.effectiveFrom, "Effective-from date");
    if (record.effectiveTo) {
      assertIsoDate(record.effectiveTo, "Effective-to date");
      if (record.effectiveTo < record.effectiveFrom) throw new Error(`${record.id} ends before it begins.`);
    }
  });
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (!previous.effectiveTo || previous.effectiveTo >= current.effectiveFrom) {
      throw new Error(`${previous.id} overlaps ${current.id}.`);
    }
  }
  return sorted;
}

export function calculateSalaryRetro(input: SalaryRetroInput) {
  assertIsoDate(input.effectiveDate, "Effective date");
  if (!Number.isInteger(input.previousAnnualSalaryCents) || input.previousAnnualSalaryCents < 0) throw new Error("Previous annual salary must use non-negative integer cents.");
  if (!Number.isInteger(input.newAnnualSalaryCents) || input.newAnnualSalaryCents < 0) throw new Error("New annual salary must use non-negative integer cents.");
  if (!Number.isInteger(input.periodsPerYear) || input.periodsPerYear <= 0) throw new Error("Periods per year must be a positive integer.");

  const basis = input.prorationBasis ?? "workdays";
  const previousPeriodicCents = Math.round(input.previousAnnualSalaryCents / input.periodsPerYear);
  const newPeriodicCents = Math.round(input.newAnnualSalaryCents / input.periodsPerYear);
  const results: SalaryRetroPeriodResult[] = input.closedPeriods.map((period) => {
    if (!Number.isInteger(period.paidSalaryCents) || period.paidSalaryCents < 0) throw new Error(`${period.id} paid salary must use non-negative integer cents.`);
    const dates = eligibleDates(period, basis);
    if (dates.length === 0) throw new Error(`${period.id} has no eligible salary days.`);
    const effectiveTime = toDate(input.effectiveDate).getTime();
    const previousRateDays = dates.filter((date) => date.getTime() < effectiveTime).length;
    const newRateDays = dates.length - previousRateDays;
    const recalculatedSalaryCents = basis === "full-period"
      ? (period.periodEnd < input.effectiveDate ? previousPeriodicCents : newPeriodicCents)
      : Math.round((previousPeriodicCents * previousRateDays + newPeriodicCents * newRateDays) / dates.length);
    return { ...period, previousRateDays, newRateDays, recalculatedSalaryCents, retroactiveDifferenceCents: recalculatedSalaryCents - period.paidSalaryCents };
  });

  return {
    rulesetVersion: "COMCHEQ-EFFECTIVE-DATING-AB-2026-v1",
    jurisdiction: "AB",
    prorationBasis: basis,
    previousPeriodicCents,
    newPeriodicCents,
    periods: results,
    totalRetroactiveDifferenceCents: results.reduce((total, period) => total + period.retroactiveDifferenceCents, 0),
  } as const;
}
