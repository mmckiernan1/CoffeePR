import { pilotReportReadiness } from "@/lib/payroll/pilot-report-readiness";
import {
  PILOT_RUN_KEY,
  PILOT_RUN_PERIOD,
  pilotCalculateEmployee,
  pilotEmployeeIsInRun,
  type PilotProfile,
  type PilotUatState,
} from "@/lib/payroll/pilot-uat";

export const PILOT_COMPLETED_ARCHIVE_KEY = "coffee-payroll:completed-fictional-runs:v1";

export type PilotSnapshotPaymentState = {
  approved: boolean;
  approvedFingerprint?: string | null;
  paidEmployeeIds: string[];
  references: Record<string, string>;
  completedAt: string | null;
};

export type PilotCompletedRow = {
  id: string;
  name: string;
  payType: "Salary" | "Hourly";
  status: string;
  gross: number;
  incomeTax: number;
  cpp: number;
  cpp2: number;
  ei: number;
  net: number;
  reimbursement: number;
  paymentReference: string;
  paymentMethod: "Business e-transfer" | "Business cheque";
};

export type PilotCompletedSnapshot = {
  version: 1;
  /** True only for a generated, explicitly labelled sample historical record. */
  sample?: boolean;
  id: string;
  runKey: string;
  fingerprint: string;
  completedAt: string;
  period: { periodStart: string; periodEnd: string; payDate: string };
  profile: PilotProfile;
  rows: PilotCompletedRow[];
};

/** Build a read-only record using the numbers from an approved, fully paid run. */
export function createPilotCompletedSnapshot(
  state: PilotUatState,
  profile: PilotProfile,
  payments: PilotSnapshotPaymentState,
  methods: Record<string, string>,
): PilotCompletedSnapshot | null {
  if (!pilotReportReadiness(state, profile, payments).ready || !payments.completedAt) return null;
  if (Number.isNaN(Date.parse(payments.completedAt))) return null;
  const included = state.employees.filter(pilotEmployeeIsInRun);
  if (!included.length) return null;
  if (!included.every((employee) =>
    payments.paidEmployeeIds.includes(employee.id) &&
    Boolean(payments.references[employee.id]?.trim()))) return null;

  const rows: PilotCompletedRow[] = included.map((employee) => {
    const result = pilotCalculateEmployee(employee, state.timesheets, profile.frequency, state.openingBalances ?? {});
    return {
      id: result.id,
      name: result.name,
      payType: result.payType,
      status: result.status,
      gross: result.gross,
      incomeTax: result.incomeTax,
      cpp: result.cpp,
      cpp2: result.cpp2,
      ei: result.ei,
      net: result.net,
      reimbursement: result.reimbursement,
      paymentReference: payments.references[employee.id].trim(),
      paymentMethod: methods[employee.id] === "Business cheque" ? "Business cheque" : "Business e-transfer",
    };
  });
  if (!rows.every((row) => [row.gross, row.incomeTax, row.cpp, row.cpp2, row.ei, row.net, row.reimbursement].every(Number.isFinite))) return null;

  return {
    version: 1,
    id: [PILOT_RUN_KEY, payments.approvedFingerprint, payments.completedAt].join("|"),
    runKey: PILOT_RUN_KEY,
    fingerprint: payments.approvedFingerprint!,
    completedAt: payments.completedAt,
    period: { ...PILOT_RUN_PERIOD },
    profile: { ...profile },
    rows,
  };
}

function validSnapshot(value: unknown): value is PilotCompletedSnapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PilotCompletedSnapshot>;
  return item.version === 1 && typeof item.id === "string" &&
    typeof item.runKey === "string" && typeof item.fingerprint === "string" &&
    typeof item.completedAt === "string" &&
    typeof item.profile?.businessName === "string" &&
    typeof item.profile?.frequency === "string" &&
    typeof item.period?.payDate === "string" &&
    Array.isArray(item.rows) && item.rows.length > 0 &&
    item.rows.every((row) => typeof row.id === "string" &&
      typeof row.name === "string" && typeof row.paymentReference === "string" &&
      [row.gross, row.incomeTax, row.cpp, row.cpp2, row.ei, row.net, row.reimbursement].every(Number.isFinite));
}

type ArchiveStore = Pick<Storage, "getItem" | "setItem">;

/** Never silently overwrite an existing archive or discard one with invalid data. */
export function readPilotCompletedArchive(storage: Pick<Storage, "getItem">): PilotCompletedSnapshot[] {
  const raw = storage.getItem(PILOT_COMPLETED_ARCHIVE_KEY);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.every(validSnapshot)) {
    throw new Error("Existing fictional payroll archive is invalid. Nothing was changed.");
  }
  return value;
}

export function savePilotCompletedSnapshot(storage: ArchiveStore, snapshot: PilotCompletedSnapshot): void {
  if (!validSnapshot(snapshot)) throw new Error("Invalid completed payroll snapshot.");
  const history = readPilotCompletedArchive(storage);
  if (history.some((previous) => previous.id === snapshot.id)) return;
  storage.setItem(PILOT_COMPLETED_ARCHIVE_KEY, JSON.stringify([...history, snapshot]));
}

export function latestPilotCompletedSnapshot(
  snapshots: PilotCompletedSnapshot[],
  runKey: string = PILOT_RUN_KEY,
): PilotCompletedSnapshot | null {
  return [...snapshots].reverse().find((item) => item.runKey === runKey) ?? null;
}
