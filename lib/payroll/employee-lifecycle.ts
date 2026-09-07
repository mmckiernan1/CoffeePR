export type EmploymentStatus = "Active" | "New hire" | "Terminating" | "Terminated";

export type EmploymentLifecycle = {
  hireDate: string;
  terminationDate?: string | null;
  status: EmploymentStatus;
};

export type PayPeriod = {
  periodStart: string;
  periodEnd: string;
  payDate: string;
};

export type FinalPayInput = {
  regularPayCents?: number;
  vacationPayCents?: number;
  overtimePayCents?: number;
  otherTaxablePayCents?: number;
  reimbursementCents?: number;
};

function parseIsoDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field} must be a YYYY-MM-DD date.`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} must be a valid calendar date.`);
  }
  return value;
}

function assertNonNegativeCents(value: number | undefined, field: string) {
  if (value === undefined) return 0;
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must use non-negative integer cents.`);
  return value;
}

export function validateEmploymentLifecycle(lifecycle: EmploymentLifecycle) {
  const hireDate = parseIsoDate(lifecycle.hireDate, "Hire date");
  const terminationDate = lifecycle.terminationDate
    ? parseIsoDate(lifecycle.terminationDate, "Termination date")
    : null;

  if (terminationDate && terminationDate < hireDate) {
    throw new Error("Termination date cannot be before hire date.");
  }
  if ((lifecycle.status === "Terminating" || lifecycle.status === "Terminated") && !terminationDate) {
    throw new Error(`${lifecycle.status} employees require a termination date.`);
  }
  if ((lifecycle.status === "Active" || lifecycle.status === "New hire") && terminationDate) {
    throw new Error(`${lifecycle.status} employees cannot have a termination date.`);
  }
  return { ...lifecycle, hireDate, terminationDate } as const;
}

export function isEmployeeInPayPeriod(lifecycle: EmploymentLifecycle, period: PayPeriod) {
  const valid = validateEmploymentLifecycle(lifecycle);
  const periodStart = parseIsoDate(period.periodStart, "Period start");
  const periodEnd = parseIsoDate(period.periodEnd, "Period end");
  parseIsoDate(period.payDate, "Pay date");
  if (periodEnd < periodStart) throw new Error("Period end cannot be before period start.");

  if (valid.hireDate > periodEnd) return false;
  if (valid.terminationDate && valid.terminationDate < periodStart) return false;
  return true;
}

export function buildFinalPay(input: FinalPayInput) {
  const regularPayCents = assertNonNegativeCents(input.regularPayCents, "Regular pay");
  const vacationPayCents = assertNonNegativeCents(input.vacationPayCents, "Vacation pay");
  const overtimePayCents = assertNonNegativeCents(input.overtimePayCents, "Overtime pay");
  const otherTaxablePayCents = assertNonNegativeCents(input.otherTaxablePayCents, "Other taxable pay");
  const reimbursementCents = assertNonNegativeCents(input.reimbursementCents, "Reimbursement");
  const taxableGrossCents = regularPayCents + vacationPayCents + overtimePayCents + otherTaxablePayCents;

  return {
    regularPayCents,
    vacationPayCents,
    overtimePayCents,
    otherTaxablePayCents,
    reimbursementCents,
    taxableGrossCents,
    cashPayBeforeDeductionsCents: taxableGrossCents + reimbursementCents,
  } as const;
}
