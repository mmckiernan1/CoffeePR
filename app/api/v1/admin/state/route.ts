import { env } from "cloudflare:workers";
import { getComcheqActor, type ComcheqRole } from "@/lib/payroll/admin-auth";
import { calculateAlbertaPayroll } from "@/lib/payroll/statutory/calculate";

const WORKSPACE_ID = "WS-PNS-001";
const OPTION_1 = "Option 1 — Periodic";
const OPTION_2 = "Option 2 — Cumulative averaging";

type AdminAction =
  | { action: "create_account"; legalEntity: string; rpSuffix: string; remitterType: string }
  | { action: "save_offboarding"; employeeId: string; employeeName: string; reasonCode: string; lastDay: string; finalPayMethod: string }
  | { action: "create_membership"; email: string; displayName: string; role: ComcheqRole }
  | { action: "update_default_tax_method"; taxMethod: string }
  | { action: "update_employee_payroll_profile"; employeeId: string; salaryPeriodicCents: number; hourlyRateCents: number; standardHoursHundredths: number; federalClaimCents: number; albertaClaimCents: number; additionalTaxCents: number; cppExempt: boolean; eiExempt: boolean; effectiveFrom: string }
  | { action: "create_payroll_code"; code: string; name: string; type: "Earning" | "Deduction"; taxable: boolean; pensionable: boolean; insurable: boolean }
  | { action: "assign_recurring_pay_item"; employeeId: string; payrollCodeId: string; amountCents: number; effectiveFrom: string; effectiveTo: string | null }
  | { action: "calculate_draft"; draftId: string; lines: Array<{ employeeId: string; regularHoursHundredths: number; overtimeHoursHundredths: number; otherEarningsCents: number; otherDeductionsCents: number }> }
  | { action: "confirm_compliance_check"; draftId: string; checkCode: string }
  | { action: "review_draft"; draftId: string }
  | { action: "approve_draft"; draftId: string }
  | { action: "create_next_draft" }
  | { action: "approve_demo_run" };

const DEMO_PROFILES = {
  "EMP-0001": { name: "Avery Chen", payType: "Salary", salaryCents: 307_692, hourlyRateCents: 0, regularHoursHundredths: 8_000, overtimeHoursHundredths: 0, ytd: { pensionableEarningsCents: 4_923_072, incomeTaxCents: 850_000, cppCents: 280_000, cpp2Cents: 0, eiCents: 80_000 } },
  "EMP-0002": { name: "Noah Williams", payType: "Hourly", salaryCents: 0, hourlyRateCents: 3_000, regularHoursHundredths: 8_000, overtimeHoursHundredths: 517, ytd: { pensionableEarningsCents: 3_600_000, incomeTaxCents: 540_000, cppCents: 210_000, cpp2Cents: 0, eiCents: 58_000 } },
  "EMP-0003": { name: "Priya Singh", payType: "Salary", salaryCents: 426_923, hourlyRateCents: 0, regularHoursHundredths: 8_000, overtimeHoursHundredths: 0, ytd: { pensionableEarningsCents: 6_826_923, incomeTaxCents: 1_250_000, cppCents: 390_000, cpp2Cents: 0, eiCents: 111_000 } },
  "EMP-0004": { name: "Liam Martin", payType: "Hourly", salaryCents: 0, hourlyRateCents: 2_950, regularHoursHundredths: 7_200, overtimeHoursHundredths: 0, ytd: { pensionableEarningsCents: 2_900_000, incomeTaxCents: 420_000, cppCents: 165_000, cpp2Cents: 0, eiCents: 47_000 } },
} as const;

const DEMO_PAYMENTS = [
  { id: "PAY-17-EMP-0001", employeeId: "EMP-0001", employeeName: "Avery Chen", grossCents: 307692, incomeTaxCents: 58834, cppCents: 17762, eiCents: 5015, otherDeductionsCents: 12000, netPayCents: 214081 },
  { id: "PAY-17-EMP-0002", employeeId: "EMP-0002", employeeName: "Noah Williams", grossCents: 263250, incomeTaxCents: 43915, cppCents: 15117, eiCents: 4291, otherDeductionsCents: 6250, netPayCents: 193677 },
  { id: "PAY-17-EMP-0003", employeeId: "EMP-0003", employeeName: "Priya Singh", grossCents: 426923, incomeTaxCents: 93144, cppCents: 24587, eiCents: 6959, otherDeductionsCents: 25500, netPayCents: 276733 },
  { id: "PAY-17-EMP-0004", employeeId: "EMP-0004", employeeName: "Liam Martin", grossCents: 212400, incomeTaxCents: 31912, cppCents: 12224, eiCents: 3462, otherDeductionsCents: 0, netPayCents: 164802 },
] as const;

function database() {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("Comcheq durable storage is unavailable.");
  return db;
}

