import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCoffeePayrollUser } from "@/lib/auth/current-user";
import { pilotWorkspaceScope } from "@/lib/pilot/workspace-scope";
import {
  appendPilotApprovalSnapshot,
  EMPTY_PILOT_PAYMENT_STATE,
  normalizePilotPaymentState,
  type PilotApprovalEmployee,
  type PilotApprovalProfile,
  type PilotPaymentState,
} from "@/lib/payroll/pilot-approval-history";
import { pilotRunFingerprint } from "@/lib/payroll/pilot-run-fingerprint";
import { pilotTaxSetupReviewComplete } from "@/lib/payroll/pilot-tax-setup";

type PilotUatState = { employees: PilotApprovalEmployee[]; timesheets: Record<string, unknown> };

type UpdateBody = {
  approved?: boolean;
  approvedFingerprint?: string | null;
  paidEmployeeIds?: string[];
  references?: Record<string, string>;
  completedAt?: string | null;
  reset?: boolean;
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

async function ensureState(user: { id: string; email: string }) {
  const db = database();
  const scope = pilotWorkspaceScope(user.id);
  const now = new Date().toISOString();
  const ownership = await db.prepare("SELECT workspace_id AS workspaceId FROM pilot_workspace_profiles WHERE workspace_id = ? AND auth_user_id = ? LIMIT 1")
    .bind(scope.workspaceId, user.id).first<{ workspaceId: string }>();
  if (!ownership) throw new Error("Open your pilot workspace before using payment UAT.");
  await db.prepare("INSERT OR IGNORE INTO pilot_uat_states (id, workspace_id, state_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)")
    .bind(scope.paymentStateId, scope.workspaceId, JSON.stringify(EMPTY_PILOT_PAYMENT_STATE), now, user.email).run();
  return scope;
}

async function currentRunInputs(user: { id: string }) {
  const db = database();
  const scope = pilotWorkspaceScope(user.id);
  const profile = await db.prepare("SELECT province, pay_frequency AS frequency FROM pilot_workspace_profiles WHERE workspace_id = ? AND auth_user_id = ? LIMIT 1")
    .bind(scope.workspaceId, user.id).first<PilotApprovalProfile>();
  const uat = await db.prepare("SELECT state_json AS stateJson FROM pilot_uat_states WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(scope.stateId, scope.workspaceId).first<{ stateJson: string }>();
  if (!profile || !uat?.stateJson) throw new Error("Open your pilot workspace before approving payroll.");
  const state = JSON.parse(uat.stateJson) as PilotUatState;
  if (!Array.isArray(state.employees) || !state.timesheets || typeof state.timesheets !== "object") throw new Error("Pilot payroll inputs are unavailable.");
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
    const parsed = normalizePilotPaymentState(JSON.parse(row?.stateJson ?? "{}"));
    if (parsed) return { state: parsed, updatedAt: row?.updatedAt ?? null };
  } catch {
    // Fall back to a clean pilot payment state.
  }
  return { state: structuredClone(EMPTY_PILOT_PAYMENT_STATE), updatedAt: row?.updatedAt ?? null };
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
      const pendingTaxSetup = uatState.employees.filter((employee) => employee.status === "New hire" && employee.taxSetupComplete !== true && !pilotTaxSetupReviewComplete(employee.taxSetupReview));
      if (pendingTaxSetup.length > 0) {
        return NextResponse.json({
          error: "New-hire tax setup must be reviewed before payroll approval.",
          code: "NEW_HIRE_TAX_SETUP_REQUIRED",
          employeeIds: pendingTaxSetup.map((employee) => employee.id),
        }, { status: 409 });
      }
    }

    let next: PilotPaymentState;
    if (body.reset) {
      next = structuredClone(EMPTY_PILOT_PAYMENT_STATE);
    } else if (body.approved === true) {
      const approvalHistory = existingApprovalValid
        ? existing.approvalHistory
        : appendPilotApprovalSnapshot(existing.approvalHistory, {
          snapshotId: `${run.runKey}:${fingerprint}:${now}`,
          approvedAt: now,
          approvedBy: user.email,
          fingerprint,
          run: { ...run },
          profile: { province: profile.province, frequency: profile.frequency },
          employees: structuredClone(uatState.employees),
          timesheets: structuredClone(uatState.timesheets),
        });
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
      const normalized = normalizePilotPaymentState({
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

    const valid = normalizePilotPaymentState(next);
    if (!valid) return NextResponse.json({ error: "Payment UAT state is invalid." }, { status: 400 });
    await db.prepare("UPDATE pilot_uat_states SET state_json = ?, updated_at = ?, updated_by = ? WHERE id = ? AND workspace_id = ?")
      .bind(JSON.stringify(valid), now, user.email, scope.paymentStateId, scope.workspaceId).run();
    return NextResponse.json({ state: valid, currentFingerprint: fingerprint, approvalStale: false, updatedAt: now });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save payment UAT." }, { status: 503 });
  }
}
