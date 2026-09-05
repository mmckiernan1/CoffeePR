import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCoffeePayrollUser } from "@/lib/auth/current-user";
import { dollarsToCents } from "@/lib/payroll/money";

type FinalPay = {
  vacationPayCents: number;
  overtimePayCents: number;
  otherTaxablePayCents: number;
  reimbursementCents: number;
};

type LegacyFinalPay = {
  vacationPay: number;
  overtimePay: number;
  otherTaxablePay: number;
  reimbursement: number;
};

type RateHistoryEntry = { effectiveDate: string; rate: number };

type UatEmployee = {
  id: string;
  name: string;
  payType: "Salary" | "Hourly";
  rate: number;
  rateHistory?: RateHistoryEntry[];
  status: "Active" | "New hire" | "Terminating" | "Terminated";
  hireDate?: string;
  rateEffectiveDate?: string;
  terminationDate?: string;
  extraTaxablePayCents?: number;
  changeNote?: string;
  taxSetupComplete?: boolean;
  finalPay?: FinalPay;
};

type Timesheet = { regular: number; overtime: number; vacation: number };
type PilotUatState = { employees: UatEmployee[]; timesheets: Record<string, Timesheet>; ready: boolean };
type PilotProfile = { businessName: string; province: string; frequency: string; employeeCount: number };
type UpdateBody = { profile?: Partial<PilotProfile>; state?: unknown; resetState?: boolean };

const starterState: PilotUatState = {
  employees: [
    { id: "EMP-0001", name: "Avery Chen", payType: "Salary", rate: 80000, rateHistory: [{ effectiveDate: "2024-01-08", rate: 80000 }], status: "Active", hireDate: "2024-01-08", taxSetupComplete: true },
    { id: "EMP-0002", name: "Noah Williams", payType: "Hourly", rate: 30, rateHistory: [{ effectiveDate: "2024-05-13", rate: 30 }], status: "Active", hireDate: "2024-05-13", taxSetupComplete: true },
    { id: "EMP-0003", name: "Priya Singh", payType: "Salary", rate: 111000, rateHistory: [{ effectiveDate: "2023-09-05", rate: 111000 }], status: "Active", hireDate: "2023-09-05", taxSetupComplete: true },
    { id: "EMP-0004", name: "Liam Martin", payType: "Hourly", rate: 29.5, rateHistory: [{ effectiveDate: "2025-02-03", rate: 29.5 }], status: "Active", hireDate: "2025-02-03", taxSetupComplete: true },
  ],
  timesheets: {
    "EMP-0002": { regular: 80, overtime: 2.5, vacation: 0 },
    "EMP-0004": { regular: 72, overtime: 0, vacation: 0 },
  },
  ready: false,
};

function database() {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("Coffee Payroll durable storage is unavailable.");
  return db;
}

function workspaceId(userId: string) { return `WS-PILOT-${userId}`; }
function profileId(userId: string) { return `PWP-${userId}`; }
function stateId(userId: string) { return `UAT-${userId}`; }
function membershipId(userId: string) { return `MEM-PILOT-${userId}`; }

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
  const wsId = workspaceId(user.id);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO employer_workspaces (id, legal_name, province, created_at, created_by) VALUES (?, ?, ?, ?, ?)").bind(wsId, "My business", "Alberta", now, user.email),
    db.prepare("INSERT OR IGNORE INTO employer_memberships (id, workspace_id, email, display_name, role, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(membershipId(user.id), wsId, user.email, user.email, "Administrator", "Active", now, user.email),
    db.prepare("INSERT OR IGNORE INTO pilot_workspace_profiles (id, workspace_id, auth_user_id, owner_email, business_name, province, pay_frequency, expected_employee_count, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(profileId(user.id), wsId, user.id, user.email, "My business", "Alberta", "Biweekly", 4, now),
    db.prepare("INSERT OR IGNORE INTO pilot_uat_states (id, workspace_id, state_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)").bind(stateId(user.id), wsId, JSON.stringify(starterState), now, user.email),
  ]);
  return wsId;
}

async function currentSnapshot(user: { id: string; email: string }) {
  const db = database();
  const wsId = await ensureWorkspace(user);
  const profile = await db.prepare("SELECT business_name AS businessName, province, pay_frequency AS frequency, expected_employee_count AS employeeCount FROM pilot_workspace_profiles WHERE workspace_id = ? LIMIT 1").bind(wsId).first<PilotProfile>();
  const stateRow = await db.prepare("SELECT state_json AS stateJson, updated_at AS updatedAt FROM pilot_uat_states WHERE workspace_id = ? LIMIT 1").bind(wsId).first<{ stateJson: string; updatedAt: string }>();
  let state = starterState;
  if (stateRow?.stateJson) {
    try {
      const parsed = normalizeState(JSON.parse(stateRow.stateJson));
      if (parsed) state = parsed;
    } catch {
      state = starterState;
    }
  }
  return { workspaceId: wsId, profile: profile ?? safeProfile(undefined), state, updatedAt: stateRow?.updatedAt ?? null };
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
    const wsId = await ensureWorkspace(user);
    const now = new Date().toISOString();

    if (body.profile) {
      const existing = await db.prepare("SELECT business_name AS businessName, province, pay_frequency AS frequency, expected_employee_count AS employeeCount FROM pilot_workspace_profiles WHERE workspace_id = ? LIMIT 1").bind(wsId).first<PilotProfile>();
      const profile = safeProfile({ ...existing, ...body.profile });
      await db.batch([
        db.prepare("UPDATE pilot_workspace_profiles SET business_name = ?, province = ?, pay_frequency = ?, expected_employee_count = ?, owner_email = ?, updated_at = ? WHERE workspace_id = ?").bind(profile.businessName, profile.province, profile.frequency, profile.employeeCount, user.email, now, wsId),
        db.prepare("UPDATE employer_workspaces SET legal_name = ?, province = ? WHERE id = ?").bind(profile.businessName, profile.province, wsId),
      ]);
    }

    if (body.resetState) {
      await db.prepare("UPDATE pilot_uat_states SET state_json = ?, updated_at = ?, updated_by = ? WHERE workspace_id = ?").bind(JSON.stringify(starterState), now, user.email, wsId).run();
    } else if (body.state !== undefined) {
      const normalized = normalizeState(body.state);
      if (!normalized) return NextResponse.json({ error: "UAT state is invalid." }, { status: 400 });
      await db.prepare("UPDATE pilot_uat_states SET state_json = ?, updated_at = ?, updated_by = ? WHERE workspace_id = ?").bind(JSON.stringify(normalized), now, user.email, wsId).run();
    }

    return NextResponse.json(await currentSnapshot(user));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save pilot workspace." }, { status: 503 });
  }
}