async function ensureFictionalWorkspace(actorEmail: string) {
  const db = database();
  const createdAt = "2026-08-30T16:30:00.000Z";
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO employer_workspaces (id, legal_name, province, created_at, created_by) VALUES (?, ?, ?, ?, ?)").bind(WORKSPACE_ID, "Prairie North Services Ltd.", "AB", createdAt, actorEmail),
    db.prepare("INSERT OR IGNORE INTO payroll_accounts (id, workspace_id, program_account_masked, remitter_type, status, employee_count, next_run, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("PA-0001", WORKSPACE_ID, "********* RP0001", "Monthly", "Active", 4, "Run 17 · Sep 4", createdAt, actorEmail),
    db.prepare("INSERT OR IGNORE INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("AE-BASELINE-001", WORKSPACE_ID, createdAt, actorEmail, "workspace.initialized", "workspace", WORKSPACE_ID, "Fictional employer workspace initialized", "{}"),
    db.prepare("INSERT OR IGNORE INTO employees (id, workspace_id, payroll_account_id, legal_name, email, role_title, department, pay_type, pay_rate, hire_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("EMP-0001", WORKSPACE_ID, "PA-0001", "Avery Chen", "avery@example.ca", "Operations Manager", "Operations", "Salary", "$80,000 annual", "2024-01-05", "Active", createdAt),
    db.prepare("INSERT OR IGNORE INTO employees (id, workspace_id, payroll_account_id, legal_name, email, role_title, department, pay_type, pay_rate, hire_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("EMP-0002", WORKSPACE_ID, "PA-0001", "Noah Williams", "noah@example.ca", "Field Technician", "Field Services", "Hourly", "$30.00 per hour", "2026-01-12", "Active", createdAt),
    db.prepare("INSERT OR IGNORE INTO employees (id, workspace_id, payroll_account_id, legal_name, email, role_title, department, pay_type, pay_rate, hire_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("EMP-0003", WORKSPACE_ID, "PA-0001", "Priya Singh", "priya@example.ca", "Finance Lead", "Finance", "Salary", "$111,000 annual", "2023-05-08", "Active", createdAt),
    db.prepare("INSERT OR IGNORE INTO employees (id, workspace_id, payroll_account_id, legal_name, email, role_title, department, pay_type, pay_rate, hire_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("EMP-0004", WORKSPACE_ID, "PA-0001", "Liam Martin", "liam@example.ca", "Customer Support", "Customer Support", "Hourly", "$29.50 per hour", "2025-03-03", "Active", createdAt),
    db.prepare("INSERT OR IGNORE INTO employer_memberships (id, workspace_id, email, display_name, role, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind("MEM-ADMIN-001", WORKSPACE_ID, actorEmail.toLowerCase(), "Martin", "Administrator", "Active", createdAt, actorEmail),
    db.prepare("INSERT OR IGNORE INTO employer_payroll_settings (id, workspace_id, default_tax_method, option2_available, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)").bind("EPS-PNS-001", WORKSPACE_ID, OPTION_1, 0, createdAt, actorEmail),
    db.prepare("INSERT OR IGNORE INTO pay_schedules (id, workspace_id, payroll_account_id, name, frequency, periods_per_year, next_run_number, next_period_start, next_period_end, next_pay_date, status, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("PS-BIWEEKLY-001", WORKSPACE_ID, "PA-0001", "Prairie North biweekly", "Biweekly", 26, 17, "2026-08-16", "2026-08-31", "2026-09-04", "Active", createdAt, actorEmail),
    ...Object.entries(DEMO_PROFILES).map(([employeeId, profile]) => db.prepare("INSERT OR IGNORE INTO employee_payroll_profiles (id, workspace_id, employee_id, pay_schedule_id, tax_method, salary_periodic_cents, hourly_rate_cents, standard_hours_hundredths, federal_claim_cents, alberta_claim_cents, additional_tax_cents, cpp_exempt, ei_exempt, effective_from, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`EPP-${employeeId}`, WORKSPACE_ID, employeeId, "PS-BIWEEKLY-001", OPTION_1, profile.salaryCents, profile.hourlyRateCents, profile.regularHoursHundredths, 1_645_200, 2_276_900, 0, 0, 0, "2026-01-01", createdAt, actorEmail)),
    ...Object.entries(DEMO_PROFILES).map(([employeeId, profile]) => db.prepare("INSERT OR IGNORE INTO employee_payroll_profile_versions (id, workspace_id, employee_id, pay_schedule_id, tax_method, salary_periodic_cents, hourly_rate_cents, standard_hours_hundredths, federal_claim_cents, alberta_claim_cents, additional_tax_cents, cpp_exempt, ei_exempt, effective_from, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`EPPV-${employeeId}-2026-01-01`, WORKSPACE_ID, employeeId, "PS-BIWEEKLY-001", OPTION_1, profile.salaryCents, profile.hourlyRateCents, profile.regularHoursHundredths, 1_645_200, 2_276_900, 0, 0, 0, "2026-01-01", createdAt, actorEmail)),
    db.prepare("INSERT OR IGNORE INTO payroll_codes (id, workspace_id, code, name, type, calculation_mode, taxable, pensionable, insurable, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("PC-ALLOW", WORKSPACE_ID, "ALLOW", "Recurring taxable allowance", "Earning", "Fixed amount", 1, 1, 1, "Active", createdAt, actorEmail),
    db.prepare("INSERT OR IGNORE INTO payroll_codes (id, workspace_id, code, name, type, calculation_mode, taxable, pensionable, insurable, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("PC-HEALTH", WORKSPACE_ID, "HEALTH", "Health plan deduction", "Deduction", "Fixed amount", 0, 0, 0, "Active", createdAt, actorEmail),
    ...Object.entries(DEMO_PROFILES).map(([employeeId, profile]) => db.prepare("INSERT OR IGNORE INTO statutory_ledger_entries (id, workspace_id, employee_id, pay_run_id, tax_year, entry_type, pay_date, taxable_earnings_cents, pensionable_earnings_cents, insurable_earnings_cents, income_tax_cents, cpp_cents, cpp2_cents, ei_cents, source_reference, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`SLE-OPENING-${employeeId}`, WORKSPACE_ID, employeeId, null, 2026, "Conversion opening", "2026-08-15", profile.ytd.pensionableEarningsCents, profile.ytd.pensionableEarningsCents, profile.ytd.pensionableEarningsCents, profile.ytd.incomeTaxCents, profile.ytd.cppCents, profile.ytd.cpp2Cents, profile.ytd.eiCents, `conversion-opening:2026:${employeeId}`, createdAt, actorEmail)),
  ]);
  const approvedPayments = await db.prepare("SELECT p.pay_run_id AS payRunId, p.employee_id AS employeeId, p.gross_cents AS grossCents, p.income_tax_cents AS incomeTaxCents, p.cpp_cents AS cppCents, p.cpp2_cents AS cpp2Cents, p.ei_cents AS eiCents, r.payroll_year AS payrollYear, r.pay_date AS payDate, r.approved_at AS approvedAt, r.approved_by AS approvedBy FROM pay_run_payments p JOIN pay_runs r ON r.id = p.pay_run_id WHERE p.workspace_id = ? AND r.status = 'Approved'").bind(WORKSPACE_ID).all<{ payRunId: string; employeeId: string; grossCents: number; incomeTaxCents: number; cppCents: number; cpp2Cents: number; eiCents: number; payrollYear: number; payDate: string; approvedAt: string; approvedBy: string }>();
  if (approvedPayments.results.length) await db.batch(approvedPayments.results.map((payment) => db.prepare("INSERT OR IGNORE INTO statutory_ledger_entries (id, workspace_id, employee_id, pay_run_id, tax_year, entry_type, pay_date, taxable_earnings_cents, pensionable_earnings_cents, insurable_earnings_cents, income_tax_cents, cpp_cents, cpp2_cents, ei_cents, source_reference, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`SLE-${payment.payRunId}-${payment.employeeId}`, WORKSPACE_ID, payment.employeeId, payment.payRunId, payment.payrollYear, "Approved payroll", payment.payDate, payment.grossCents, payment.grossCents, payment.grossCents, payment.incomeTaxCents, payment.cppCents, payment.cpp2Cents, payment.eiCents, `approved-pay-run:${payment.payRunId}:${payment.employeeId}`, payment.approvedAt, payment.approvedBy)));
  const activeDraft = await db.prepare("SELECT run_number AS runNumber, period_start AS periodStart, period_end AS periodEnd, pay_date AS payDate FROM pay_run_drafts WHERE workspace_id = ? AND status != 'Approved' ORDER BY run_number DESC LIMIT 1").bind(WORKSPACE_ID).first<{ runNumber: number; periodStart: string; periodEnd: string; payDate: string }>();
  const latestApproved = activeDraft ? null : await db.prepare("SELECT run_number AS runNumber, period_start AS periodStart, period_end AS periodEnd, pay_date AS payDate FROM pay_runs WHERE workspace_id = ? AND status = 'Approved' ORDER BY payroll_year DESC, run_number DESC LIMIT 1").bind(WORKSPACE_ID).first<{ runNumber: number; periodStart: string; periodEnd: string; payDate: string }>();
  if (activeDraft) {
    await db.prepare("UPDATE pay_schedules SET next_run_number = ?, next_period_start = ?, next_period_end = ?, next_pay_date = ? WHERE id = ? AND workspace_id = ?").bind(activeDraft.runNumber, activeDraft.periodStart, activeDraft.periodEnd, activeDraft.payDate, "PS-BIWEEKLY-001", WORKSPACE_ID).run();
  } else if (latestApproved) {
    await db.prepare("UPDATE pay_schedules SET next_run_number = ?, next_period_start = ?, next_period_end = ?, next_pay_date = ? WHERE id = ? AND workspace_id = ?").bind(latestApproved.runNumber + 1, addDays(latestApproved.periodStart, 14), addDays(latestApproved.periodEnd, 14), addDays(latestApproved.payDate, 14), "PS-BIWEEKLY-001", WORKSPACE_ID).run();
  }
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const ALBERTA_GENERAL_HOLIDAYS_2026 = [
  ["2026-01-01", "New Year’s Day"],
  ["2026-02-16", "Alberta Family Day"],
  ["2026-04-03", "Good Friday"],
  ["2026-05-18", "Victoria Day"],
  ["2026-07-01", "Canada Day"],
  ["2026-09-07", "Labour Day"],
  ["2026-10-12", "Thanksgiving Day"],
  ["2026-11-11", "Remembrance Day"],
  ["2026-12-25", "Christmas Day"],
] as const;

async function createDraftFromSchedule(actorEmail: string) {
  const db = database();
  const existing = await db.prepare("SELECT id FROM pay_run_drafts WHERE workspace_id = ? AND status != 'Approved' LIMIT 1").bind(WORKSPACE_ID).first<{ id: string }>();
  if (existing) return existing.id;
  const schedule = await db.prepare("SELECT id, payroll_account_id AS payrollAccountId, periods_per_year AS periodsPerYear, next_run_number AS nextRunNumber, next_period_start AS nextPeriodStart, next_period_end AS nextPeriodEnd, next_pay_date AS nextPayDate FROM pay_schedules WHERE workspace_id = ? AND status = 'Active' ORDER BY id LIMIT 1").bind(WORKSPACE_ID).first<{ id: string; payrollAccountId: string; periodsPerYear: number; nextRunNumber: number; nextPeriodStart: string; nextPeriodEnd: string; nextPayDate: string }>();
  if (!schedule) throw new Error("An active pay schedule is required before creating a pay run.");
  const settings = await db.prepare("SELECT default_tax_method AS defaultTaxMethod FROM employer_payroll_settings WHERE workspace_id = ? LIMIT 1").bind(WORKSPACE_ID).first<{ defaultTaxMethod: string }>();
  if (!settings) throw new Error("Employer payroll settings are required before creating a pay run.");
  const profiles = await db.prepare("SELECT p.employee_id AS employeeId, e.legal_name AS employeeName, e.pay_type AS payType, p.standard_hours_hundredths AS standardHoursHundredths, COALESCE((SELECT SUM(r.amount_cents) FROM employee_recurring_pay_items r JOIN payroll_codes c ON c.id = r.payroll_code_id WHERE r.workspace_id = p.workspace_id AND r.employee_id = p.employee_id AND r.status = 'Active' AND c.status = 'Active' AND c.type = 'Earning' AND r.effective_from <= ? AND (r.effective_to IS NULL OR r.effective_to >= ?)), 0) AS recurringEarningsCents, COALESCE((SELECT SUM(r.amount_cents) FROM employee_recurring_pay_items r JOIN payroll_codes c ON c.id = r.payroll_code_id WHERE r.workspace_id = p.workspace_id AND r.employee_id = p.employee_id AND r.status = 'Active' AND c.status = 'Active' AND c.type = 'Deduction' AND r.effective_from <= ? AND (r.effective_to IS NULL OR r.effective_to >= ?)), 0) AS recurringDeductionsCents FROM employee_payroll_profile_versions p JOIN employees e ON e.id = p.employee_id WHERE p.workspace_id = ? AND p.pay_schedule_id = ? AND e.status = 'Active' AND p.id = (SELECT p2.id FROM employee_payroll_profile_versions p2 WHERE p2.workspace_id = p.workspace_id AND p2.employee_id = p.employee_id AND p2.effective_from <= ? ORDER BY p2.effective_from DESC, p2.created_at DESC LIMIT 1) ORDER BY e.legal_name").bind(schedule.nextPayDate, schedule.nextPayDate, schedule.nextPayDate, schedule.nextPayDate, WORKSPACE_ID, schedule.id, schedule.nextPayDate).all<{ employeeId: string; employeeName: string; payType: string; standardHoursHundredths: number; recurringEarningsCents: number; recurringDeductionsCents: number }>();
  if (!profiles.results.length) throw new Error("The pay schedule has no active employee payroll profiles.");
  const draftId = `DR-${schedule.payrollAccountId}-${schedule.nextPayDate.slice(0, 4)}-${String(schedule.nextRunNumber).padStart(3, "0")}`;
  const createdAt = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT INTO pay_run_drafts (id, workspace_id, payroll_account_id, payroll_year, run_number, period_start, period_end, pay_date, status, tax_method, ruleset_version, gross_cents, net_cents, blocking_exception_count, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(draftId, WORKSPACE_ID, schedule.payrollAccountId, Number(schedule.nextPayDate.slice(0, 4)), schedule.nextRunNumber, schedule.nextPeriodStart, schedule.nextPeriodEnd, schedule.nextPayDate, "Draft", settings.defaultTaxMethod, "CRA-T4127-2026-AB-v1", 0, 0, 0, createdAt, actorEmail),
    ...profiles.results.map((profile) => db.prepare("INSERT INTO pay_run_draft_lines (id, workspace_id, draft_id, employee_id, employee_name, pay_type, regular_hours_hundredths, overtime_hours_hundredths, other_earnings_cents, other_deductions_cents, gross_cents, income_tax_cents, cpp_cents, cpp2_cents, ei_cents, net_pay_cents, exceptions_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`DL-${draftId}-${profile.employeeId}`, WORKSPACE_ID, draftId, profile.employeeId, profile.employeeName, profile.payType, profile.standardHoursHundredths, 0, profile.recurringEarningsCents, profile.recurringDeductionsCents, 0, 0, 0, 0, 0, 0, "[]", createdAt)),
    db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`AE-${crypto.randomUUID()}`, WORKSPACE_ID, createdAt, actorEmail, "pay_run.created", "pay_run_draft", draftId, `Run ${schedule.nextRunNumber} draft created from ${schedule.periodsPerYear}-period schedule`, JSON.stringify({ scheduleId: schedule.id, periodStart: schedule.nextPeriodStart, periodEnd: schedule.nextPeriodEnd, payDate: schedule.nextPayDate, recurringItemsApplied: true })),
  ]);
  return draftId;
}

async function ensureInitialDraft(actorEmail: string) {
  const db = database();
  const anyDraft = await db.prepare("SELECT id FROM pay_run_drafts WHERE workspace_id = ? LIMIT 1").bind(WORKSPACE_ID).first<{ id: string }>();
  if (!anyDraft) await createDraftFromSchedule(actorEmail);
}

async function state(actor: { email: string; role: ComcheqRole }) {
  if (actor.role === "Administrator") {
    await ensureFictionalWorkspace(actor.email);
    await ensureInitialDraft(actor.email);
  }
  const db = database();
  const [accounts, employees, offboarding, memberships, payrollSettings, schedules, payrollProfiles, payrollCodes, recurringPayItems, payRuns, outputs, billing, activeDrafts, draftLines, draftComponents, complianceChecks, payments, paymentComponents, audit] = await Promise.all([
    db.prepare("SELECT id, program_account_masked AS programAccount, remitter_type AS remitterType, status, employee_count AS employeeCount, next_run AS nextRun, created_at AS createdAt FROM payroll_accounts WHERE workspace_id = ? ORDER BY created_at ASC").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, payroll_account_id AS payrollAccountId, legal_name AS legalName, email, role_title AS roleTitle, department, pay_type AS payType, pay_rate AS payRate, hire_date AS hireDate, status FROM employees WHERE workspace_id = ? ORDER BY legal_name ASC").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, employee_id AS employeeId, employee_name AS employeeName, reason_code AS reasonCode, last_day AS lastDay, final_pay_method AS finalPayMethod, status, updated_at AS updatedAt, updated_by AS updatedBy FROM offboarding_drafts WHERE workspace_id = ? ORDER BY updated_at DESC").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, email, display_name AS displayName, role, status, created_at AS createdAt FROM employer_memberships WHERE workspace_id = ? ORDER BY created_at ASC").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, default_tax_method AS defaultTaxMethod, option2_available AS option2Available, updated_at AS updatedAt, updated_by AS updatedBy FROM employer_payroll_settings WHERE workspace_id = ? LIMIT 1").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, payroll_account_id AS payrollAccountId, name, frequency, periods_per_year AS periodsPerYear, next_run_number AS nextRunNumber, next_period_start AS nextPeriodStart, next_period_end AS nextPeriodEnd, next_pay_date AS nextPayDate, status FROM pay_schedules WHERE workspace_id = ? ORDER BY id").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT p.id, p.employee_id AS employeeId, e.legal_name AS employeeName, e.pay_type AS payType, p.tax_method AS taxMethod, p.salary_periodic_cents AS salaryPeriodicCents, p.hourly_rate_cents AS hourlyRateCents, p.standard_hours_hundredths AS standardHoursHundredths, p.federal_claim_cents AS federalClaimCents, p.alberta_claim_cents AS albertaClaimCents, p.additional_tax_cents AS additionalTaxCents, p.cpp_exempt AS cppExempt, p.ei_exempt AS eiExempt, p.effective_from AS effectiveFrom, COALESCE(SUM(l.taxable_earnings_cents), 0) AS ytdTaxableEarningsCents, COALESCE(SUM(l.pensionable_earnings_cents), 0) AS ytdPensionableEarningsCents, COALESCE(SUM(l.income_tax_cents), 0) AS ytdIncomeTaxCents, COALESCE(SUM(l.cpp_cents), 0) AS ytdCppCents, COALESCE(SUM(l.cpp2_cents), 0) AS ytdCpp2Cents, COALESCE(SUM(l.ei_cents), 0) AS ytdEiCents FROM employee_payroll_profiles p JOIN employees e ON e.id = p.employee_id LEFT JOIN statutory_ledger_entries l ON l.employee_id = p.employee_id AND l.workspace_id = p.workspace_id AND l.tax_year = 2026 WHERE p.workspace_id = ? GROUP BY p.id, p.employee_id, e.legal_name, e.pay_type, p.tax_method, p.salary_periodic_cents, p.hourly_rate_cents, p.standard_hours_hundredths, p.federal_claim_cents, p.alberta_claim_cents, p.additional_tax_cents, p.cpp_exempt, p.ei_exempt, p.effective_from ORDER BY e.legal_name").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, code, name, type, calculation_mode AS calculationMode, taxable, pensionable, insurable, status, created_at AS createdAt, created_by AS createdBy FROM payroll_codes WHERE workspace_id = ? ORDER BY type DESC, code ASC").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT r.id, r.employee_id AS employeeId, e.legal_name AS employeeName, r.payroll_code_id AS payrollCodeId, c.code, c.name AS codeName, c.type, r.amount_cents AS amountCents, r.effective_from AS effectiveFrom, r.effective_to AS effectiveTo, r.status, r.created_at AS createdAt, r.created_by AS createdBy FROM employee_recurring_pay_items r JOIN employees e ON e.id = r.employee_id JOIN payroll_codes c ON c.id = r.payroll_code_id WHERE r.workspace_id = ? ORDER BY e.legal_name, c.code, r.effective_from DESC").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, payroll_account_id AS payrollAccountId, payroll_year AS payrollYear, run_number AS runNumber, period_start AS periodStart, period_end AS periodEnd, pay_date AS payDate, status, tax_method AS taxMethod, ruleset_version AS rulesetVersion, gross_cents AS grossCents, net_cents AS netCents, employee_payment_count AS employeePaymentCount, approved_at AS approvedAt, approved_by AS approvedBy FROM pay_runs WHERE workspace_id = ? ORDER BY payroll_year DESC, run_number DESC").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, pay_run_id AS payRunId, output_type AS outputType, status, item_count AS itemCount, control_total_cents AS controlTotalCents, reference, created_at AS createdAt FROM pay_run_outputs WHERE workspace_id = ? ORDER BY created_at DESC, output_type ASC").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, pay_run_id AS payRunId, event_type AS eventType, quantity, unit_price_cents AS unitPriceCents, total_cents AS totalCents, idempotency_key AS idempotencyKey, occurred_at AS occurredAt FROM billing_events WHERE workspace_id = ? ORDER BY occurred_at DESC").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, payroll_account_id AS payrollAccountId, payroll_year AS payrollYear, run_number AS runNumber, period_start AS periodStart, period_end AS periodEnd, pay_date AS payDate, status, tax_method AS taxMethod, ruleset_version AS rulesetVersion, gross_cents AS grossCents, net_cents AS netCents, blocking_exception_count AS blockingExceptionCount, updated_at AS updatedAt, updated_by AS updatedBy FROM pay_run_drafts WHERE workspace_id = ? AND status != 'Approved' ORDER BY payroll_year DESC, run_number DESC LIMIT 1").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, draft_id AS draftId, employee_id AS employeeId, employee_name AS employeeName, pay_type AS payType, regular_hours_hundredths AS regularHoursHundredths, overtime_hours_hundredths AS overtimeHoursHundredths, other_earnings_cents AS otherEarningsCents, other_deductions_cents AS otherDeductionsCents, gross_cents AS grossCents, income_tax_cents AS incomeTaxCents, cpp_cents AS cppCents, cpp2_cents AS cpp2Cents, ei_cents AS eiCents, net_pay_cents AS netPayCents, exceptions_json AS exceptionsJson FROM pay_run_draft_lines WHERE workspace_id = ? ORDER BY employee_name ASC").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, draft_id AS draftId, employee_id AS employeeId, category, code, description, quantity_hundredths AS quantityHundredths, rate_cents AS rateCents, amount_cents AS amountCents, display_order AS displayOrder FROM pay_run_draft_components WHERE workspace_id = ? ORDER BY employee_id, display_order").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, draft_id AS draftId, check_code AS checkCode, title, status, severity, summary, evidence_json AS evidenceJson, reviewed_at AS reviewedAt, reviewed_by AS reviewedBy, updated_at AS updatedAt FROM pay_run_compliance_checks WHERE workspace_id = ? ORDER BY check_code").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, pay_run_id AS payRunId, employee_id AS employeeId, employee_name AS employeeName, gross_cents AS grossCents, income_tax_cents AS incomeTaxCents, cpp_cents AS cppCents, cpp2_cents AS cpp2Cents, ei_cents AS eiCents, other_deductions_cents AS otherDeductionsCents, net_pay_cents AS netPayCents FROM pay_run_payments WHERE workspace_id = ? ORDER BY pay_run_id DESC, employee_name").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, pay_run_id AS payRunId, employee_id AS employeeId, category, code, description, quantity_hundredths AS quantityHundredths, rate_cents AS rateCents, amount_cents AS amountCents, display_order AS displayOrder FROM pay_run_payment_components WHERE workspace_id = ? ORDER BY pay_run_id DESC, employee_id, display_order").bind(WORKSPACE_ID).all(),
    db.prepare("SELECT id, occurred_at AS occurredAt, actor_email AS actorEmail, action, entity_type AS entityType, entity_id AS entityId, summary FROM audit_events WHERE workspace_id = ? ORDER BY occurred_at DESC LIMIT 100").bind(WORKSPACE_ID).all(),
  ]);
  const activeDraft = activeDrafts.results[0] ?? null;
  return { actorRole: actor.role, accounts: accounts.results, employees: employees.results, offboarding: offboarding.results, memberships: memberships.results, payrollSettings: payrollSettings.results[0] ?? null, schedules: schedules.results, payrollProfiles: payrollProfiles.results, payrollCodes: payrollCodes.results, recurringPayItems: recurringPayItems.results, payRuns: payRuns.results, outputs: outputs.results, billing: billing.results, activeDraft, draftLines: activeDraft ? draftLines.results.filter((line) => line.draftId === activeDraft.id) : [], draftComponents: activeDraft ? draftComponents.results.filter((item) => item.draftId === activeDraft.id) : [], complianceChecks: activeDraft ? complianceChecks.results.filter((item) => item.draftId === activeDraft.id) : [], payments: payments.results, paymentComponents: paymentComponents.results, audit: audit.results };
}

function controlledInteger(value: number, label: string, maximum: number) {
  if (!Number.isInteger(value) || value < 0 || value > maximum) throw new Error(`${label} is outside the supported range.`);
  return value;
}

type CalculationProfile = { employeeId: string; employeeName: string; payType: string; taxMethod: string; salaryPeriodicCents: number; hourlyRateCents: number; federalClaimCents: number; albertaClaimCents: number; additionalTaxCents: number; cppExempt: number; eiExempt: number; ytdPensionableEarningsCents: number; ytdCppCents: number; ytdCpp2Cents: number; ytdEiCents: number };

function calculateDraftLine(input: { employeeId: string; regularHoursHundredths: number; overtimeHoursHundredths: number; otherEarningsCents: number; otherDeductionsCents: number }, payDate: string, periodsRemainingIncludingCurrent: number, profile: CalculationProfile) {
  const regularHoursHundredths = controlledInteger(input.regularHoursHundredths, `${profile.employeeName} regular hours`, 20_000);
  const overtimeHoursHundredths = controlledInteger(input.overtimeHoursHundredths, `${profile.employeeName} overtime hours`, 10_000);
  const otherEarningsCents = controlledInteger(input.otherEarningsCents, `${profile.employeeName} other earnings`, 2_000_000);
  const otherDeductionsCents = controlledInteger(input.otherDeductionsCents, `${profile.employeeName} other deductions`, 2_000_000);
  const exceptions: string[] = [];
  if (profile.payType === "Hourly" && regularHoursHundredths === 0) exceptions.push("BLOCKING: Regular hours are required for an hourly employee.");
  if (regularHoursHundredths + overtimeHoursHundredths > 12_000) exceptions.push("BLOCKING: Total hours exceed the 120-hour review limit.");
  if (overtimeHoursHundredths > 2_400) exceptions.push("REVIEW: Overtime exceeds 24 hours.");
  if (profile.payType === "Salary" && overtimeHoursHundredths > 0) exceptions.push("BLOCKING: Salary overtime requires a separately configured earning rule.");
  if (otherEarningsCents >= 500_000) exceptions.push("REVIEW: Additional earnings are $5,000 or more.");
  if (profile.taxMethod !== OPTION_1) exceptions.push("BLOCKING: This tax method does not yet have a validated calculation path.");

  const regularEarningsCents = profile.payType === "Salary" ? profile.salaryPeriodicCents : Math.round((profile.hourlyRateCents * regularHoursHundredths) / 100);
  const overtimeEarningsCents = profile.payType === "Hourly" ? Math.round((profile.hourlyRateCents * 3 * overtimeHoursHundredths) / 200) : 0;
  const grossCents = regularEarningsCents + overtimeEarningsCents + otherEarningsCents;
  try {
    const result = calculateAlbertaPayroll({
      payDate,
      province: "AB",
      incomePath: "regular-periodic",
      payPeriodsPerYear: 26,
      periodsRemainingIncludingCurrent,
      cashEarningsCents: grossCents,
      otherAfterTaxDeductionsCents: otherDeductionsCents,
      federalClaimCents: profile.federalClaimCents,
      albertaClaimCents: profile.albertaClaimCents,
      additionalTaxCents: profile.additionalTaxCents,
      cppExempt: Boolean(profile.cppExempt),
      eiExempt: Boolean(profile.eiExempt),
      yearToDate: { pensionableEarningsCents: profile.ytdPensionableEarningsCents, cppCents: profile.ytdCppCents, cpp2Cents: profile.ytdCpp2Cents, eiCents: profile.ytdEiCents },
    });
    return {
      ...input,
      regularHoursHundredths,
      overtimeHoursHundredths,
      otherEarningsCents,
      otherDeductionsCents,
      employeeName: profile.employeeName,
      payType: profile.payType,
      grossCents,
      regularEarningsCents,
      overtimeEarningsCents,
      incomeTaxCents: result.deductions.incomeTaxCents,
      cppCents: result.deductions.cppCents,
      cpp2Cents: result.deductions.cpp2Cents,
      eiCents: result.deductions.eiCents,
      netPayCents: result.netPayCents,
      exceptions,
    };
  } catch (problem) {
    exceptions.push(`BLOCKING: ${problem instanceof Error ? problem.message : "Payroll calculation failed."}`);
    return { ...input, regularHoursHundredths, overtimeHoursHundredths, otherEarningsCents, otherDeductionsCents, employeeName: profile.employeeName, payType: profile.payType, regularEarningsCents, overtimeEarningsCents, grossCents, incomeTaxCents: 0, cppCents: 0, cpp2Cents: 0, eiCents: 0, netPayCents: grossCents, exceptions };
  }
}

export async function GET() {
  const actor = await getComcheqActor();
  if (!actor) return Response.json({ error: "Employer membership required." }, { status: 401 });
  return Response.json(await state(actor));
}

export async function POST(request: Request) {
  const actor = await getComcheqActor();
  if (!actor) return Response.json({ error: "Employer membership required." }, { status: 401 });
  const body = await request.json() as AdminAction;
  const db = database();
  const occurredAt = new Date().toISOString();
  if (actor.role === "Administrator") await ensureFictionalWorkspace(actor.email);

  if (body.action === "create_account") {
    if (actor.role !== "Administrator") return Response.json({ error: "Administrator role required." }, { status: 403 });
    const suffix = body.rpSuffix.replace(/\D/g, "").padStart(4, "0").slice(-4);
    if (!body.legalEntity.trim() || suffix.length !== 4) return Response.json({ error: "Legal entity and four-digit RP suffix are required." }, { status: 400 });
    const id = `PA-${crypto.randomUUID()}`;
    const programAccount = `********* RP${suffix}`;
    await db.batch([
      db.prepare("INSERT INTO payroll_accounts (id, workspace_id, program_account_masked, remitter_type, status, employee_count, next_run, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, WORKSPACE_ID, programAccount, body.remitterType, "Draft", 0, "Not scheduled", occurredAt, actor.email),
      db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`AE-${crypto.randomUUID()}`, WORKSPACE_ID, occurredAt, actor.email, "payroll_account.created", "payroll_account", id, `${programAccount} draft created`, JSON.stringify({ legalEntity: body.legalEntity, remitterType: body.remitterType })),
    ]);
    return Response.json({ ok: true, id });
  }

  if (body.action === "save_offboarding") {
    if (actor.role === "Read-only") return Response.json({ error: "Payroll Processor or Administrator role required." }, { status: 403 });
    if (!body.employeeName.trim() || !body.lastDay) return Response.json({ error: "Employee and last day are required." }, { status: 400 });
    const id = `OD-${body.employeeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
    await db.batch([
      db.prepare("INSERT INTO offboarding_drafts (id, workspace_id, employee_id, employee_name, reason_code, last_day, final_pay_method, status, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET employee_id = excluded.employee_id, reason_code = excluded.reason_code, last_day = excluded.last_day, final_pay_method = excluded.final_pay_method, status = excluded.status, updated_at = excluded.updated_at, updated_by = excluded.updated_by").bind(id, WORKSPACE_ID, body.employeeId, body.employeeName, body.reasonCode, body.lastDay, body.finalPayMethod, "Draft", occurredAt, actor.email),
      db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`AE-${crypto.randomUUID()}`, WORKSPACE_ID, occurredAt, actor.email, "offboarding_draft.saved", "offboarding_draft", id, `${body.employeeName} offboarding draft saved`, JSON.stringify({ employeeId: body.employeeId, reasonCode: body.reasonCode, lastDay: body.lastDay, finalPayMethod: body.finalPayMethod })),
    ]);
    return Response.json({ ok: true, id });
  }

  if (body.action === "create_membership") {
    if (actor.role !== "Administrator") return Response.json({ error: "Administrator role required." }, { status: 403 });
    const email = body.email.trim().toLowerCase();
    if (!email || !body.displayName.trim() || !["Administrator", "Payroll Processor", "Read-only"].includes(body.role)) return Response.json({ error: "Name, email and a valid role are required." }, { status: 400 });
    const id = `MEM-${crypto.randomUUID()}`;
    await db.batch([
      db.prepare("INSERT INTO employer_memberships (id, workspace_id, email, display_name, role, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, WORKSPACE_ID, email, body.displayName.trim(), body.role, "Active", occurredAt, actor.email),
      db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`AE-${crypto.randomUUID()}`, WORKSPACE_ID, occurredAt, actor.email, "membership.created", "membership", id, `${body.displayName.trim()} added as ${body.role}`, JSON.stringify({ email, role: body.role })),
    ]);
    return Response.json({ ok: true, id });
  }

  if (body.action === "update_default_tax_method") {
    if (actor.role !== "Administrator") return Response.json({ error: "Administrator role required." }, { status: 403 });
    const settings = await db.prepare("SELECT default_tax_method AS defaultTaxMethod, option2_available AS option2Available FROM employer_payroll_settings WHERE workspace_id = ? LIMIT 1").bind(WORKSPACE_ID).first<{ defaultTaxMethod: string; option2Available: number }>();
    if (!settings) return Response.json({ error: "Employer payroll settings were not found." }, { status: 404 });
    if (body.taxMethod !== OPTION_1 && !(body.taxMethod === OPTION_2 && settings.option2Available)) return Response.json({ error: "Option 2 remains unavailable until its cumulative calculation path is validated." }, { status: 409 });
    const active = await db.prepare("SELECT status FROM pay_run_drafts WHERE workspace_id = ? AND status IN ('Calculated', 'Reviewed') LIMIT 1").bind(WORKSPACE_ID).first<{ status: string }>();
    if (active && body.taxMethod !== settings.defaultTaxMethod) return Response.json({ error: "Complete or recalculate the active pay run before changing the default tax method." }, { status: 409 });
    await db.batch([
      db.prepare("UPDATE employer_payroll_settings SET default_tax_method = ?, updated_at = ?, updated_by = ? WHERE workspace_id = ?").bind(body.taxMethod, occurredAt, actor.email, WORKSPACE_ID),
      db.prepare("UPDATE employee_payroll_profiles SET tax_method = ?, updated_at = ?, updated_by = ? WHERE workspace_id = ?").bind(body.taxMethod, occurredAt, actor.email, WORKSPACE_ID),
      db.prepare("UPDATE pay_run_drafts SET tax_method = ?, updated_at = ?, updated_by = ? WHERE workspace_id = ? AND status = 'Draft'").bind(body.taxMethod, occurredAt, actor.email, WORKSPACE_ID),
      db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`AE-${crypto.randomUUID()}`, WORKSPACE_ID, occurredAt, actor.email, "payroll_settings.tax_method_updated", "employer_payroll_settings", "EPS-PNS-001", `Default tax method confirmed as ${body.taxMethod}`, JSON.stringify({ before: settings.defaultTaxMethod, after: body.taxMethod, option2Available: Boolean(settings.option2Available) })),
    ]);
    return Response.json({ ok: true, taxMethod: body.taxMethod });
  }

  if (body.action === "update_employee_payroll_profile") {
    if (actor.role !== "Administrator") return Response.json({ error: "Administrator role required." }, { status: 403 });
    if (!/^2026-\d{2}-\d{2}$/.test(body.effectiveFrom)) return Response.json({ error: "The effective date must be a valid 2026 date." }, { status: 400 });
    try {
      const salaryPeriodicCents = controlledInteger(body.salaryPeriodicCents, "Periodic salary", 10_000_000);
      const hourlyRateCents = controlledInteger(body.hourlyRateCents, "Hourly rate", 100_000);
      const standardHoursHundredths = controlledInteger(body.standardHoursHundredths, "Standard hours", 20_000);
      const federalClaimCents = controlledInteger(body.federalClaimCents, "Federal claim amount", 20_000_000);
      const albertaClaimCents = controlledInteger(body.albertaClaimCents, "Alberta claim amount", 20_000_000);
      const additionalTaxCents = controlledInteger(body.additionalTaxCents, "Additional tax", 1_000_000);
      const current = await db.prepare("SELECT p.id, p.pay_schedule_id AS payScheduleId, p.tax_method AS taxMethod, p.salary_periodic_cents AS salaryPeriodicCents, p.hourly_rate_cents AS hourlyRateCents, p.standard_hours_hundredths AS standardHoursHundredths, p.federal_claim_cents AS federalClaimCents, p.alberta_claim_cents AS albertaClaimCents, p.additional_tax_cents AS additionalTaxCents, p.cpp_exempt AS cppExempt, p.ei_exempt AS eiExempt, p.effective_from AS effectiveFrom, e.legal_name AS employeeName, e.pay_type AS payType FROM employee_payroll_profiles p JOIN employees e ON e.id = p.employee_id WHERE p.workspace_id = ? AND p.employee_id = ? LIMIT 1").bind(WORKSPACE_ID, body.employeeId).first<{ id: string; payScheduleId: string; taxMethod: string; salaryPeriodicCents: number; hourlyRateCents: number; standardHoursHundredths: number; federalClaimCents: number; albertaClaimCents: number; additionalTaxCents: number; cppExempt: number; eiExempt: number; effectiveFrom: string; employeeName: string; payType: string }>();
      if (!current) return Response.json({ error: "The employee payroll profile was not found." }, { status: 404 });
      if (body.effectiveFrom < current.effectiveFrom) return Response.json({ error: `The effective date cannot precede the current profile date of ${current.effectiveFrom}.` }, { status: 409 });
      if (current.payType === "Salary" && (salaryPeriodicCents <= 0 || hourlyRateCents !== 0)) return Response.json({ error: "A salaried employee requires a positive periodic salary and no hourly rate." }, { status: 400 });
      if (current.payType === "Hourly" && (hourlyRateCents <= 0 || salaryPeriodicCents !== 0)) return Response.json({ error: "An hourly employee requires a positive hourly rate and no periodic salary." }, { status: 400 });
      const active = await db.prepare("SELECT status, pay_date AS payDate FROM pay_run_drafts WHERE workspace_id = ? AND status IN ('Calculated', 'Reviewed') ORDER BY run_number DESC LIMIT 1").bind(WORKSPACE_ID).first<{ status: string; payDate: string }>();
      if (active && body.effectiveFrom <= active.payDate) return Response.json({ error: "Complete the calculated or reviewed pay run before applying a profile change effective on or before its pay date." }, { status: 409 });
      const after = { salaryPeriodicCents, hourlyRateCents, standardHoursHundredths, federalClaimCents, albertaClaimCents, additionalTaxCents, cppExempt: Boolean(body.cppExempt), eiExempt: Boolean(body.eiExempt), effectiveFrom: body.effectiveFrom };
      await db.batch([
        db.prepare("UPDATE employee_payroll_profiles SET salary_periodic_cents = ?, hourly_rate_cents = ?, standard_hours_hundredths = ?, federal_claim_cents = ?, alberta_claim_cents = ?, additional_tax_cents = ?, cpp_exempt = ?, ei_exempt = ?, effective_from = ?, updated_at = ?, updated_by = ? WHERE workspace_id = ? AND employee_id = ?").bind(salaryPeriodicCents, hourlyRateCents, standardHoursHundredths, federalClaimCents, albertaClaimCents, additionalTaxCents, body.cppExempt ? 1 : 0, body.eiExempt ? 1 : 0, body.effectiveFrom, occurredAt, actor.email, WORKSPACE_ID, body.employeeId),
        db.prepare("INSERT INTO employee_payroll_profile_versions (id, workspace_id, employee_id, pay_schedule_id, tax_method, salary_periodic_cents, hourly_rate_cents, standard_hours_hundredths, federal_claim_cents, alberta_claim_cents, additional_tax_cents, cpp_exempt, ei_exempt, effective_from, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`EPPV-${crypto.randomUUID()}`, WORKSPACE_ID, body.employeeId, current.payScheduleId, current.taxMethod, salaryPeriodicCents, hourlyRateCents, standardHoursHundredths, federalClaimCents, albertaClaimCents, additionalTaxCents, body.cppExempt ? 1 : 0, body.eiExempt ? 1 : 0, body.effectiveFrom, occurredAt, actor.email),
        db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`AE-${crypto.randomUUID()}`, WORKSPACE_ID, occurredAt, actor.email, "employee_payroll_profile.updated", "employee_payroll_profile", current.id, `${current.employeeName} payroll profile updated effective ${body.effectiveFrom}`, JSON.stringify({ before: current, after })),
      ]);
      return Response.json({ ok: true, id: current.id, effectiveFrom: body.effectiveFrom });
    } catch (problem) {
      return Response.json({ error: problem instanceof Error ? problem.message : "The employee payroll profile could not be saved." }, { status: 400 });
    }
  }

  if (body.action === "create_payroll_code") {
    if (actor.role !== "Administrator") return Response.json({ error: "Administrator role required." }, { status: 403 });
    const code = body.code.trim().toUpperCase();
    const name = body.name.trim();
    if (!/^[A-Z][A-Z0-9_]{1,11}$/.test(code)) return Response.json({ error: "Use a 2–12 character code beginning with a letter." }, { status: 400 });
    if (name.length < 3 || name.length > 60 || !["Earning", "Deduction"].includes(body.type)) return Response.json({ error: "A valid code name and type are required." }, { status: 400 });
    const existing = await db.prepare("SELECT id FROM payroll_codes WHERE workspace_id = ? AND code = ? LIMIT 1").bind(WORKSPACE_ID, code).first<{ id: string }>();
    if (existing) return Response.json({ error: `${code} already exists in this employer catalogue.` }, { status: 409 });
    const id = `PC-${crypto.randomUUID()}`;
    await db.batch([
      db.prepare("INSERT INTO payroll_codes (id, workspace_id, code, name, type, calculation_mode, taxable, pensionable, insurable, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, WORKSPACE_ID, code, name, body.type, "Fixed amount", body.taxable ? 1 : 0, body.pensionable ? 1 : 0, body.insurable ? 1 : 0, "Active", occurredAt, actor.email),
      db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`AE-${crypto.randomUUID()}`, WORKSPACE_ID, occurredAt, actor.email, "payroll_code.created", "payroll_code", id, `${code} ${body.type.toLowerCase()} code created`, JSON.stringify({ code, name, type: body.type, calculationMode: "Fixed amount", taxable: body.taxable, pensionable: body.pensionable, insurable: body.insurable })),
    ]);
    return Response.json({ ok: true, id });
  }

  if (body.action === "assign_recurring_pay_item") {
    if (actor.role !== "Administrator") return Response.json({ error: "Administrator role required." }, { status: 403 });
    if (!/^2026-\d{2}-\d{2}$/.test(body.effectiveFrom) || (body.effectiveTo && !/^2026-\d{2}-\d{2}$/.test(body.effectiveTo))) return Response.json({ error: "Effective dates must be valid 2026 dates." }, { status: 400 });
    if (body.effectiveTo && body.effectiveTo < body.effectiveFrom) return Response.json({ error: "The end date cannot precede the start date." }, { status: 400 });
    try {
      const amountCents = controlledInteger(body.amountCents, "Recurring amount", 2_000_000);
      if (amountCents === 0) return Response.json({ error: "The recurring amount must be greater than zero." }, { status: 400 });
      const record = await db.prepare("SELECT e.legal_name AS employeeName, c.code, c.name AS codeName, c.type, c.taxable, c.pensionable, c.insurable FROM employees e CROSS JOIN payroll_codes c WHERE e.workspace_id = ? AND e.id = ? AND e.status = 'Active' AND c.workspace_id = ? AND c.id = ? AND c.status = 'Active' LIMIT 1").bind(WORKSPACE_ID, body.employeeId, WORKSPACE_ID, body.payrollCodeId).first<{ employeeName: string; code: string; codeName: string; type: string; taxable: number; pensionable: number; insurable: number }>();
      if (!record) return Response.json({ error: "An active fictional employee and payroll code are required." }, { status: 404 });
      if (record.type === "Earning" && !(record.taxable && record.pensionable && record.insurable)) return Response.json({ error: "The current calculation path only accepts recurring earnings that are taxable, pensionable and insurable." }, { status: 409 });
      if (record.type === "Deduction" && (record.taxable || record.pensionable || record.insurable)) return Response.json({ error: "The current calculation path only accepts recurring after-tax deductions." }, { status: 409 });
      const activeDraft = await db.prepare("SELECT status, pay_date AS payDate FROM pay_run_drafts WHERE workspace_id = ? AND status IN ('Calculated', 'Reviewed') ORDER BY run_number DESC LIMIT 1").bind(WORKSPACE_ID).first<{ status: string; payDate: string }>();
      if (activeDraft && body.effectiveFrom <= activeDraft.payDate) return Response.json({ error: "Complete the calculated or reviewed pay run before assigning an item effective on or before its pay date." }, { status: 409 });
      const overlapping = await db.prepare("SELECT id FROM employee_recurring_pay_items WHERE workspace_id = ? AND employee_id = ? AND payroll_code_id = ? AND status = 'Active' AND effective_from <= COALESCE(?, '9999-12-31') AND COALESCE(effective_to, '9999-12-31') >= ? LIMIT 1").bind(WORKSPACE_ID, body.employeeId, body.payrollCodeId, body.effectiveTo, body.effectiveFrom).first<{ id: string }>();
      if (overlapping) return Response.json({ error: `${record.code} already has an overlapping active assignment for ${record.employeeName}.` }, { status: 409 });
      const id = `RPI-${crypto.randomUUID()}`;
      await db.batch([
        db.prepare("INSERT INTO employee_recurring_pay_items (id, workspace_id, employee_id, payroll_code_id, amount_cents, effective_from, effective_to, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, WORKSPACE_ID, body.employeeId, body.payrollCodeId, amountCents, body.effectiveFrom, body.effectiveTo || null, "Active", occurredAt, actor.email),
        db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`AE-${crypto.randomUUID()}`, WORKSPACE_ID, occurredAt, actor.email, "recurring_pay_item.assigned", "employee_recurring_pay_item", id, `${record.code} assigned to ${record.employeeName} effective ${body.effectiveFrom}`, JSON.stringify({ employeeId: body.employeeId, payrollCodeId: body.payrollCodeId, code: record.code, type: record.type, amountCents, effectiveFrom: body.effectiveFrom, effectiveTo: body.effectiveTo || null })),
      ]);
      return Response.json({ ok: true, id });
    } catch (problem) {
      return Response.json({ error: problem instanceof Error ? problem.message : "The recurring pay item could not be assigned." }, { status: 400 });
    }
  }

  if (body.action === "calculate_draft") {
    if (actor.role === "Read-only") return Response.json({ error: "Payroll Processor or Administrator role required." }, { status: 403 });
    const draft = await db.prepare("SELECT id, status, period_start AS periodStart, period_end AS periodEnd, pay_date AS payDate, run_number AS runNumber FROM pay_run_drafts WHERE id = ? AND workspace_id = ? LIMIT 1").bind(body.draftId, WORKSPACE_ID).first<{ id: string; status: string; periodStart: string; periodEnd: string; payDate: string; runNumber: number }>();
    if (!draft || draft.status === "Approved") return Response.json({ error: "An editable pay-run draft was not found." }, { status: 409 });
    if (!Array.isArray(body.lines) || body.lines.length !== Object.keys(DEMO_PROFILES).length || new Set(body.lines.map((line) => line.employeeId)).size !== Object.keys(DEMO_PROFILES).length) {
      return Response.json({ error: "All four fictional employees must be included exactly once." }, { status: 400 });
    }
    try {
      const profileResult = await db.prepare("SELECT p.employee_id AS employeeId, e.legal_name AS employeeName, e.pay_type AS payType, p.tax_method AS taxMethod, p.salary_periodic_cents AS salaryPeriodicCents, p.hourly_rate_cents AS hourlyRateCents, p.federal_claim_cents AS federalClaimCents, p.alberta_claim_cents AS albertaClaimCents, p.additional_tax_cents AS additionalTaxCents, p.cpp_exempt AS cppExempt, p.ei_exempt AS eiExempt, COALESCE(SUM(l.pensionable_earnings_cents), 0) AS ytdPensionableEarningsCents, COALESCE(SUM(l.cpp_cents), 0) AS ytdCppCents, COALESCE(SUM(l.cpp2_cents), 0) AS ytdCpp2Cents, COALESCE(SUM(l.ei_cents), 0) AS ytdEiCents FROM employee_payroll_profile_versions p JOIN employees e ON e.id = p.employee_id LEFT JOIN statutory_ledger_entries l ON l.employee_id = p.employee_id AND l.workspace_id = p.workspace_id AND l.tax_year = 2026 WHERE p.workspace_id = ? AND p.id = (SELECT p2.id FROM employee_payroll_profile_versions p2 WHERE p2.workspace_id = p.workspace_id AND p2.employee_id = p.employee_id AND p2.effective_from <= ? ORDER BY p2.effective_from DESC, p2.created_at DESC LIMIT 1) GROUP BY p.employee_id, e.legal_name, e.pay_type, p.tax_method, p.salary_periodic_cents, p.hourly_rate_cents, p.federal_claim_cents, p.alberta_claim_cents, p.additional_tax_cents, p.cpp_exempt, p.ei_exempt").bind(WORKSPACE_ID, draft.payDate).all<CalculationProfile>();
      const recurringResult = await db.prepare("SELECT r.employee_id AS employeeId, c.code, c.name AS description, c.type AS category, r.amount_cents AS amountCents FROM employee_recurring_pay_items r JOIN payroll_codes c ON c.id = r.payroll_code_id WHERE r.workspace_id = ? AND r.status = 'Active' AND c.status = 'Active' AND r.effective_from <= ? AND (r.effective_to IS NULL OR r.effective_to >= ?) ORDER BY r.employee_id, c.type DESC, c.code").bind(WORKSPACE_ID, draft.payDate, draft.payDate).all<{ employeeId: string; code: string; description: string; category: "Earning" | "Deduction"; amountCents: number }>();
      const profileMap = new Map(profileResult.results.map((profile) => [profile.employeeId, profile]));
      const calculated = body.lines.map((line) => {
        const profile = profileMap.get(line.employeeId);
        if (!profile) throw new Error("Every draft employee requires an effective payroll profile.");
        const result = calculateDraftLine(line, draft.payDate, Math.max(1, 26 - draft.runNumber + 1), profile);
        const assigned = recurringResult.results.filter((item) => item.employeeId === line.employeeId);
        const recurringEarningsCents = assigned.filter((item) => item.category === "Earning").reduce((sum, item) => sum + item.amountCents, 0);
        const recurringDeductionsCents = assigned.filter((item) => item.category === "Deduction").reduce((sum, item) => sum + item.amountCents, 0);
        if (result.otherEarningsCents < recurringEarningsCents) result.exceptions.push("BLOCKING: Other earnings cannot be less than assigned recurring earnings.");
        if (result.otherDeductionsCents < recurringDeductionsCents) result.exceptions.push("BLOCKING: Other deductions cannot be less than assigned recurring deductions.");
        return { ...result, assigned, recurringEarningsCents, recurringDeductionsCents };
      });
      const grossCents = calculated.reduce((sum, line) => sum + line.grossCents, 0);
      const netCents = calculated.reduce((sum, line) => sum + line.netPayCents, 0);
      const blockingExceptionCount = calculated.reduce((sum, line) => sum + line.exceptions.filter((item) => item.startsWith("BLOCKING:")).length, 0);
      const components = calculated.flatMap((line) => {
        const items: Array<{ category: "Earning" | "Deduction"; code: string; description: string; quantityHundredths: number | null; rateCents: number | null; amountCents: number }> = [];
        const profile = profileMap.get(line.employeeId)!;
        items.push({ category: "Earning", code: line.payType === "Salary" ? "SALARY" : "REG", description: line.payType === "Salary" ? "Regular salary" : "Regular wages", quantityHundredths: line.payType === "Hourly" ? line.regularHoursHundredths : null, rateCents: line.payType === "Hourly" ? profile.hourlyRateCents : null, amountCents: line.regularEarningsCents });
        if (line.overtimeEarningsCents > 0) items.push({ category: "Earning", code: "OT15", description: "Overtime at 1.5×", quantityHundredths: line.overtimeHoursHundredths, rateCents: Math.round(profile.hourlyRateCents * 1.5), amountCents: line.overtimeEarningsCents });
        for (const item of line.assigned.filter((item) => item.category === "Earning")) items.push({ category: "Earning", code: item.code, description: item.description, quantityHundredths: null, rateCents: null, amountCents: item.amountCents });
        const manualEarnings = line.otherEarningsCents - line.recurringEarningsCents;
        if (manualEarnings > 0) items.push({ category: "Earning", code: "OTHER", description: "Other current-period earnings", quantityHundredths: null, rateCents: null, amountCents: manualEarnings });
        items.push({ category: "Deduction", code: "TAX", description: "Income tax", quantityHundredths: null, rateCents: null, amountCents: line.incomeTaxCents });
        items.push({ category: "Deduction", code: "CPP", description: "Canada Pension Plan", quantityHundredths: null, rateCents: null, amountCents: line.cppCents });
        if (line.cpp2Cents > 0) items.push({ category: "Deduction", code: "CPP2", description: "Second additional CPP", quantityHundredths: null, rateCents: null, amountCents: line.cpp2Cents });
        items.push({ category: "Deduction", code: "EI", description: "Employment Insurance", quantityHundredths: null, rateCents: null, amountCents: line.eiCents });
        for (const item of line.assigned.filter((item) => item.category === "Deduction")) items.push({ category: "Deduction", code: item.code, description: item.description, quantityHundredths: null, rateCents: null, amountCents: item.amountCents });
        const manualDeductions = line.otherDeductionsCents - line.recurringDeductionsCents;
        if (manualDeductions > 0) items.push({ category: "Deduction", code: "OTHER", description: "Other authorized deduction", quantityHundredths: null, rateCents: null, amountCents: manualDeductions });
        return items.map((item, index) => ({ ...item, employeeId: line.employeeId, displayOrder: index + 1 }));
      });
      const payTimingDays = Math.round((Date.parse(`${draft.payDate}T00:00:00Z`) - Date.parse(`${draft.periodEnd}T00:00:00Z`)) / 86_400_000);
      const holidays = ALBERTA_GENERAL_HOLIDAYS_2026.filter(([date]) => date >= draft.periodStart && date <= draft.periodEnd);
      const hasHourlyEmployees = calculated.some((line) => line.payType === "Hourly");
      const checks = [
        { code: "AB_PAY_TIMING", title: "Pay-period timing", status: payTimingDays >= 0 && payTimingDays <= 10 ? "Passed" : "Blocked", severity: payTimingDays >= 0 && payTimingDays <= 10 ? "Info" : "Blocking", summary: payTimingDays >= 0 && payTimingDays <= 10 ? `Pay date is ${payTimingDays} days after period end, within Alberta’s 10-day limit.` : "Pay date falls outside Alberta’s permitted pay-period timing.", evidence: { periodEnd: draft.periodEnd, payDate: draft.payDate, daysAfterPeriodEnd: payTimingDays } },
        { code: "AB_OVERTIME_8_44", title: "Overtime 8/44 review", status: hasHourlyEmployees ? "Review required" : "Not applicable", severity: hasHourlyEmployees ? "Review" : "Info", summary: hasHourlyEmployees ? "Confirm hourly overtime was determined from daily and work-week records using the greater of daily or weekly overtime, including any exemption or written arrangement." : "No hourly employees are included in this run.", evidence: { hourlyEmployees: calculated.filter((line) => line.payType === "Hourly").map((line) => ({ employeeId: line.employeeId, regularHoursHundredths: line.regularHoursHundredths, overtimeHoursHundredths: line.overtimeHoursHundredths })), overtimeRateMultiplier: 1.5 } },
        { code: "AB_GENERAL_HOLIDAY", title: "General holiday review", status: holidays.length ? "Review required" : "Not applicable", severity: holidays.length ? "Review" : "Info", summary: holidays.length ? `Confirm eligibility and holiday treatment for ${holidays.map(([, name]) => name).join(", ")}.` : "No Alberta general holiday falls within this pay period.", evidence: { holidays: holidays.map(([date, name]) => ({ date, name })) } },
        { code: "AB_EARNINGS_STATEMENT", title: "Itemized earnings statement", status: "Passed", severity: "Info", summary: "Each employee result balances itemized earnings, statutory deductions, other deductions and net pay.", evidence: { employeeCount: calculated.length, componentCount: components.length } },
      ];
      await db.batch([
        db.prepare("DELETE FROM pay_run_draft_components WHERE draft_id = ? AND workspace_id = ?").bind(draft.id, WORKSPACE_ID),
        db.prepare("DELETE FROM pay_run_compliance_checks WHERE draft_id = ? AND workspace_id = ?").bind(draft.id, WORKSPACE_ID),
        ...calculated.map((line) => db.prepare("UPDATE pay_run_draft_lines SET regular_hours_hundredths = ?, overtime_hours_hundredths = ?, other_earnings_cents = ?, other_deductions_cents = ?, gross_cents = ?, income_tax_cents = ?, cpp_cents = ?, cpp2_cents = ?, ei_cents = ?, net_pay_cents = ?, exceptions_json = ?, updated_at = ? WHERE draft_id = ? AND employee_id = ? AND workspace_id = ?")
          .bind(line.regularHoursHundredths, line.overtimeHoursHundredths, line.otherEarningsCents, line.otherDeductionsCents, line.grossCents, line.incomeTaxCents, line.cppCents, line.cpp2Cents, line.eiCents, line.netPayCents, JSON.stringify(line.exceptions), occurredAt, draft.id, line.employeeId, WORKSPACE_ID)),
        ...components.map((item) => db.prepare("INSERT INTO pay_run_draft_components (id, workspace_id, draft_id, employee_id, category, code, description, quantity_hundredths, rate_cents, amount_cents, display_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`DC-${draft.id}-${item.employeeId}-${item.displayOrder}`, WORKSPACE_ID, draft.id, item.employeeId, item.category, item.code, item.description, item.quantityHundredths, item.rateCents, item.amountCents, item.displayOrder, occurredAt)),
        ...checks.map((check) => db.prepare("INSERT INTO pay_run_compliance_checks (id, workspace_id, draft_id, check_code, title, status, severity, summary, evidence_json, reviewed_at, reviewed_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`CC-${draft.id}-${check.code}`, WORKSPACE_ID, draft.id, check.code, check.title, check.status, check.severity, check.summary, JSON.stringify(check.evidence), null, null, occurredAt)),
        db.prepare("UPDATE pay_run_drafts SET status = ?, gross_cents = ?, net_cents = ?, blocking_exception_count = ?, updated_at = ?, updated_by = ? WHERE id = ? AND workspace_id = ?")
          .bind("Calculated", grossCents, netCents, blockingExceptionCount, occurredAt, actor.email, draft.id, WORKSPACE_ID),
        db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(`AE-${crypto.randomUUID()}`, WORKSPACE_ID, occurredAt, actor.email, "pay_run.calculated", "pay_run_draft", draft.id, `Draft calculated with ${components.length} itemized components and ${blockingExceptionCount} blocking exceptions`, JSON.stringify({ grossCents, netCents, blockingExceptionCount, componentCount: components.length, complianceCheckCount: checks.length, rulesetVersion: "CRA-T4127-2026-AB-v1" })),
      ]);
      return Response.json({ ok: true, id: draft.id, status: "Calculated", blockingExceptionCount });
    } catch (problem) {
      return Response.json({ error: problem instanceof Error ? problem.message : "The pay run could not be calculated." }, { status: 400 });
    }
  }

  if (body.action === "confirm_compliance_check") {
    if (actor.role === "Read-only") return Response.json({ error: "Payroll Processor or Administrator role required." }, { status: 403 });
    const check = await db.prepare("SELECT id, title, status FROM pay_run_compliance_checks WHERE workspace_id = ? AND draft_id = ? AND check_code = ? LIMIT 1").bind(WORKSPACE_ID, body.draftId, body.checkCode).first<{ id: string; title: string; status: string }>();
    if (!check) return Response.json({ error: "The Alberta compliance check was not found. Recalculate the run." }, { status: 404 });
    if (check.status !== "Review required") return Response.json({ ok: true, id: check.id, status: check.status, idempotent: true });
    await db.batch([
      db.prepare("UPDATE pay_run_compliance_checks SET status = ?, reviewed_at = ?, reviewed_by = ?, updated_at = ? WHERE id = ? AND workspace_id = ? AND status = ?").bind("Confirmed", occurredAt, actor.email, occurredAt, check.id, WORKSPACE_ID, "Review required"),
      db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`AE-${crypto.randomUUID()}`, WORKSPACE_ID, occurredAt, actor.email, "pay_run.compliance_confirmed", "pay_run_draft", body.draftId, `${check.title} confirmed`, JSON.stringify({ checkCode: body.checkCode, checkId: check.id })),
    ]);
    return Response.json({ ok: true, id: check.id, status: "Confirmed", idempotent: false });
  }

  if (body.action === "review_draft") {
    if (actor.role === "Read-only") return Response.json({ error: "Payroll Processor or Administrator role required." }, { status: 403 });
    const draft = await db.prepare("SELECT id, status, blocking_exception_count AS blockingExceptionCount, gross_cents AS grossCents FROM pay_run_drafts WHERE id = ? AND workspace_id = ? LIMIT 1").bind(body.draftId, WORKSPACE_ID).first<{ id: string; status: string; blockingExceptionCount: number; grossCents: number }>();
    if (!draft || draft.status !== "Calculated") return Response.json({ error: "Calculate the draft before marking it reviewed." }, { status: 409 });
    if (draft.blockingExceptionCount > 0 || draft.grossCents <= 0) return Response.json({ error: "Resolve all blocking exceptions before review." }, { status: 409 });
    const pendingCompliance = await db.prepare("SELECT COUNT(*) AS count FROM pay_run_compliance_checks WHERE workspace_id = ? AND draft_id = ? AND status IN ('Review required', 'Blocked')").bind(WORKSPACE_ID, draft.id).first<{ count: number }>();
    if (Number(pendingCompliance?.count ?? 0) > 0) return Response.json({ error: "Confirm all required Alberta compliance checks before review." }, { status: 409 });
    await db.batch([
      db.prepare("UPDATE pay_run_drafts SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND workspace_id = ?").bind("Reviewed", occurredAt, actor.email, draft.id, WORKSPACE_ID),
      db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`AE-${crypto.randomUUID()}`, WORKSPACE_ID, occurredAt, actor.email, "pay_run.reviewed", "pay_run_draft", draft.id, "Calculated pay run marked reviewed with no blocking exceptions", "{}"),
    ]);
    return Response.json({ ok: true, id: draft.id, status: "Reviewed" });
  }

  if (body.action === "create_next_draft") {
    if (actor.role === "Read-only") return Response.json({ error: "Payroll Processor or Administrator role required." }, { status: 403 });
    const active = await db.prepare("SELECT id FROM pay_run_drafts WHERE workspace_id = ? AND status != 'Approved' LIMIT 1").bind(WORKSPACE_ID).first<{ id: string }>();
    if (active) return Response.json({ ok: true, id: active.id, idempotent: true });
    try {
      const id = await createDraftFromSchedule(actor.email);
      return Response.json({ ok: true, id, idempotent: false });
    } catch (problem) {
      return Response.json({ error: problem instanceof Error ? problem.message : "The next pay run could not be created." }, { status: 409 });
    }
  }

  if (body.action === "approve_draft") {
    if (actor.role === "Read-only") return Response.json({ error: "Payroll Processor or Administrator role required." }, { status: 403 });
    const draft = await db.prepare("SELECT id, payroll_account_id AS payrollAccountId, payroll_year AS payrollYear, run_number AS runNumber, period_start AS periodStart, period_end AS periodEnd, pay_date AS payDate, status, tax_method AS taxMethod, ruleset_version AS rulesetVersion, gross_cents AS grossCents, net_cents AS netCents, blocking_exception_count AS blockingExceptionCount FROM pay_run_drafts WHERE id = ? AND workspace_id = ? LIMIT 1").bind(body.draftId, WORKSPACE_ID).first<{ id: string; payrollAccountId: string; payrollYear: number; runNumber: number; periodStart: string; periodEnd: string; payDate: string; status: string; taxMethod: string; rulesetVersion: string; grossCents: number; netCents: number; blockingExceptionCount: number }>();
    if (!draft) return Response.json({ error: "The pay-run draft was not found." }, { status: 404 });
    const payRunId = `PR-${draft.payrollAccountId}-${draft.payrollYear}-${String(draft.runNumber).padStart(3, "0")}`;
    const existing = await db.prepare("SELECT id, status FROM pay_runs WHERE id = ? AND workspace_id = ? LIMIT 1").bind(payRunId, WORKSPACE_ID).first<{ id: string; status: string }>();
    if (existing) return Response.json({ ok: true, id: existing.id, status: existing.status, idempotent: true });
    if (draft.status !== "Reviewed" || draft.blockingExceptionCount > 0) return Response.json({ error: "Only a reviewed pay run with no blocking exceptions can be approved." }, { status: 409 });
    const lineResult = await db.prepare("SELECT employee_id AS employeeId, employee_name AS employeeName, gross_cents AS grossCents, income_tax_cents AS incomeTaxCents, cpp_cents AS cppCents, cpp2_cents AS cpp2Cents, ei_cents AS eiCents, other_deductions_cents AS otherDeductionsCents, net_pay_cents AS netPayCents FROM pay_run_draft_lines WHERE draft_id = ? AND workspace_id = ? ORDER BY employee_name ASC").bind(draft.id, WORKSPACE_ID).all<{ employeeId: string; employeeName: string; grossCents: number; incomeTaxCents: number; cppCents: number; cpp2Cents: number; eiCents: number; otherDeductionsCents: number; netPayCents: number }>();
    const lines = lineResult.results;
    const componentResult = await db.prepare("SELECT employee_id AS employeeId, category, code, description, quantity_hundredths AS quantityHundredths, rate_cents AS rateCents, amount_cents AS amountCents, display_order AS displayOrder FROM pay_run_draft_components WHERE draft_id = ? AND workspace_id = ? ORDER BY employee_id, display_order").bind(draft.id, WORKSPACE_ID).all<{ employeeId: string; category: string; code: string; description: string; quantityHundredths: number | null; rateCents: number | null; amountCents: number; displayOrder: number }>();
    if (lines.length !== Object.keys(DEMO_PROFILES).length || lines.some((line) => line.grossCents - line.incomeTaxCents - line.cppCents - line.cpp2Cents - line.eiCents - line.otherDeductionsCents !== line.netPayCents)) {
      return Response.json({ error: "The employee payment controls do not balance." }, { status: 409 });
    }
    const grossCents = lines.reduce((sum, line) => sum + line.grossCents, 0);
    const netCents = lines.reduce((sum, line) => sum + line.netPayCents, 0);
    if (grossCents !== draft.grossCents || netCents !== draft.netCents) return Response.json({ error: "The draft totals changed after review. Recalculate the run." }, { status: 409 });
    if (!componentResult.results.length || lines.some((line) => {
      const items = componentResult.results.filter((item) => item.employeeId === line.employeeId);
      const earnings = items.filter((item) => item.category === "Earning").reduce((sum, item) => sum + item.amountCents, 0);
      const deductions = items.filter((item) => item.category === "Deduction").reduce((sum, item) => sum + item.amountCents, 0);
      return earnings !== line.grossCents || earnings - deductions !== line.netPayCents;
    })) return Response.json({ error: "The itemized employee statements do not balance. Recalculate the run." }, { status: 409 });
    const payableCount = lines.filter((line) => line.netPayCents > 0).length;
    const idempotencyKey = `pay-run-approval:${WORKSPACE_ID}:${draft.payrollAccountId}:${draft.payrollYear}:${draft.runNumber}`;
    const outputs = { register: `REGISTER-${payRunId}`, bank: `RBC-CPA005-CONTROL-${payRunId}`, statements: `STATEMENTS-${payRunId}` };
    await db.batch([
      db.prepare("INSERT INTO pay_runs (id, workspace_id, payroll_account_id, payroll_year, run_number, period_start, period_end, pay_date, status, tax_method, ruleset_version, ruleset_effective_from, gross_cents, net_cents, employee_payment_count, approved_at, approved_by, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(payRunId, WORKSPACE_ID, draft.payrollAccountId, draft.payrollYear, draft.runNumber, draft.periodStart, draft.periodEnd, draft.payDate, "Approved", draft.taxMethod, draft.rulesetVersion, "2026-01-01", grossCents, netCents, payableCount, occurredAt, actor.email, occurredAt, actor.email),
      ...lines.map((line) => db.prepare("INSERT INTO pay_run_payments (id, workspace_id, pay_run_id, employee_id, employee_name, gross_cents, income_tax_cents, cpp_cents, cpp2_cents, ei_cents, other_deductions_cents, net_pay_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`PAY-${draft.runNumber}-${line.employeeId}`, WORKSPACE_ID, payRunId, line.employeeId, line.employeeName, line.grossCents, line.incomeTaxCents, line.cppCents, line.cpp2Cents, line.eiCents, line.otherDeductionsCents, line.netPayCents, occurredAt)),
      ...componentResult.results.map((item) => db.prepare("INSERT INTO pay_run_payment_components (id, workspace_id, pay_run_id, employee_id, category, code, description, quantity_hundredths, rate_cents, amount_cents, display_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`PC-${payRunId}-${item.employeeId}-${item.displayOrder}`, WORKSPACE_ID, payRunId, item.employeeId, item.category, item.code, item.description, item.quantityHundredths, item.rateCents, item.amountCents, item.displayOrder, occurredAt)),
      ...lines.map((line) => db.prepare("INSERT INTO statutory_ledger_entries (id, workspace_id, employee_id, pay_run_id, tax_year, entry_type, pay_date, taxable_earnings_cents, pensionable_earnings_cents, insurable_earnings_cents, income_tax_cents, cpp_cents, cpp2_cents, ei_cents, source_reference, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`SLE-${payRunId}-${line.employeeId}`, WORKSPACE_ID, line.employeeId, payRunId, draft.payrollYear, "Approved payroll", draft.payDate, line.grossCents, line.grossCents, line.grossCents, line.incomeTaxCents, line.cppCents, line.cpp2Cents, line.eiCents, `approved-pay-run:${payRunId}:${line.employeeId}`, occurredAt, actor.email)),
      db.prepare("INSERT INTO pay_run_outputs (id, workspace_id, pay_run_id, output_type, status, item_count, control_total_cents, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`OUT-${draft.runNumber}-REGISTER`, WORKSPACE_ID, payRunId, "Payroll register", "Ready", lines.length, grossCents, outputs.register, occurredAt),
      db.prepare("INSERT INTO pay_run_outputs (id, workspace_id, pay_run_id, output_type, status, item_count, control_total_cents, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`OUT-${draft.runNumber}-BANK`, WORKSPACE_ID, payRunId, "Bank-file control", "Ready", payableCount, netCents, outputs.bank, occurredAt),
      db.prepare("INSERT INTO pay_run_outputs (id, workspace_id, pay_run_id, output_type, status, item_count, control_total_cents, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`OUT-${draft.runNumber}-STATEMENTS`, WORKSPACE_ID, payRunId, "Statement batch", "Ready", payableCount, netCents, outputs.statements, occurredAt),
      db.prepare("INSERT INTO billing_events (id, workspace_id, pay_run_id, event_type, quantity, unit_price_cents, total_cents, idempotency_key, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`BILL-${draft.runNumber}-PAYMENTS`, WORKSPACE_ID, payRunId, "pay_run_finalized", payableCount, 200, 1000 + payableCount * 200, idempotencyKey, occurredAt),
      db.prepare("UPDATE pay_run_drafts SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND workspace_id = ?").bind("Approved", occurredAt, actor.email, draft.id, WORKSPACE_ID),
      db.prepare("UPDATE payroll_accounts SET next_run = ? WHERE id = ? AND workspace_id = ?").bind(`Run ${draft.runNumber + 1} · ${draft.runNumber === 17 ? "Sep 18" : "Oct 2"}`, draft.payrollAccountId, WORKSPACE_ID),
      db.prepare("UPDATE pay_schedules SET next_run_number = ?, next_period_start = ?, next_period_end = ?, next_pay_date = ?, updated_at = ?, updated_by = ? WHERE payroll_account_id = ? AND workspace_id = ?").bind(draft.runNumber + 1, addDays(draft.periodStart, 14), addDays(draft.periodEnd, 14), addDays(draft.payDate, 14), occurredAt, actor.email, draft.payrollAccountId, WORKSPACE_ID),
      db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`AE-${crypto.randomUUID()}`, WORKSPACE_ID, occurredAt, actor.email, "pay_run.approved", "pay_run", payRunId, `Pay run ${draft.runNumber} approved from its reviewed draft with balanced outputs`, JSON.stringify({ draftId: draft.id, grossCents, netCents, employeePaymentCount: payableCount, taxMethod: draft.taxMethod, rulesetVersion: draft.rulesetVersion, idempotencyKey })),
    ]);
    return Response.json({ ok: true, id: payRunId, status: "Approved", idempotent: false });
  }

  if (body.action === "approve_demo_run") {
    if (actor.role === "Read-only") return Response.json({ error: "Payroll Processor or Administrator role required." }, { status: 403 });
    const payRunId = "PR-PA-0001-2026-017";
    const existing = await db.prepare("SELECT id, status FROM pay_runs WHERE id = ? AND workspace_id = ? LIMIT 1").bind(payRunId, WORKSPACE_ID).first<{ id: string; status: string }>();
    if (existing) return Response.json({ ok: true, id: existing.id, status: existing.status, idempotent: true });

    const grossCents = DEMO_PAYMENTS.reduce((sum, payment) => sum + payment.grossCents, 0);
    const netCents = DEMO_PAYMENTS.reduce((sum, payment) => sum + payment.netPayCents, 0);
    const idempotencyKey = `pay-run-approval:${WORKSPACE_ID}:PA-0001:2026:17`;
    const statementsReference = `STATEMENTS-${payRunId}`;
    const registerReference = `REGISTER-${payRunId}`;
    const bankReference = `RBC-CPA005-CONTROL-${payRunId}`;

    const statements = DEMO_PAYMENTS.map((payment) =>
      db.prepare("INSERT INTO pay_run_payments (id, workspace_id, pay_run_id, employee_id, employee_name, gross_cents, income_tax_cents, cpp_cents, ei_cents, other_deductions_cents, net_pay_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(payment.id, WORKSPACE_ID, payRunId, payment.employeeId, payment.employeeName, payment.grossCents, payment.incomeTaxCents, payment.cppCents, payment.eiCents, payment.otherDeductionsCents, payment.netPayCents, occurredAt),
    );

    await db.batch([
      db.prepare("INSERT INTO pay_runs (id, workspace_id, payroll_account_id, payroll_year, run_number, period_start, period_end, pay_date, status, ruleset_version, ruleset_effective_from, gross_cents, net_cents, employee_payment_count, approved_at, approved_by, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(payRunId, WORKSPACE_ID, "PA-0001", 2026, 17, "2026-08-16", "2026-08-31", "2026-09-04", "Approved", "2026-AB-PERIODIC-v1", "2026-07-01", grossCents, netCents, DEMO_PAYMENTS.length, occurredAt, actor.email, occurredAt, actor.email),
      ...statements,
      db.prepare("INSERT INTO pay_run_outputs (id, workspace_id, pay_run_id, output_type, status, item_count, control_total_cents, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("OUT-17-REGISTER", WORKSPACE_ID, payRunId, "Payroll register", "Ready", DEMO_PAYMENTS.length, grossCents, registerReference, occurredAt),
      db.prepare("INSERT INTO pay_run_outputs (id, workspace_id, pay_run_id, output_type, status, item_count, control_total_cents, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("OUT-17-BANK", WORKSPACE_ID, payRunId, "Bank-file control", "Ready", DEMO_PAYMENTS.length, netCents, bankReference, occurredAt),
      db.prepare("INSERT INTO pay_run_outputs (id, workspace_id, pay_run_id, output_type, status, item_count, control_total_cents, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("OUT-17-STATEMENTS", WORKSPACE_ID, payRunId, "Statement batch", "Ready", DEMO_PAYMENTS.length, netCents, statementsReference, occurredAt),
      db.prepare("INSERT INTO billing_events (id, workspace_id, pay_run_id, event_type, quantity, unit_price_cents, total_cents, idempotency_key, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("BILL-17-PAYMENTS", WORKSPACE_ID, payRunId, "pay_run_finalized", DEMO_PAYMENTS.length, 200, 1000 + DEMO_PAYMENTS.length * 200, idempotencyKey, occurredAt),
      db.prepare("INSERT INTO audit_events (id, workspace_id, occurred_at, actor_email, action, entity_type, entity_id, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(`AE-${crypto.randomUUID()}`, WORKSPACE_ID, occurredAt, actor.email, "pay_run.approved", "pay_run", payRunId, "Pay run 17 approved with register, bank control, statement batch and billing event", JSON.stringify({ payrollAccountId: "PA-0001", payrollYear: 2026, runNumber: 17, grossCents, netCents, employeePaymentCount: DEMO_PAYMENTS.length, rulesetVersion: "2026-AB-PERIODIC-v1", outputReferences: [registerReference, bankReference, statementsReference], idempotencyKey })),
      db.prepare("UPDATE payroll_accounts SET next_run = ? WHERE id = ? AND workspace_id = ?").bind("Run 18 · Sep 18", "PA-0001", WORKSPACE_ID),
    ]);
    return Response.json({ ok: true, id: payRunId, status: "Approved", idempotent: false });
  }

  return Response.json({ error: "Unsupported administrator action." }, { status: 400 });
}
