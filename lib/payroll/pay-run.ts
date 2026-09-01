import { assertMoneyCents, sumCents, type MoneyCents } from "./money.ts";

export type PayRunStatus = "draft" | "calculated" | "reviewed" | "approved" | "reversed";

export interface RulesetReference {
  jurisdiction: "AB";
  effectiveFrom: string;
  version: string;
  source: string;
}

export interface EmployeePayment {
  employeeId: string;
  employeeName: string;
  grossCents: MoneyCents;
  incomeTaxCents: MoneyCents;
  cppCents: MoneyCents;
  eiCents: MoneyCents;
  otherDeductionsCents: MoneyCents;
  netPayCents: MoneyCents;
}

export interface PayRun {
  id: string;
  employerId: string;
  payrollYear: number;
  runNumber: number;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayRunStatus;
  ruleset: RulesetReference;
  timeEntriesReady: boolean;
  blockingErrors: readonly string[];
  payments: readonly EmployeePayment[];
}

export interface BillingEvent {
  eventType: "employee_payment_finalized";
  payRunId: string;
  quantity: number;
  unitPriceCents: 200;
  totalCents: MoneyCents;
  occurredAt: string;
}

export interface AuditEvent {
  eventType: "pay_run_approved";
  payRunId: string;
  actorId: string;
  occurredAt: string;
  details: Readonly<Record<string, string | number>>;
}

export interface ApprovedPayRun extends PayRun {
  status: "approved";
  approvedAt: string;
  approvedBy: string;
  netBankTotalCents: MoneyCents;
  billingEvent: BillingEvent;
  auditEvent: AuditEvent;
}

const allowedTransitions: Record<PayRunStatus, readonly PayRunStatus[]> = {
  draft: ["calculated"],
  calculated: ["draft", "reviewed"],
  reviewed: ["calculated", "approved"],
  approved: ["reversed"],
  reversed: [],
};

export function transitionPayRun<T extends PayRun>(run: T, next: PayRunStatus): T & { status: PayRunStatus } {
  if (!allowedTransitions[run.status].includes(next)) {
    throw new Error(`Invalid pay-run transition: ${run.status} -> ${next}`);
  }
  return { ...run, status: next };
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function approvePayRun(
  run: PayRun,
  input: { actorId: string; approvedAt: string },
): Readonly<ApprovedPayRun> {
  if (run.status !== "reviewed") throw new Error("Only a reviewed pay run can be approved.");
  if (!run.timeEntriesReady) throw new Error("Hourly time must be marked ready before approval.");
  if (run.blockingErrors.length) throw new Error("Resolve all blocking payroll errors before approval.");
  if (!Number.isInteger(run.runNumber) || run.runNumber < 1) throw new Error("Run number must be a positive integer.");
  if (!run.payments.length) throw new Error("A pay run must contain at least one employee payment.");

  for (const payment of run.payments) {
    for (const [label, amount] of Object.entries(payment).filter(([, value]) => typeof value === "number")) {
      assertMoneyCents(amount as number, `${payment.employeeId}.${label}`);
    }
    const expectedNet = payment.grossCents - payment.incomeTaxCents - payment.cppCents - payment.eiCents - payment.otherDeductionsCents;
    if (expectedNet !== payment.netPayCents) {
      throw new Error(`Net pay does not balance for ${payment.employeeId}.`);
    }
  }

  const payable = run.payments.filter((payment) => payment.netPayCents > 0);
  const netBankTotalCents = sumCents(payable.map((payment) => payment.netPayCents));
  const billingEvent: BillingEvent = {
    eventType: "employee_payment_finalized",
    payRunId: run.id,
    quantity: payable.length,
    unitPriceCents: 200,
    totalCents: payable.length * 200,
    occurredAt: input.approvedAt,
  };
  const auditEvent: AuditEvent = {
    eventType: "pay_run_approved",
    payRunId: run.id,
    actorId: input.actorId,
    occurredAt: input.approvedAt,
    details: {
      payrollYear: run.payrollYear,
      runNumber: run.runNumber,
      employeePaymentCount: payable.length,
      netBankTotalCents,
      rulesetVersion: run.ruleset.version,
    },
  };

  return deepFreeze({
    ...run,
    status: "approved",
    approvedAt: input.approvedAt,
    approvedBy: input.actorId,
    netBankTotalCents,
    billingEvent,
    auditEvent,
  }) as Readonly<ApprovedPayRun>;
}
