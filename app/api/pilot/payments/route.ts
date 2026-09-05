import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCoffeePayrollUser } from "@/lib/auth/current-user";
import { pilotWorkspaceScope } from "@/lib/pilot/workspace-scope";
import { pilotRunFingerprint } from "@/lib/payroll/pilot-run-fingerprint";

type PilotProfile = { province: string; frequency: string };
type PilotEmployee = Record<string, unknown> & { id: string; status?: string; taxSetupComplete?: boolean };
type PilotUatState = { employees: PilotEmployee[]; timesheets: Record<string, unknown> };

type ApprovalSnapshot = {
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
  profile: PilotProfile;
  employees: PilotEmployee[];
  timesheets: Record<string, unknown>;
};

type PaymentState = {
  approved: boolean;
  approvedFingerprint: string | null;
  paidEmployeeIds: string[];
  references: Record<string, string>;
  completedAt: string | null;
  approvalHistory: ApprovalSnapshot[];
};

type UpdateBody = {
  approved?: boolean;
  approvedFingerprint?: string | null;
  paidEmployeeIds?: string[];
  references?: Record<string, string>;
  completedAt?: string | null;
  reset?: boolean;
};

const emptyState: PaymentState = {
  approved: false,
  approvedFingerprint: null,
  paidEmployeeIds: [],
  references: {},
  completedAt: null,
  approvalHistory: [],
};

const run = {
  runKey: "2026-17-pilot",
  periodStart: "2026-08-16",
  periodEnd: "2026-08-31",
  payDate: "2026-09-04",
} as const;

function database() {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("Coffee Payroll durable storage is unavailable.");
  return db;
}

function validIsoTimestamp(value: unknown) {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

function validDateOnly(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeApprovalSnapshot(input: unknown): ApprovalSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<ApprovalSnapshot>;
  if (
    typeof value.snapshotId !== "string" || value.snapshotId.length > 160 ||
    !validIsoTimestamp(value.approvedAt) ||
    typeof value.approvedBy !== "string" || value.approvedBy.length > 320 ||
    typeof value.fingerprint !== "string" || value.fingerprint.length > 120 ||
    !value.run || typeof value.run !== "object" ||
    typeof value.run.runKey !== "string" || value.run.runKey.length > 120 ||
    !validDateOnly(value.run.periodStart) || !validDateOnly(value.run.periodEnd) || !validDateOnly(value.run.payDate) ||
    !value.profile || typeof value.profile.province !== "string" || value.profile.province.length > 80 || typeof value.profile.frequency !== "string" || value.profile.frequency.length > 40 ||
    !Array.isArray(value.employees) || value.employees.length > 250 ||
    !value.timesheets || typeof value.timesheets !== "object"
  ) return null;
  if (!value.employees.every((employee) => employee && typeof employee === "object" && typeof employee.id === "string" && employee.id.length <= 80)) return null;
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
  };
}

function normalizeState(input: unknown): PaymentState | null {
  if (!input || typeof input !== "object") return null;
  const state = input as Partial<PaymentState>;
  if (typeof state.approved !== "boolean" || !Array.isArray(state.paidEmployeeIds) || !state.references || typeof state.references !== "object") return null;
  if (state.paidEmployeeIds.length > 250 || !state.paidEmployeeIds.every((id) => typeof id === "string" && id.length <= 80)) return null;
  if (state.completedAt !== null && state.completedAt !== undefined && typeof state.completedAt !== "string") return null;
  if (state.approvedFingerprint !== null && state.approvedFingerprint !== undefined && (typeof state.approvedFingerprint !== "string" || state.approvedFingerprint.length > 120)) return null;
  if (!Object.entries(state.references).every(([id, value]) => id.length <= 80 && typeof value === "string" && value.length <= 120)) return null;

  const rawHistory = state.approvalHistory ?? [];
  if (!Array.isArray(rawHistory) || rawHistory.length > 25) return null;
  const approvalHistory: ApprovalSnapshot[] = [];
  for (const item of rawHistory) {
    const snapshot = normalizeApprovalSnapshot(item);
    if (!snapshot) return null;
    approvalHistory.push(snapshot);
  }

  return {
    approved: state.approved,
    approvedFingerprint: state.approvedFingerprint ?? null,
    paidEmployeeIds: state.paidEmployeeIds,
    references: state.references,
    completedAt: state.completedAt ?? null,
    approvalHistory,
  };
}

async function ensureState(user: { id: string; email: string }) {
  const db = database();
  const scope = pilotWorkspaceScope(user.id);
  const now = new Date().toISOString();
  const ownership = await db.prepare("SELECT workspace_id AS workspaceId FROM pilot_workspace_profiles WHERE workspace_id = ? AND auth_user_id = ? LIMIT 1")
    .bind(scope.workspaceId, user.id).first<{ workspaceId: string }>();
  if (!ownership) throw new Error("Open your pilot workspace before using payment UAT.");
  await db.prepare("INSERT OR IGNORE INTO pilot_uat_states (id, workspace_id, state_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)")
    .bind(scope.paymentStateId, scope.workspaceId, JSON.stringify(emptyState), now, user.email).run();
  return scope;
}

