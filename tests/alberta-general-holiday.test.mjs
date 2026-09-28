import assert from "node:assert/strict";
import test from "node:test";

import {
  albertaAverageDailyWageCents,
  albertaGeneralHolidayEligibility,
  albertaIrregularScheduleRegularDay,
  calculateAlbertaGeneralHolidayPay,
} from "../lib/payroll/alberta-general-holiday.ts";

test("Alberta irregular schedules use the 5-of-9 regular-day test", () => {
  assert.equal(albertaIrregularScheduleRegularDay(4), false);
  assert.equal(albertaIrregularScheduleRegularDay(5), true);
  assert.equal(albertaIrregularScheduleRegularDay(9), true);
});

test("Alberta general-holiday eligibility requires 30 workdays and attendance rules", () => {
  assert.equal(albertaGeneralHolidayEligibility({
    workdaysInPrior12Months: 29,
    regularDayOfWork: true,
    workedHoliday: false,
  }).eligible, false);

  assert.equal(albertaGeneralHolidayEligibility({
    workdaysInPrior12Months: 30,
    regularDayOfWork: true,
    workedHoliday: false,
  }).eligible, true);

  assert.equal(albertaGeneralHolidayEligibility({
    workdaysInPrior12Months: 100,
    regularDayOfWork: true,
    workedHoliday: false,
    absentFirstScheduledDayAfterWithoutConsent: true,
  }).eligible, false);
});

test("average daily wage divides eligible non-overtime wages by days worked", () => {
  assert.equal(albertaAverageDailyWageCents(480_000, 20), 24_000);
});

test("eligible hourly employee not working a regular-day holiday receives average daily wage", () => {
  const result = calculateAlbertaGeneralHolidayPay({
    workdaysInPrior12Months: 86,
    regularDayOfWork: true,
    workedHoliday: false,
    payType: "Hourly",
    averageDailyWageCents: 24_000,
  });
  assert.equal(result.treatment, "average-daily-wage");
  assert.equal(result.immediateHolidayPayCents, 24_000);
});

test("eligible salaried employee can continue full salary on a regular-day holiday", () => {
  const result = calculateAlbertaGeneralHolidayPay({
    workdaysInPrior12Months: 126,
    regularDayOfWork: true,
    workedHoliday: false,
    payType: "Salary",
    averageDailyWageCents: 30_000,
  });
  assert.equal(result.treatment, "salary-continues");
  assert.equal(result.salaryContinues, true);
  assert.equal(result.immediateHolidayPayCents, 0);
});

test("working a regular-day holiday supports premium plus average daily wage", () => {
  const result = calculateAlbertaGeneralHolidayPay({
    workdaysInPrior12Months: 100,
    regularDayOfWork: true,
    workedHoliday: true,
    payType: "Hourly",
    averageDailyWageCents: 20_000,
    hourlyRateCents: 2_500,
    hoursWorked: 8,
    workOption: "premium-plus-average",
  });
  assert.equal(result.immediateHolidayPayCents, 50_000);
  assert.equal(result.futureDayOffPayCents, 0);
});

test("working a regular-day holiday supports regular wages plus future paid day off", () => {
  const result = calculateAlbertaGeneralHolidayPay({
    workdaysInPrior12Months: 100,
    regularDayOfWork: true,
    workedHoliday: true,
    payType: "Hourly",
    averageDailyWageCents: 20_000,
    hourlyRateCents: 2_500,
    hoursWorked: 8,
    workOption: "regular-plus-lieu",
  });
  assert.equal(result.immediateHolidayPayCents, 20_000);
  assert.equal(result.futureDayOffPayCents, 20_000);
});

test("working a holiday that is not a regular day pays time and a half only", () => {
  const result = calculateAlbertaGeneralHolidayPay({
    workdaysInPrior12Months: 100,
    regularDayOfWork: false,
    workedHoliday: true,
    payType: "Hourly",
    averageDailyWageCents: 20_000,
    hourlyRateCents: 2_500,
    hoursWorked: 8,
  });
  assert.equal(result.immediateHolidayPayCents, 30_000);
  assert.equal(result.futureDayOffPayCents, 0);
});
