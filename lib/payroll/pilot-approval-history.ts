export type PilotApprovalProfile = { province: string; frequency: string };
export type PilotApprovalEmployee = Record<string, unknown> & {
  id: string;
  rate: number;
  payType?: "Salary" | "Hourly";
  rateEffectiveDate?: string;
  rateHistory?: Array<{ effectiveDate: string; rate: number }>;
  status?: string;
  taxSetupComplete?: boolean;
};

export type PilotApprovalSnapshot = {
  snapshotId: string;
  approvedAt: string;
  approvedBy: string;
  fingerprint: string;
  run: {
    runKey: string;
    periodStart: string;
    periodEnd: string;
    payDate: string;
  };
  profile: PilotApprovalProfile;
  employees: PilotApprovalEmployee[];
  timesheets: Record<string, unknown>;
  openingBalances?: Record<string, unknown>;
};

export type PilotPaymentState = {
  approved: boolean;
  approvedFingerprint: string | null;
  paidEmployeeIds: string[];
  references: Record<string, string>;
  completedAt: string | null;
  approvalHistory: PilotApprovalSnapshot[];
};

export const EMPTY_PILOT_PAYMENT_STATE: PilotPaymentState = {
  approved: false,
  approvedFingerprint: null,
  paidEmployeeIds: [],
  references: {},
  completedAt: null,
  approvalHistory: [],
};

function validIsoTimestamp(value: unknown) {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

function validDateOnly(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizePilotApprovalSnapshot(input: unknown): PilotApprovalSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<PilotApprovalSnapshot>;
  if (
    typeof value.snapshotId !== "string" || value.snapshotId.length === 0 || value.snapshotId.length > 160 ||
    !validIsoTimestamp(value.approvedAt) ||
    typeof value.approvedBy !== "string" || value.approvedBy.length === 0 || value.approvedBy.length > 320 ||
    typeof value.fingerprint !== "string" || value.fingerprint.length === 0 || value.fingerprint.length > 120 ||
    !value.run || typeof value.run !== "object" ||
    typeof value.run.runKey !== "string" || value.run.runKey.length === 0 || value.run.runKey.length > 120 ||
    !validDateOnly(value.run.periodStart) || !validDateOnly(value.run.periodEnd) || !validDateOnly(value.run.payDate) ||
    value.run.periodStart > value.run.periodEnd || value.run.payDate < value.run.periodEnd ||
    !value.profile || typeof value.profile.province !== "string" || value.profile.province.length === 0 || value.profile.province.length > 80 ||
    typeof value.profile.frequency !== "string" || value.profile.frequency.length === 0 || value.profile.frequency.length > 40 ||
    !Array.isArray(value.employees) || value.employees.length > 250 ||
    !value.timesheets || typeof value.timesheets !== "object" || Array.isArray(value.timesheets) ||
    (value.openingBalances !== undefined && (!value.openingBalances || typeof value.openingBalances !== "object" || Array.isArray(value.openingBalances)))
  ) return null;
  if (!value.employees.every((employee) => employee && typeof employee === "object" && typeof employee.id === "string" && employee.id.length > 0 && employee.id.length <= 80 && typeof employee.rate === "number" && Number.isFinite(employee.rate) && employee.rate > 0)) return null;
  return {
    snapshotId: value.snapshotId,
    approvedAt: value.approvedAt as string,
    approvedBy: value.approvedBy,
    fingerprint: value.fingerprint,
    run: {
      runKey: value.run.runKey,
      periodStart: value.run.periodStart,
      periodEnd: value.run.periodEnd,
      payDate: value.run.payDate,
    },
    profile: { province: value.profile.province, frequency: value.profile.frequency },
    employees: value.employees,
    timesheets: value.timesheets,
    ...(value.openingBalances ? { openingBalances: value.openingBalances } : {}),
  };
}

export function normalizePilotPaymentState(input: unknown): PilotPaymentState | null {
  if (!input || typeof input !== "object") return null;
  const state = input as Partial<PilotPaymentState>;
  if (typeof state.approved !== "boolean" || !Array.isArray(state.paidEmployeeIds) || !state.references || typeof state.references !== "object" || Array.isArray(state.references)) return null;
  if (state.paidEmployeeIds.length > 250 || !state.paidEmployeeIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 80)) return null;
  if (new Set(state.paidEmployeeIds).size !== state.paidEmployeeIds.length) return null;
  if (state.completedAt !== null && state.completedAt !== undefined && !validIsoTimestamp(state.completedAt)) return null;
  if (state.approvedFingerprint !== null && state.approvedFingerprint !== undefined && (typeof state.approvedFingerprint !== "string" || state.approvedFingerprint.length === 0 || state.approvedFingerprint.length > 120)) return null;
  if (!Object.entries(state.references).every(([id, value]) => id.length > 0 && id.length <= 80 && typeof value === "string" && value.length <= 120)) return null;

  const rawHistory = state.approvalHistory ?? [];
  if (!Array.isArray(rawHistory) || rawHistory.length > 25) return null;
  const approvalHistory: PilotApprovalSnapshot[] = [];
  for (const item of rawHistory) {
    const snapshot = normalizePilotApprovalSnapshot(item);
    if (!snapshot) return null;
    approvalHistory.push(snapshot);
  }

  return {
    approved: state.approved,
    approvedFingerprint: state.approvedFingerprint ?? null,
    paidEmployeeIds: [...state.paidEmployeeIds],
    references: { ...state.references },
    completedAt: state.completedAt ?? null,
    approvalHistory,
  };
}

export function appendPilotApprovalSnapshot(
  history: PilotApprovalSnapshot[],
  snapshot: PilotApprovalSnapshot,
  maxHistory = 25,
): PilotApprovalSnapshot[] {
  const normalized = normalizePilotApprovalSnapshot(snapshot);
  if (!normalized) throw new TypeError("Approval snapshot is invalid.");
  const safeLimit = Math.max(1, Math.min(Math.trunc(maxHistory), 100));
  if (history.some((item) => item.fingerprint === normalized.fingerprint)) return [...history];
  return [...history, structuredClone(normalized)].slice(-safeLimit);
}
