import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const employerWorkspaces = sqliteTable("employer_workspaces", {
  id: text("id").primaryKey(),
  legalName: text("legal_name").notNull(),
  province: text("province").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
});

export const payrollAccounts = sqliteTable("payroll_accounts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  programAccountMasked: text("program_account_masked").notNull(),
  remitterType: text("remitter_type").notNull(),
  status: text("status").notNull(),
  employeeCount: integer("employee_count").notNull().default(0),
  nextRun: text("next_run").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
}, (table) => [index("payroll_accounts_workspace_idx").on(table.workspaceId)]);

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  payrollAccountId: text("payroll_account_id").notNull().references(() => payrollAccounts.id),
  legalName: text("legal_name").notNull(),
  email: text("email").notNull(),
  roleTitle: text("role_title").notNull(),
  department: text("department").notNull(),
  payType: text("pay_type").notNull(),
  payRate: text("pay_rate").notNull(),
  hireDate: text("hire_date").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("employees_workspace_account_idx").on(table.workspaceId, table.payrollAccountId)]);

export const employerMemberships = sqliteTable("employer_memberships", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
}, (table) => [index("memberships_workspace_email_idx").on(table.workspaceId, table.email)]);

export const employerPayrollSettings = sqliteTable("employer_payroll_settings", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  defaultTaxMethod: text("default_tax_method").notNull(),
  option2Available: integer("option2_available", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
}, (table) => [uniqueIndex("employer_payroll_settings_workspace_uq").on(table.workspaceId)]);

export const offboardingDrafts = sqliteTable("offboarding_drafts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  employeeId: text("employee_id").references(() => employees.id),
  employeeName: text("employee_name").notNull(),
  reasonCode: text("reason_code").notNull(),
  lastDay: text("last_day").notNull(),
  finalPayMethod: text("final_pay_method").notNull(),
  status: text("status").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
}, (table) => [index("offboarding_workspace_idx").on(table.workspaceId)]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  occurredAt: text("occurred_at").notNull(),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  summary: text("summary").notNull(),
  payloadJson: text("payload_json").notNull(),
}, (table) => [index("audit_workspace_time_idx").on(table.workspaceId, table.occurredAt)]);

export const payRuns = sqliteTable("pay_runs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  payrollAccountId: text("payroll_account_id").notNull().references(() => payrollAccounts.id),
  payrollYear: integer("payroll_year").notNull(),
  runNumber: integer("run_number").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  payDate: text("pay_date").notNull(),
  status: text("status").notNull(),
  taxMethod: text("tax_method").notNull().default("Option 1 — Periodic"),
  rulesetVersion: text("ruleset_version").notNull(),
  rulesetEffectiveFrom: text("ruleset_effective_from").notNull(),
  grossCents: integer("gross_cents").notNull(),
  netCents: integer("net_cents").notNull(),
  employeePaymentCount: integer("employee_payment_count").notNull(),
  approvedAt: text("approved_at"),
  approvedBy: text("approved_by"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
}, (table) => [
  uniqueIndex("pay_runs_account_year_number_uq").on(table.payrollAccountId, table.payrollYear, table.runNumber),
  index("pay_runs_workspace_pay_date_idx").on(table.workspaceId, table.payDate),
]);

export const payRunPayments = sqliteTable("pay_run_payments", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  payRunId: text("pay_run_id").notNull().references(() => payRuns.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  employeeName: text("employee_name").notNull(),
  grossCents: integer("gross_cents").notNull(),
  incomeTaxCents: integer("income_tax_cents").notNull(),
  cppCents: integer("cpp_cents").notNull(),
  cpp2Cents: integer("cpp2_cents").notNull().default(0),
  eiCents: integer("ei_cents").notNull(),
  otherDeductionsCents: integer("other_deductions_cents").notNull(),
  netPayCents: integer("net_pay_cents").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("pay_run_payments_run_employee_uq").on(table.payRunId, table.employeeId),
  index("pay_run_payments_workspace_idx").on(table.workspaceId),
]);

export const payRunOutputs = sqliteTable("pay_run_outputs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  payRunId: text("pay_run_id").notNull().references(() => payRuns.id),
  outputType: text("output_type").notNull(),
  status: text("status").notNull(),
  itemCount: integer("item_count").notNull(),
  controlTotalCents: integer("control_total_cents").notNull(),
  reference: text("reference").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("pay_run_outputs_run_type_uq").on(table.payRunId, table.outputType),
  index("pay_run_outputs_workspace_idx").on(table.workspaceId),
]);

export const billingEvents = sqliteTable("billing_events", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  payRunId: text("pay_run_id").notNull().references(() => payRuns.id),
  eventType: text("event_type").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  occurredAt: text("occurred_at").notNull(),
}, (table) => [
  uniqueIndex("billing_events_idempotency_uq").on(table.idempotencyKey),
  index("billing_events_workspace_time_idx").on(table.workspaceId, table.occurredAt),
]);

