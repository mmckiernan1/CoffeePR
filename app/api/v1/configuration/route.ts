import { env } from "cloudflare:workers";
import { getComcheqActor } from "@/lib/payroll/admin-auth";
import { calculateSalaryRetro } from "@/lib/payroll/effective-dating";

const WORKSPACE_ID = "WS-PNS-001";
const PAYROLL_ACCOUNT_ID = "PA-0001";
const RULESET_VERSION = "COMCHEQ-EFFECTIVE-DATING-AB-2026-v1";

function database() {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("Comcheq durable storage is unavailable.");
  return db;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function requireDate(value: unknown, field: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field} must use YYYY-MM-DD.`);
  return value;
}

function requireCents(value: unknown, field: string) {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`${field} must use non-negative integer cents.`);
  return Number(value);
}

function canWrite(role: string) {
  return role === "Administrator" || role === "Payroll Processor";
}

export async function GET() {
  const actor = await getComcheqActor();
  if (!actor) return json({ error: "Authentication and an active employer membership are required." }, 401);
  const db = database();
  const [changes, corrections, openingBalances] = await Promise.all([
    db.prepare("SELECT id, employee_id, change_type, effective_from, effective_to, previous_value_json, new_value_json, ruleset_version, status, created_at, created_by FROM employment_change_versions WHERE workspace_id = ? ORDER BY effective_from DESC, created_at DESC LIMIT 50").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, employee_id, correction_type, effective_date, pay_date, gross_cents, deductions_cents, net_pay_cents, status, explanation, created_at, created_by FROM correction_runs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, employee_id, tax_year, as_of_date, taxable_earnings_cents, pensionable_earnings_cents, insurable_earnings_cents, income_tax_cents, cpp_cents, cpp2_cents, ei_cents, vacation_hours_hundredths, vacation_dollars_cents, source_reference, status FROM opening_balance_entries WHERE workspace_id = ? ORDER BY employee_id").bind(WORKSPACE_ID).all(),
  ]);
  return json({ workspaceId: WORKSPACE_ID, jurisdiction: "AB", rulesetVersion: RULESET_VERSION, actor, changes: changes.results, corrections: corrections.results, openingBalances: openingBalances.results });
}

export async function POST(request: Request) {
  const actor = await getComcheqActor();
  if (!actor) return json({ error: "Authentication and an active employer membership are required." }, 401);
  if (!canWrite(actor.role)) return json({ error: "This role has read-only access." }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ error: "A JSON request body is required." }, 400); }

  try {
    const db = database();
    const now = new Date().toISOString();
    if (body.action === "save_salary_change") {
      const employeeId = String(body.employeeId || "");
      const effectiveDate = requireDate(body.effectiveDate, "Effective date");
      const previousAnnualSalaryCents = requireCents(body.previousAnnualSalaryCents, "Previous annual salary");
      const newAnnualSalaryCents = requireCents(body.newAnnualSalaryCents, "New annual salary");
      if (!employeeId) throw new Error("Employee is required.");
      const closedPeriods = Array.isArray(body.closedPeriods) ? body.closedPeriods.map((period, index) => {
        const item = period as Record<string, unknown>;
        return { id: String(item.id || `period-${index + 1}`), periodStart: requireDate(item.periodStart, "Period start"), periodEnd: requireDate(item.periodEnd, "Period end"), paidSalaryCents: requireCents(item.paidSalaryCents, "Paid salary") };
      }) : [];
      const calculation = calculateSalaryRetro({ effectiveDate, previousAnnualSalaryCents, newAnnualSalaryCents, periodsPerYear: 24, closedPeriods, prorationBasis: body.prorationBasis === "calendar-days" ? "calendar-days" : body.prorationBasis === "full-period" ? "full-period" : "workdays" });
      const changeId = `ECV-${crypto.randomUUID()}`;
      const auditId = `AE-${crypto.randomUUID()}`;
      await db.batch([
        db.prepare("INSERT INTO employment_change_versions (id, workspace_id, employee_id, change_type, effective_from, effective_to, previous_value_json, new_value_json, ruleset_version, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(changeId, WORKSPACE_ID, employeeId, "salary_change", effectiveDate, null, JSON.stringify({ annualSalaryCents: previousAnnualSalaryCents }), JSON.stringify({ annualSalaryCents: newAnnualSalaryCents, retroactiveDifferenceCents: calculation.totalRetroactiveDifferenceCents }), calculation.rulesetVersion, "Scheduled", now, actor.email),
        db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(auditId, WORKSPACE_ID, now, actor.email, "employment.salary_change.saved", "employment_change", changeId, `Salary change saved effective ${effectiveDate}`, JSON.stringify(calculation)),
      ]);
      return json({ changeId, calculation, persistedAt: now }, 201);
    }

    if (body.action === "save_opening_balance") {
      const employeeId = String(body.employeeId || "");
      const taxYear = Number(body.taxYear);
      if (!employeeId || !Number.isInteger(taxYear)) throw new Error("Employee and tax year are required.");
      const id = `OB-${crypto.randomUUID()}`;
      await db.prepare("INSERT INTO opening_balance_entries (id, workspace_id, employee_id, tax_year, as_of_date, taxable_earnings_cents, pensionable_earnings_cents, insurable_earnings_cents, income_tax_cents, cpp_cents, cpp2_cents, ei_cents, vacation_hours_hundredths, vacation_dollars_cents, source_reference, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_id, employee_id, tax_year) DO UPDATE SET as_of_date = excluded.as_of_date, taxable_earnings_cents = excluded.taxable_earnings_cents, pensionable_earnings_cents = excluded.pensionable_earnings_cents, insurable_earnings_cents = excluded.insurable_earnings_cents, income_tax_cents = excluded.income_tax_cents, cpp_cents = excluded.cpp_cents, cpp2_cents = excluded.cpp2_cents, ei_cents = excluded.ei_cents, vacation_hours_hundredths = excluded.vacation_hours_hundredths, vacation_dollars_cents = excluded.vacation_dollars_cents, source_reference = excluded.source_reference, status = excluded.status, created_at = excluded.created_at, created_by = excluded.created_by").bind(id, WORKSPACE_ID, employeeId, taxYear, requireDate(body.asOfDate, "As-of date"), requireCents(body.taxableEarningsCents, "Taxable earnings"), requireCents(body.pensionableEarningsCents, "Pensionable earnings"), requireCents(body.insurableEarningsCents, "Insurable earnings"), requireCents(body.incomeTaxCents, "Income tax"), requireCents(body.cppCents, "CPP"), requireCents(body.cpp2Cents ?? 0, "CPP2"), requireCents(body.eiCents, "EI"), requireCents(body.vacationHoursHundredths ?? 0, "Vacation hours"), requireCents(body.vacationDollarsCents ?? 0, "Vacation dollars"), String(body.sourceReference || "Client conversion"), "Validated", now, actor.email).run();
      return json({ openingBalanceId: id, status: "Validated", persistedAt: now }, 201);
    }

    if (body.action === "create_correction") {
      const employeeId = String(body.employeeId || "");
      if (!employeeId) throw new Error("Employee is required.");
      const grossCents = requireCents(body.grossCents, "Gross adjustment");
      const deductionsCents = requireCents(body.deductionsCents, "Deductions");
      if (deductionsCents > grossCents) throw new Error("The correction would create negative net pay and cannot be approved.");
      const id = `X-${crypto.randomUUID()}`;
      await db.prepare("INSERT INTO correction_runs (id, workspace_id, payroll_account_id, employee_id, linked_pay_run_id, correction_type, effective_date, pay_date, gross_cents, deductions_cents, net_pay_cents, status, explanation, created_at, created_by, approved_at, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, WORKSPACE_ID, PAYROLL_ACCOUNT_ID, employeeId, body.linkedPayRunId ? String(body.linkedPayRunId) : null, String(body.correctionType || "underpayment"), requireDate(body.effectiveDate, "Effective date"), requireDate(body.payDate, "Pay date"), grossCents, deductionsCents, grossCents - deductionsCents, "Draft", String(body.explanation || "Client-created linked correction"), now, actor.email, null, null).run();
      return json({ correctionRunId: id, status: "Draft", netPayCents: grossCents - deductionsCents, persistedAt: now }, 201);
    }

    if (body.action === "approve_correction") {
      const correctionRunId = String(body.correctionRunId || "");
      if (!correctionRunId) throw new Error("Correction run is required.");
      const correction = await db.prepare("SELECT id, status, net_pay_cents FROM correction_runs WHERE id = ? AND workspace_id = ? LIMIT 1").bind(correctionRunId, WORKSPACE_ID).first<{ id: string; status: string; net_pay_cents: number }>();
      if (!correction) throw new Error("Correction run was not found.");
      if (correction.status !== "Draft") throw new Error("Only a draft correction can be approved.");
      if (correction.net_pay_cents < 0) throw new Error("A negative-net correction cannot be approved.");
      const auditId = `AE-${crypto.randomUUID()}`;
      await db.batch([
        db.prepare("UPDATE correction_runs SET status = ?, approved_at = ?, approved_by = ? WHERE id = ? AND workspace_id = ? AND status = ?").bind("Approved", now, actor.email, correctionRunId, WORKSPACE_ID, "Draft"),
        db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(auditId, WORKSPACE_ID, now, actor.email, "correction.approved", "correction_run", correctionRunId, "Linked correction approved", JSON.stringify({ netPayCents: correction.net_pay_cents })),
      ]);
      return json({ correctionRunId, status: "Approved", approvedAt: now });
    }

    return json({ error: "Unsupported configuration action." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "The configuration action failed." }, 400);
  }
}
