import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCoffeePayrollUser } from "@/lib/auth/current-user";
import { pilotWorkspaceScope } from "@/lib/pilot/workspace-scope";
import { dollarsToCents } from "@/lib/payroll/money";
import { PILOT_STARTER_STATE, type PilotFinalPay as FinalPay, type PilotProfile, type PilotRateHistoryEntry as RateHistoryEntry, type PilotTimesheet as Timesheet, type PilotUatEmployee as UatEmployee, type PilotUatState } from "@/lib/payroll/pilot-uat";

type LegacyFinalPay = {
  vacationPay: number;
  overtimePay: number;
  otherTaxablePay: number;
  reimbursement: number;
};

type UpdateBody = { profile?: Partial<PilotProfile>; state?: unknown; resetState?: boolean };

const starterState: PilotUatState = PILOT_STARTER_STATE;

function database() {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("Coffee Payroll durable storage is unavailable.");
  return db;
}

function safeProfile(input: Partial<PilotProfile> | undefined): PilotProfile {
  const count = Number(input?.employeeCount ?? 4);
  return {
    businessName: String(input?.businessName ?? "My business").trim().slice(0, 160) || "My business",
    province: String(input?.province ?? "Alberta").trim().slice(0, 80) || "Alberta",
    frequency: String(input?.frequency ?? "Biweekly").trim().slice(0, 40) || "Biweekly",
    employeeCount: Number.isFinite(count) ? Math.min(Math.max(Math.round(count), 1), 1000) : 4,
  };
}

function validIsoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validMoney(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 10_000_000; }
function validRate(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 10_000_000; }
function validCents(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < 1_000_000_000; }

function normalizeFinalPay(input: unknown): FinalPay | undefined | null {
  if (input === undefined) return undefined;
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<FinalPay & LegacyFinalPay>;
  if (validCents(value.vacationPayCents) && validCents(value.overtimePayCents) && validCents(value.otherTaxablePayCents) && validCents(value.reimbursementCents)) {
    return {
      vacationPayCents: value.vacationPayCents as number,
      overtimePayCents: value.overtimePayCents as number,
      otherTaxablePayCents: value.otherTaxablePayCents as number,
      reimbursementCents: value.reimbursementCents as number,
    };
  }
  if (validMoney(value.vacationPay) && validMoney(value.overtimePay) && validMoney(value.otherTaxablePay) && validMoney(value.reimbursement)) {
    return {
      vacationPayCents: dollarsToCents(String(value.vacationPay)),
      overtimePayCents: dollarsToCents(String(value.overtimePay)),
      otherTaxablePayCents: dollarsToCents(String(value.otherTaxablePay)),
      reimbursementCents: dollarsToCents(String(value.reimbursement)),
    };
  }
  return null;
}

function normalizeExtraPay(employee: Record<string, unknown>): number | undefined | null {
  if (employee.extraTaxablePayCents !== undefined) return validCents(employee.extraTaxablePayCents) ? employee.extraTaxablePayCents as number : null;
  if (employee.extraTaxablePay !== undefined) return validMoney(employee.extraTaxablePay) ? dollarsToCents(String(employee.extraTaxablePay)) : null;
  return undefined;
}