export const payRunDrafts = sqliteTable("pay_run_drafts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  payrollAccountId: text("payroll_account_id").notNull().references(() => payrollAccounts.id),
  payrollYear: integer("payroll_year").notNull(),
  runNumber: integer("run_number").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  payDate: text("pay_date").notNull(),
  status: text("status").notNull(),
  taxMethod: text("tax_method").notNull().default("Option 1 — Periodic"),
  rulesetVersion: text("ruleset_version").notNull(),
  grossCents: integer("gross_cents").notNull().default(0),
  netCents: integer("net_cents").notNull().default(0),
  blockingExceptionCount: integer("blocking_exception_count").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
}, (table) => [
  uniqueIndex("pay_run_drafts_account_year_number_uq").on(table.payrollAccountId, table.payrollYear, table.runNumber),
  index("pay_run_drafts_workspace_idx").on(table.workspaceId),
]);

export const payRunDraftLines = sqliteTable("pay_run_draft_lines", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  draftId: text("draft_id").notNull().references(() => payRunDrafts.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  employeeName: text("employee_name").notNull(),
  payType: text("pay_type").notNull(),
  regularHoursHundredths: integer("regular_hours_hundredths").notNull().default(0),
  overtimeHoursHundredths: integer("overtime_hours_hundredths").notNull().default(0),
  bankedOvertimeEarnedHundredths: integer("banked_overtime_earned_hundredths").notNull().default(0),
  bankedOvertimeUsedHundredths: integer("banked_overtime_used_hundredths").notNull().default(0),
  otherEarningsCents: integer("other_earnings_cents").notNull().default(0),
  otherDeductionsCents: integer("other_deductions_cents").notNull().default(0),
  grossCents: integer("gross_cents").notNull().default(0),
  incomeTaxCents: integer("income_tax_cents").notNull().default(0),
  cppCents: integer("cpp_cents").notNull().default(0),
  cpp2Cents: integer("cpp2_cents").notNull().default(0),
  eiCents: integer("ei_cents").notNull().default(0),
  netPayCents: integer("net_pay_cents").notNull().default(0),
  exceptionsJson: text("exceptions_json").notNull().default("[]"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("pay_run_draft_lines_draft_employee_uq").on(table.draftId, table.employeeId),
  index("pay_run_draft_lines_workspace_idx").on(table.workspaceId),
]);

export const overtimeAgreements = sqliteTable("overtime_agreements", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  agreementType: text("agreement_type").notNull(),
  bankRateHundredths: integer("bank_rate_hundredths").notNull().default(100),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  status: text("status").notNull(),
  documentReference: text("document_reference").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
}, (table) => [index("overtime_agreements_employee_effective_idx").on(table.workspaceId, table.employeeId, table.effectiveFrom)]);

export const overtimeBankEntries = sqliteTable("overtime_bank_entries", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  payRunId: text("pay_run_id").references(() => payRuns.id),
  entryType: text("entry_type").notNull(),
  transactionDate: text("transaction_date").notNull(),
  hoursDeltaHundredths: integer("hours_delta_hundredths").notNull(),
  expiresOn: text("expires_on"),
  sourceReference: text("source_reference").notNull(),
  note: text("note").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
}, (table) => [
  uniqueIndex("overtime_bank_source_uq").on(table.sourceReference),
  index("overtime_bank_employee_date_idx").on(table.workspaceId, table.employeeId, table.transactionDate),
]);

export const remittanceObligations = sqliteTable("remittance_obligations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  payrollAccountId: text("payroll_account_id").notNull().references(() => payrollAccounts.id),
  payRunId: text("pay_run_id").notNull().references(() => payRuns.id),
  periodEnd: text("period_end").notNull(),
  dueDate: text("due_date").notNull(),
  liabilityCents: integer("liability_cents").notNull(),
  status: text("status").notNull(),
  reminderDate: text("reminder_date"),
  paidDate: text("paid_date"),
  paymentReference: text("payment_reference"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
}, (table) => [
  uniqueIndex("remittance_pay_run_uq").on(table.payRunId),
  index("remittance_workspace_due_idx").on(table.workspaceId, table.dueDate),
]);

export const employerBankLinks = sqliteTable("employer_bank_links", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  bankName: text("bank_name").notNull(),
  bankUrl: text("bank_url").notNull(),
  eftAdapter: text("eft_adapter").notNull(),
  status: text("status").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
}, (table) => [uniqueIndex("employer_bank_link_workspace_uq").on(table.workspaceId)]);

