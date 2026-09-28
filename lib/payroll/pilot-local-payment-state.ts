export type PilotLocalPaymentState = {
  approved: boolean;
  approvedFingerprint?: string | null;
  paidEmployeeIds: string[];
  references: Record<string, string>;
  completedAt: string | null;
  approvalHistory?: unknown[];
  reopenHistory?: unknown[];
};

export function reconcilePilotLocalApproval(
  paymentState: PilotLocalPaymentState,
  currentFingerprint: string,
) {
  const approvalStale = paymentState.approved
    && paymentState.approvedFingerprint !== currentFingerprint;

  if (!approvalStale) return { state: paymentState, approvalStale: false };

  return {
    state: {
      ...paymentState,
      approved: false,
      approvedFingerprint: null,
      paidEmployeeIds: [],
      references: {},
      completedAt: null,
    },
    approvalStale: true,
  };
}

export function approvePilotLocalPayroll(
  paymentState: PilotLocalPaymentState,
  currentFingerprint: string,
) {
  const sameApproval = paymentState.approved
    && paymentState.approvedFingerprint === currentFingerprint;

  return {
    ...paymentState,
    approved: true,
    approvedFingerprint: currentFingerprint,
    paidEmployeeIds: sameApproval ? paymentState.paidEmployeeIds : [],
    references: sameApproval ? paymentState.references : {},
    completedAt: null,
  };
}
