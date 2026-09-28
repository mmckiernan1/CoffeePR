/**
 * Alberta Employment Standards general-holiday core rules.
 *
 * Source checked for the 2026 UAT:
 * https://www.alberta.ca/alberta-general-holidays
 *
 * This module expects wage history inputs to exclude overtime from the
 * average-daily-wage numerator, as required by Alberta Employment Standards.
 */

export type AlbertaHolidayWorkOption = "premium-plus-average" | "regular-plus-lieu";

export type AlbertaHolidayFacts = {
  workdaysInPrior12Months: number;
  regularDayOfWork: boolean;
  workedHoliday: boolean;
  absentWhenRequiredOnHoliday?: boolean;
  absentLastScheduledDayBeforeWithoutConsent?: boolean;
  absentFirstScheduledDayAfterWithoutConsent?: boolean;
};

export type AlbertaHolidayPayInput = AlbertaHolidayFacts & {
  payType: "Hourly" | "Salary";
  averageDailyWageCents: number;
  hourlyRateCents?: number;
  hoursWorked?: number;
  workOption?: AlbertaHolidayWorkOption;
};

function assertNonNegativeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be non-negative integer cents.`);
}

export function albertaIrregularScheduleRegularDay(workedSameWeekdayCount: number) {
  if (!Number.isInteger(workedSameWeekdayCount) || workedSameWeekdayCount < 0 || workedSameWeekdayCount > 9) {
    throw new RangeError("workedSameWeekdayCount must be between 0 and 9.");
  }
  return workedSameWeekdayCount >= 5;
}

export function albertaAverageDailyWageCents(eligibleWagesCents: number, daysWorked: number) {
  assertNonNegativeInteger(eligibleWagesCents, "eligibleWagesCents");
  if (!Number.isInteger(daysWorked) || daysWorked <= 0) throw new RangeError("daysWorked must be a positive integer.");
  return Math.round(eligibleWagesCents / daysWorked);
}

export function albertaGeneralHolidayEligibility(facts: AlbertaHolidayFacts) {
  if (!Number.isInteger(facts.workdaysInPrior12Months) || facts.workdaysInPrior12Months < 0) {
    throw new RangeError("workdaysInPrior12Months must be a non-negative integer.");
  }

  if (facts.workdaysInPrior12Months < 30) {
    return { eligible: false, reason: "Fewer than 30 workdays in the prior 12 months." } as const;
  }
  if (facts.absentWhenRequiredOnHoliday) {
    return { eligible: false, reason: "Absent when required or scheduled to work on the general holiday." } as const;
  }
  if (facts.absentLastScheduledDayBeforeWithoutConsent) {
    return { eligible: false, reason: "Absent without employer consent on the last scheduled day before the holiday." } as const;
  }
  if (facts.absentFirstScheduledDayAfterWithoutConsent) {
    return { eligible: false, reason: "Absent without employer consent on the first scheduled day after the holiday." } as const;
  }
  if (!facts.regularDayOfWork && !facts.workedHoliday) {
    return { eligible: false, reason: "The holiday is not a regular day of work and the employee did not work it." } as const;
  }
  return { eligible: true, reason: "Eligible for Alberta general-holiday treatment." } as const;
}

export function calculateAlbertaGeneralHolidayPay(input: AlbertaHolidayPayInput) {
  assertNonNegativeInteger(input.averageDailyWageCents, "averageDailyWageCents");
  const eligibility = albertaGeneralHolidayEligibility(input);
  if (!eligibility.eligible) {
    return {
      eligibility,
      salaryContinues: false,
      immediateHolidayPayCents: 0,
      futureDayOffPayCents: 0,
      treatment: "not-eligible",
    } as const;
  }

  if (!input.workedHoliday) {
    if (input.payType === "Salary" && input.regularDayOfWork) {
      return {
        eligibility,
        salaryContinues: true,
        immediateHolidayPayCents: 0,
        futureDayOffPayCents: 0,
        treatment: "salary-continues",
      } as const;
    }
    return {
      eligibility,
      salaryContinues: false,
      immediateHolidayPayCents: input.averageDailyWageCents,
      futureDayOffPayCents: 0,
      treatment: "average-daily-wage",
    } as const;
  }

  assertNonNegativeInteger(input.hourlyRateCents ?? -1, "hourlyRateCents");
  if (typeof input.hoursWorked !== "number" || !Number.isFinite(input.hoursWorked) || input.hoursWorked < 0) {
    throw new RangeError("hoursWorked must be a non-negative number.");
  }

  const regularWagesCents = Math.round((input.hourlyRateCents ?? 0) * input.hoursWorked);

  if (!input.regularDayOfWork) {
    return {
      eligibility,
      salaryContinues: false,
      immediateHolidayPayCents: Math.round(regularWagesCents * 1.5),
      futureDayOffPayCents: 0,
      treatment: "time-and-a-half-only",
    } as const;
  }

  if ((input.workOption ?? "premium-plus-average") === "regular-plus-lieu") {
    return {
      eligibility,
      salaryContinues: false,
      immediateHolidayPayCents: regularWagesCents,
      futureDayOffPayCents: input.averageDailyWageCents,
      treatment: "regular-wages-plus-future-day",
    } as const;
  }

  return {
    eligibility,
    salaryContinues: false,
    immediateHolidayPayCents: Math.round(regularWagesCents * 1.5) + input.averageDailyWageCents,
    futureDayOffPayCents: 0,
    treatment: "time-and-a-half-plus-average",
  } as const;
}