export const payRunDraftComponents = sqliteTable("pay_run_draft_components", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  draftId: text("draft_id").notNull().references(() => payRunDrafts.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  category: text("category").notNull(),
  code: text("code").notNull(),
  description: text("description").notNull(),
  quantityHundredths: integer("quantity_hundredths"),
  rateCents: integer("rate_cents"),
  amountCents: integer("amount_cents").notNull(),
  displayOrder: integer("display_order").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("draft_components_draft_employee_order_uq").on(table.draftId, table.employeeId, table.displayOrder),
  index("draft_components_workspace_idx").on(table.workspaceId, table.draftId),
]);

export const payRunPaymentComponents = sqliteTable("pay_run_payment_components", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  payRunId: text("pay_run_id").notNull().references(() => payRuns.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  category: text("category").notNull(),
  code: text("code").notNull(),
  description: text("description").notNull(),
  quantityHundredths: integer("quantity_hundredths"),
  rateCents: integer("rate_cents"),
  amountCents: integer("amount_cents").notNull(),
  displayOrder: integer("display_order").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("payment_components_run_employee_order_uq").on(table.payRunId, table.employeeId, table.displayOrder),
  index("payment_components_workspace_idx").on(table.workspaceId, table.payRunId),
]);

export const payRunComplianceChecks = sqliteTable("pay_run_compliance_checks", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  draftId: text("draft_id").notNull().references(() => payRunDrafts.id),
  checkCode: text("check_code").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  severity: text("severity").notNull(),
  summary: text("summary").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  reviewedAt: text("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("compliance_checks_draft_code_uq").on(table.draftId, table.checkCode),
  index("compliance_checks_workspace_idx").on(table.workspaceId, table.draftId),
]);

export const paySchedules = sqliteTable("pay_schedules", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  payrollAccountId: text("payroll_account_id").notNull().references(() => payrollAccounts.id),
  name: text("name").notNull(),
  frequency: text("frequency").notNull(),
  periodsPerYear: integer("periods_per_year").notNull(),
  nextRunNumber: integer("next_run_number").notNull(),
  nextPeriodStart: text("next_period_start").notNull(),
  nextPeriodEnd: text("next_period_end").notNull(),
  nextPayDate: text("next_pay_date").notNull(),
  status: text("status").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
}, (table) => [index("pay_schedules_workspace_account_idx").on(table.workspaceId, table.payrollAccountId)]);

export const employeePayrollProfiles = sqliteTable("employee_payroll_profiles", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  payScheduleId: text("pay_schedule_id").notNull().references(() => paySchedules.id),
  taxMethod: text("tax_method").notNull(),
  salaryPeriodicCents: integer("salary_periodic_cents").notNull().default(0),
  hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
  standardHoursHundredths: integer("standard_hours_hundredths").notNull().default(0),
  federalClaimCents: integer("federal_claim_cents").notNull(),
  albertaClaimCents: integer("alberta_claim_cents").notNull(),
  additionalTaxCents: integer("additional_tax_cents").notNull().default(0),
  cppExempt: integer("cpp_exempt", { mode: "boolean" }).notNull().default(false),
  eiExempt: integer("ei_exempt", { mode: "boolean" }).notNull().default(false),
  effectiveFrom: text("effective_from").notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
}, (table) => [
  uniqueIndex("employee_payroll_profiles_employee_uq").on(table.employeeId),
  index("employee_payroll_profiles_workspace_idx").on(table.workspaceId),
]);

export const employeePayrollProfileVersions = sqliteTable("employee_payroll_profile_versions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  payScheduleId: text("pay_schedule_id").notNull().references(() => paySchedules.id),
  taxMethod: text("tax_method").notNull(),
  salaryPeriodicCents: integer("salary_periodic_cents").notNull().default(0),
  hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
  standardHoursHundredths: integer("standard_hours_hundredths").notNull().default(0),
  federalClaimCents: integer("federal_claim_cents").notNull(),
  albertaClaimCents: integer("alberta_claim_cents").notNull(),
  additionalTaxCents: integer("additional_tax_cents").notNull().default(0),
  cppExempt: integer("cpp_exempt", { mode: "boolean" }).notNull().default(false),
  eiExempt: integer("ei_exempt", { mode: "boolean" }).notNull().default(false),
  effectiveFrom: text("effective_from").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
}, (table) => [index("profile_versions_employee_effective_idx").on(table.workspaceId, table.employeeId, table.effectiveFrom)]);

export const payrollCodes = sqliteTable("payroll_codes", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  calculationMode: text("calculation_mode").notNull(),
  taxable: integer("taxable", { mode: "boolean" }).notNull().default(false),
  pensionable: integer("pensionable", { mode: "boolean" }).notNull().default(false),
  insurable: integer("insurable", { mode: "boolean" }).notNull().default(false),
  vacationable: integer("vacationable", { mode: "boolean" }).notNull().default(false),
  holidayAverageEligible: integer("holiday_average_eligible", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
}, (table) => [
  uniqueIndex("payroll_codes_workspace_code_uq").on(table.workspaceId, table.code),
  index("payroll_codes_workspace_type_idx").on(table.workspaceId, table.type),
]);

