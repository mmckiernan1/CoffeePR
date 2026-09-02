import { sumCents, type MoneyCents } from "./money.ts";

export type EmployeePaymentMethod = "EFT bank file" | "Business e-transfer" | "Business cheque";

export type EmployeePaymentInstruction = {
  employeeId: string;
  method: EmployeePaymentMethod;
  netPayCents: MoneyCents;
  status: "Outstanding" | "Paid by client";
  clientReference?: string;
};

export function validateEmployeePaymentHandoff(payrollApproved: boolean, payments: readonly EmployeePaymentInstruction[]) {
  const blockingErrors: string[] = [];
  const seenEmployees = new Set<string>();
  const seenReferences = new Set<string>();

  for (const payment of payments) {
    if (seenEmployees.has(payment.employeeId)) blockingErrors.push(`Duplicate employee payment: ${payment.employeeId}.`);
    seenEmployees.add(payment.employeeId);
    if (!Number.isSafeInteger(payment.netPayCents) || payment.netPayCents <= 0) blockingErrors.push(`Net pay must be positive integer cents for ${payment.employeeId}.`);
    if (payment.status === "Paid by client" && !payrollApproved) blockingErrors.push(`Payroll approval is required before ${payment.employeeId} can be marked paid.`);
    if (payment.status === "Paid by client") {
      const reference = payment.clientReference?.trim().toLowerCase();
      if (!reference) blockingErrors.push(`Client payment evidence is required for ${payment.employeeId}.`);
      else if (seenReferences.has(reference)) blockingErrors.push(`Duplicate client payment reference: ${payment.clientReference?.trim()}.`);
      else seenReferences.add(reference);
    }
  }

  return {
    controlTotalCents: sumCents(payments.map((payment) => payment.netPayCents)),
    outstandingCount: payments.filter((payment) => payment.status === "Outstanding").length,
    blockingErrors,
  };
}