function normalizeRateHistory(employee: Record<string, unknown>): RateHistoryEntry[] | undefined | null {
  if (employee.rateHistory === undefined) {
    if (typeof employee.rateEffectiveDate === "string" && validIsoDate(employee.rateEffectiveDate) && validRate(employee.rate)) {
      return [{ effectiveDate: employee.rateEffectiveDate, rate: employee.rate as number }];
    }
    if (typeof employee.hireDate === "string" && validIsoDate(employee.hireDate) && validRate(employee.rate)) {
      return [{ effectiveDate: employee.hireDate, rate: employee.rate as number }];
    }
    return undefined;
  }
  if (!Array.isArray(employee.rateHistory) || employee.rateHistory.length > 100) return null;
  const byDate = new Map<string, number>();
  for (const raw of employee.rateHistory) {
    if (!raw || typeof raw !== "object") return null;
    const entry = raw as Record<string, unknown>;
    if (!validIsoDate(entry.effectiveDate) || !validRate(entry.rate)) return null;
    byDate.set(entry.effectiveDate as string, entry.rate as number);
  }
  return [...byDate.entries()].map(([effectiveDate, rate]) => ({ effectiveDate, rate })).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

function normalizeState(input: unknown): PilotUatState | null {
  if (!input || typeof input !== "object") return null;
  const state = input as { employees?: unknown; timesheets?: unknown; ready?: unknown };
  if (!Array.isArray(state.employees) || !state.timesheets || typeof state.timesheets !== "object" || typeof state.ready !== "boolean") return null;
  if (state.employees.length > 250) return null;

  const employees: UatEmployee[] = [];
  for (const rawEmployee of state.employees) {
    if (!rawEmployee || typeof rawEmployee !== "object") return null;
    const employee = rawEmployee as Record<string, unknown>;
    if (!(typeof employee.id === "string" && employee.id.length <= 80 && typeof employee.name === "string" && employee.name.length > 0 && employee.name.length <= 160 && (employee.payType === "Salary" || employee.payType === "Hourly") && validRate(employee.rate) && (["Active", "New hire", "Terminating", "Terminated"] as const).includes(employee.status as UatEmployee["status"]))) return null;
    if (employee.hireDate !== undefined && !validIsoDate(employee.hireDate)) return null;
    if (employee.rateEffectiveDate !== undefined && !validIsoDate(employee.rateEffectiveDate)) return null;
    if (employee.terminationDate !== undefined && !validIsoDate(employee.terminationDate)) return null;
    if ((employee.status === "Terminating" || employee.status === "Terminated") && !employee.terminationDate) return null;
    if (typeof employee.hireDate === "string" && typeof employee.terminationDate === "string" && employee.terminationDate < employee.hireDate) return null;
    if (employee.changeNote !== undefined && (typeof employee.changeNote !== "string" || employee.changeNote.length > 500)) return null;
    if (employee.taxSetupComplete !== undefined && typeof employee.taxSetupComplete !== "boolean") return null;

    const extraTaxablePayCents = normalizeExtraPay(employee);
    if (extraTaxablePayCents === null) return null;
    const finalPay = normalizeFinalPay(employee.finalPay);
    if (finalPay === null) return null;
    const rateHistory = normalizeRateHistory(employee);
    if (rateHistory === null) return null;

    employees.push({
      id: employee.id,
      name: employee.name,
      payType: employee.payType,
      rate: employee.rate as number,
      ...(rateHistory?.length ? { rateHistory } : {}),
      status: employee.status as UatEmployee["status"],
      ...(typeof employee.hireDate === "string" ? { hireDate: employee.hireDate } : {}),
      ...(typeof employee.rateEffectiveDate === "string" ? { rateEffectiveDate: employee.rateEffectiveDate } : {}),
      ...(typeof employee.terminationDate === "string" ? { terminationDate: employee.terminationDate } : {}),
      ...(extraTaxablePayCents !== undefined ? { extraTaxablePayCents } : {}),
      ...(typeof employee.changeNote === "string" ? { changeNote: employee.changeNote } : {}),
      ...(typeof employee.taxSetupComplete === "boolean" ? { taxSetupComplete: employee.taxSetupComplete } : {}),
      ...(finalPay ? { finalPay } : {}),
    });
  }

  const timesheets = state.timesheets as Record<string, unknown>;
  for (const row of Object.values(timesheets)) {
    if (!row || typeof row !== "object") return null;
    const time = row as Record<string, unknown>;
    if (![time.regular, time.overtime, time.vacation].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 10_000)) return null;
  }

  return { employees, timesheets: state.timesheets as Record<string, Timesheet>, ready: state.ready };
}