export const employeeRecurringPayItems = sqliteTable("employee_recurring_pay_items", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  payrollCodeId: text("payroll_code_id").notNull().references(() => payrollCodes.id),
  amountCents: integer("amount_cents").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
}, (table) => [
  index("recurring_pay_items_employee_effective_idx").on(table.workspaceId, table.employeeId, table.effectiveFrom),
  index("recurring_pay_items_code_idx").on(table.workspaceId, table.payrollCodeId),
]);

export const statutoryLedgerEntries = sqliteTable("statutory_ledger_entries", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  payRunId: text("pay_run_id").references(() => payRuns.id),
  taxYear: integer("tax_year").notNull(),
  entryType: text("entry_type").notNull(),
  payDate: text("pay_date").notNull(),
  taxableEarningsCents: integer("taxable_earnings_cents").notNull(),
  pensionableEarningsCents: integer("pensionable_earnings_cents").notNull(),
  insurableEarningsCents: integer("insurable_earnings_cents").notNull(),
  incomeTaxCents: integer("income_tax_cents").notNull(),
  cppCents: integer("cpp_cents").notNull(),
  cpp2Cents: integer("cpp2_cents").notNull(),
  eiCents: integer("ei_cents").notNull(),
  sourceReference: text("source_reference").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
}, (table) => [
  uniqueIndex("statutory_ledger_source_uq").on(table.sourceReference),
  index("statutory_ledger_employee_year_idx").on(table.workspaceId, table.employeeId, table.taxYear),
]);

export const employmentChangeVersions = sqliteTable("employment_change_versions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  changeType: text("change_type").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  previousValueJson: text("previous_value_json").notNull(),
  newValueJson: text("new_value_json").notNull(),
  rulesetVersion: text("ruleset_version").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
}, (table) => [
  index("employment_changes_employee_effective_idx").on(table.workspaceId, table.employeeId, table.effectiveFrom),
  index("employment_changes_type_idx").on(table.workspaceId, table.changeType),
]);

export const employeeJurisdictionVersions = sqliteTable("employee_jurisdiction_versions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  residenceProvince: text("residence_province").notNull(),
  workProvince: text("work_province").notNull(),
  taxProvince: text("tax_province").notNull(),
  employmentStandardsJurisdiction: text("employment_standards_jurisdiction").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
}, (table) => [index("employee_jurisdictions_effective_idx").on(table.workspaceId, table.employeeId, table.effectiveFrom)]);

export const openingBalanceEntries = sqliteTable("opening_balance_entries", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  taxYear: integer("tax_year").notNull(),
  asOfDate: text("as_of_date").notNull(),
  taxableEarningsCents: integer("taxable_earnings_cents").notNull(),
  pensionableEarningsCents: integer("pensionable_earnings_cents").notNull(),
  insurableEarningsCents: integer("insurable_earnings_cents").notNull(),
  incomeTaxCents: integer("income_tax_cents").notNull(),
  cppCents: integer("cpp_cents").notNull(),
  cpp2Cents: integer("cpp2_cents").notNull().default(0),
  eiCents: integer("ei_cents").notNull(),
  vacationHoursHundredths: integer("vacation_hours_hundredths").notNull().default(0),
  vacationDollarsCents: integer("vacation_dollars_cents").notNull().default(0),
  sourceReference: text("source_reference").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
}, (table) => [
  uniqueIndex("opening_balances_employee_year_uq").on(table.workspaceId, table.employeeId, table.taxYear),
  index("opening_balances_workspace_idx").on(table.workspaceId),
]);

export const correctionRuns = sqliteTable("correction_runs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => employerWorkspaces.id),
  payrollAccountId: text("payroll_account_id").notNull().references(() => payrollAccounts.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  linkedPayRunId: text("linked_pay_run_id").references(() => payRuns.id),
  correctionType: text("correction_type").notNull(),
  effectiveDate: text("effective_date").notNull(),
  payDate: text("pay_date").notNull(),
  grossCents: integer("gross_cents").notNull(),
  deductionsCents: integer("deductions_cents").notNull(),
  netPayCents: integer("net_pay_cents").notNull(),
  status: text("status").notNull(),
  explanation: text("explanation").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
  approvedAt: text("approved_at"),
  approvedBy: text("approved_by"),
}, (table) => [
  index("correction_runs_employee_idx").on(table.workspaceId, table.employeeId),
  index("correction_runs_status_idx").on(table.workspaceId, table.status),
]);
