export type PilotCompletionPaymentState = {
  approved: boolean;
  paidEmployeeIds: string[];
  references: Record<string, string>;
};

export type PilotCompletionCheck = {
  ready: boolean;
  missingPaidEmployeeIds: string[];
  missingReferenceEmployeeIds: string[];
  unexpectedPaidEmployeeIds: string[];
  unexpectedReferenceEmployeeIds: string[];
};

export function pilotPaymentCompletionCheck(
  employeeIds: string[],
  paymentState: PilotCompletionPaymentState,
): PilotCompletionCheck {
  const expected = new Set(employeeIds);
  const paid = new Set(paymentState.paidEmployeeIds);
  const referenced = new Set(
    Object.entries(paymentState.references)
      .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
      .map(([id]) => id),
  );

  const missingPaidEmployeeIds = employeeIds.filter((id) => !paid.has(id));
  const missingReferenceEmployeeIds = employeeIds.filter((id) => !referenced.has(id));
  const unexpectedPaidEmployeeIds = [...paid].filter((id) => !expected.has(id));
  const unexpectedReferenceEmployeeIds = [...referenced].filter((id) => !expected.has(id));

  return {
    ready:
      paymentState.approved &&
      employeeIds.length > 0 &&
      missingPaidEmployeeIds.length === 0 &&
      missingReferenceEmployeeIds.length === 0 &&
      unexpectedPaidEmployeeIds.length === 0 &&
      unexpectedReferenceEmployeeIds.length === 0,
    missingPaidEmployeeIds,
    missingReferenceEmployeeIds,
    unexpectedPaidEmployeeIds,
    unexpectedReferenceEmployeeIds,
  };
}