async function ensureWorkspace(user: { id: string; email: string }) {
  const db = database();
  const scope = pilotWorkspaceScope(user.id);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO employer_workspaces (id, legal_name, province, created_at, created_by) VALUES (?, ?, ?, ?, ?)").bind(scope.workspaceId, "My business", "Alberta", now, user.email),
    db.prepare("INSERT OR IGNORE INTO employer_memberships (id, workspace_id, email, display_name, role, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(scope.membershipId, scope.workspaceId, user.email, user.email, "Administrator", "Active", now, user.email),
    db.prepare("INSERT OR IGNORE INTO pilot_workspace_profiles (id, workspace_id, auth_user_id, owner_email, business_name, province, pay_frequency, expected_employee_count, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(scope.profileId, scope.workspaceId, user.id, user.email, "My business", "Alberta", "Biweekly", 4, now),
    db.prepare("INSERT OR IGNORE INTO pilot_uat_states (id, workspace_id, state_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)").bind(scope.stateId, scope.workspaceId, JSON.stringify(starterState), now, user.email),
  ]);
  return scope;
}

async function currentSnapshot(user: { id: string; email: string }) {
  const db = database();
  const scope = await ensureWorkspace(user);
  const profile = await db.prepare("SELECT business_name AS businessName, province, pay_frequency AS frequency, expected_employee_count AS employeeCount FROM pilot_workspace_profiles WHERE workspace_id = ? AND auth_user_id = ? LIMIT 1").bind(scope.workspaceId, user.id).first<PilotProfile>();
  const stateRow = await db.prepare("SELECT state_json AS stateJson, updated_at AS updatedAt FROM pilot_uat_states WHERE id = ? AND workspace_id = ? LIMIT 1").bind(scope.stateId, scope.workspaceId).first<{ stateJson: string; updatedAt: string }>();
  if (!profile) throw new Error("Pilot workspace ownership could not be verified.");
  let state = starterState;
  if (stateRow?.stateJson) {
    try {
      const parsed = normalizeState(JSON.parse(stateRow.stateJson));
      if (parsed) state = parsed;
    } catch {
      state = starterState;
    }
  }
  return { workspaceId: scope.workspaceId, profile, state, updatedAt: stateRow?.updatedAt ?? null };
}

export async function GET() {
  try {
    const user = await getCoffeePayrollUser();
    if (!user) return NextResponse.json({ error: "Sign in to use persistent pilot data." }, { status: 401 });
    return NextResponse.json(await currentSnapshot(user));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load pilot workspace." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCoffeePayrollUser();
    if (!user) return NextResponse.json({ error: "Sign in to save pilot data." }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as UpdateBody;
    const db = database();
    const scope = await ensureWorkspace(user);
    const now = new Date().toISOString();

    if (body.profile) {
      const existing = await db.prepare("SELECT business_name AS businessName, province, pay_frequency AS frequency, expected_employee_count AS employeeCount FROM pilot_workspace_profiles WHERE workspace_id = ? AND auth_user_id = ? LIMIT 1").bind(scope.workspaceId, user.id).first<PilotProfile>();
      if (!existing) return NextResponse.json({ error: "Pilot workspace ownership could not be verified." }, { status: 403 });
      const profile = safeProfile({ ...existing, ...body.profile });
      await db.batch([
        db.prepare("UPDATE pilot_workspace_profiles SET business_name = ?, province = ?, pay_frequency = ?, expected_employee_count = ?, owner_email = ?, updated_at = ? WHERE workspace_id = ? AND auth_user_id = ?").bind(profile.businessName, profile.province, profile.frequency, profile.employeeCount, user.email, now, scope.workspaceId, user.id),
        db.prepare("UPDATE employer_workspaces SET legal_name = ?, province = ? WHERE id = ?").bind(profile.businessName, profile.province, scope.workspaceId),
      ]);
    }

    if (body.resetState) {
      await db.prepare("UPDATE pilot_uat_states SET state_json = ?, updated_at = ?, updated_by = ? WHERE id = ? AND workspace_id = ?").bind(JSON.stringify(starterState), now, user.email, scope.stateId, scope.workspaceId).run();
    } else if (body.state !== undefined) {
      const normalized = normalizeState(body.state);
      if (!normalized) return NextResponse.json({ error: "UAT state is invalid." }, { status: 400 });
      await db.prepare("UPDATE pilot_uat_states SET state_json = ?, updated_at = ?, updated_by = ? WHERE id = ? AND workspace_id = ?").bind(JSON.stringify(normalized), now, user.email, scope.stateId, scope.workspaceId).run();
    }

    return NextResponse.json(await currentSnapshot(user));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save pilot workspace." }, { status: 503 });
  }
}
