export const COMCHEQ_BILLING = {
  baseRunFeeCents: 1_000,
  employeePaymentFeeCents: 200,
  currency: "CAD",
} as const;

export function approvedPayRunChargeCents(employeePaymentCount: number): number {
  if (!Number.isInteger(employeePaymentCount) || employeePaymentCount < 0 || employeePaymentCount > 10_000) {
    throw new Error("employeePaymentCount is outside the supported range.");
  }
  return COMCHEQ_BILLING.baseRunFeeCents + employeePaymentCount * COMCHEQ_BILLING.employeePaymentFeeCents;
}
