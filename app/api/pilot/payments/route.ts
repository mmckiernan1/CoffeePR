import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCoffeePayrollUser } from "@/lib/auth/current-user";

type PaymentState = {
  approved: boolean;
  paidEmployeeIds: string[];
  references: Record<string, string>;
  completedAt: string | null;
};

type UpdateBody = {
  approved?: boolean;
  paidEmployeeIds?: string[];
  references?: Record<string, string>;
  completedAt?: string | null;
  reset?: boolean;
};

const emptyState: PaymentState = {
  approved: false,
  paidEmployeeIds: [],
  references: {},
  completedAt: null,
};

function database() {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("Coffee Payroll durable storage is unavailable.");
  return db;
}

function workspaceId(userId: string) {
  return `WS-PILOT-${userId}`;
}

function rowId(userId: string) {
  return `PAY-UAT-${userId}`;
}

function validState(input: unknown): input is PaymentState {
  if (!input || typeof input !== "object") return false;
  const state = input as PaymentState;
  if (typeof state.approved !== "boolean" || !Array.isArray(state.paidEmployeeIds) || !state.references || typeof state.references !== "object") return false;
  if (state.paidEmployeeIds.length > 250) return false;
  if (!state.paidEmployeeIds.every((id) => typeof id === "string" && id.length <= 80)) return false;
  if (state.completedAt !== null && typeof state.completedAt !== "string") return false;
  return Object.entries(state.references).every(([id, value]) => id.length <= 80 && typeof value === "string" && value.length <= 120);
}

async function ensureState(user: { id: string; email: string }) {
  const db = database();
  const wsId = workspaceId(user.id);
  const now = new Date().toISOString();
  const workspace = await db.prepare("SELECT id FROM employer_workspaces WHERE id = ? LIMIT 1").bind(wsId).first<{ id: string }>();
  if (!workspace) throw new Error("Open the pilot workspace before using payment UAT.");

  await db.prepare("INSERT OR IGNORE INTO pilot_uat_states (id, workspace_id, state_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)")
    .bind(rowId(user.id), wsId, JSON.stringify(emptyState), now, user.email).run();
  return wsId;
}

async function readState(user: { id: string; email: string }) {
  const db = database();
  const wsId = await ensureState(user);
  const row = await db.prepare("SELECT state_json AS stateJson, updated_at AS updatedAt FROM pilot_uat_states WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(rowId(user.id), wsId).first<{ stateJson: string; updatedAt: string }>();
  try {
    const parsed = JSON.parse(row?.stateJson ?? "{}");
    if (validState(parsed)) return { state: parsed, updatedAt: row?.updatedAt ?? null };
  } catch {
    // Fall back to a clean pilot payment state.
  }
  return { state: emptyState, updatedAt: row?.updatedAt ?? null };
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
    const { state: existing } = await readState(user);
    const now = new Date().toISOString();

    const next: PaymentState = body.reset ? emptyState : {
      approved: body.approved ?? existing.approved,
      paidEmployeeIds: body.paidEmployeeIds ?? existing.paidEmployeeIds,
      references: body.references ?? existing.references,
      completedAt: body.completedAt === undefined ? existing.completedAt : body.completedAt,
    };
    if (!validState(next)) return NextResponse.json({ error: "Payment UAT state is invalid." }, { status: 400 });

    await db.prepare("UPDATE pilot_uat_states SET state_json = ?, updated_at = ?, updated_by = ? WHERE id = ? AND workspace_id = ?")
      .bind(JSON.stringify(next), now, user.email, rowId(user.id), workspaceId(user.id)).run();
    return NextResponse.json({ state: next, updatedAt: now });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save payment UAT." }, { status: 503 });
  }
}