async function currentRunInputs(user: { id: string }) {
  const db = database();
  const scope = pilotWorkspaceScope(user.id);
  const profile = await db.prepare("SELECT province, pay_frequency AS frequency FROM pilot_workspace_profiles WHERE workspace_id = ? AND auth_user_id = ? LIMIT 1")
    .bind(scope.workspaceId, user.id).first<PilotProfile>();
  const uat = await db.prepare("SELECT state_json AS stateJson FROM pilot_uat_states WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(scope.stateId, scope.workspaceId).first<{ stateJson: string }>();
  if (!profile || !uat?.stateJson) throw new Error("Open your pilot workspace before approving payroll.");
  const state = JSON.parse(uat.stateJson) as PilotUatState;
  if (!Array.isArray(state.employees) || !state.timesheets) throw new Error("Pilot payroll inputs are unavailable.");
  const fingerprint = pilotRunFingerprint({ ...run, province: profile.province, frequency: profile.frequency, employees: state.employees, timesheets: state.timesheets });
  return { state, profile, fingerprint };
}

async function currentFingerprint(user: { id: string }) {
  return (await currentRunInputs(user)).fingerprint;
}

async function storedState(user: { id: string; email: string }) {
  const db = database();
  const scope = await ensureState(user);
  const row = await db.prepare("SELECT state_json AS stateJson, updated_at AS updatedAt FROM pilot_uat_states WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(scope.paymentStateId, scope.workspaceId).first<{ stateJson: string; updatedAt: string }>();
  try {
    const parsed = normalizeState(JSON.parse(row?.stateJson ?? "{}"));
    if (parsed) return { state: parsed, updatedAt: row?.updatedAt ?? null };
  } catch {
    // Fall back to a clean pilot payment state.
  }
  return { state: emptyState, updatedAt: row?.updatedAt ?? null };
}

async function readState(user: { id: string; email: string }) {
  const stored = await storedState(user);
  const fingerprint = await currentFingerprint(user);
  const approvalStale = stored.state.approved && stored.state.approvedFingerprint !== fingerprint;
  const state = approvalStale
    ? { ...stored.state, approved: false, paidEmployeeIds: [], references: {}, completedAt: null }
    : stored.state;
  return { state, currentFingerprint: fingerprint, approvalStale, updatedAt: stored.updatedAt };
}

export async function GET() {
  try {
    const user = await getCoffeePayrollUser();
    if (!user) return NextResponse.json({ error: "Sign in to use persistent payment UAT." }, { status: 401 });
    return NextResponse.json(await readState(user));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load payment UAT." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCoffeePayrollUser();
    if (!user) return NextResponse.json({ error: "Sign in to save payment UAT." }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as UpdateBody;
    const db = database();
    const scope = pilotWorkspaceScope(user.id);
    const { state: existing } = await storedState(user);
    const { state: uatState, profile, fingerprint } = await currentRunInputs(user);
    const existingApprovalValid = existing.approved && existing.approvedFingerprint === fingerprint;
    const now = new Date().toISOString();

    if (body.approved === true) {
      const pendingTaxSetup = uatState.employees.filter((employee) => employee.status === "New hire" && employee.taxSetupComplete !== true);
      if (pendingTaxSetup.length > 0) {
        return NextResponse.json({
          error: "New-hire tax setup must be reviewed before payroll approval.",
          code: "NEW_HIRE_TAX_SETUP_REQUIRED",
          employeeIds: pendingTaxSetup.map((employee) => employee.id),
        }, { status: 409 });
      }
    }

    let next: PaymentState;
    if (body.reset) {
      next = emptyState;
    } else if (body.approved === true) {
      const approvalHistory = existingApprovalValid
        ? existing.approvalHistory
        : [...existing.approvalHistory, {
          snapshotId: `${run.runKey}:${fingerprint}:${now}`,
          approvedAt: now,
          approvedBy: user.email,
          fingerprint,
          run: { ...run },
          profile: { province: profile.province, frequency: profile.frequency },
          employees: structuredClone(uatState.employees),
          timesheets: structuredClone(uatState.timesheets),
        }].slice(-25);
      next = {
        approved: true,
        approvedFingerprint: fingerprint,
        paidEmployeeIds: existingApprovalValid ? (body.paidEmployeeIds ?? existing.paidEmployeeIds) : [],
        references: existingApprovalValid ? (body.references ?? existing.references) : {},
        completedAt: null,
        approvalHistory,
      };
    } else {
      if (!existingApprovalValid && (body.paidEmployeeIds || body.references || body.completedAt)) {
        return NextResponse.json({ error: "Payroll changed since approval. Review and approve again before recording payments." }, { status: 409 });
      }
      const normalized = normalizeState({
        approved: body.approved ?? existing.approved,
        approvedFingerprint: body.approvedFingerprint === undefined ? existing.approvedFingerprint : body.approvedFingerprint,
        paidEmployeeIds: body.paidEmployeeIds ?? existing.paidEmployeeIds,
        references: body.references ?? existing.references,
        completedAt: body.completedAt === undefined ? existing.completedAt : body.completedAt,
        approvalHistory: existing.approvalHistory,
      });
      if (!normalized) return NextResponse.json({ error: "Payment UAT state is invalid." }, { status: 400 });
      next = normalized;
    }

    const valid = normalizeState(next);
    if (!valid) return NextResponse.json({ error: "Payment UAT state is invalid." }, { status: 400 });
    await db.prepare("UPDATE pilot_uat_states SET state_json = ?, updated_at = ?, updated_by = ? WHERE id = ? AND workspace_id = ?")
      .bind(JSON.stringify(valid), now, user.email, scope.paymentStateId, scope.workspaceId).run();
    return NextResponse.json({ state: valid, currentFingerprint: fingerprint, approvalStale: false, updatedAt: now });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save payment UAT." }, { status: 503 });
  }
}
