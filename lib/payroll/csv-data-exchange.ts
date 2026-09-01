export type CsvValue = string | number | boolean | null;

export type DataExchangeColumn = {
  key: string;
  label: string;
  required?: boolean;
  type: "text" | "integer" | "money_cents" | "date" | "boolean";
};

export type DataExchangeSection = {
  id: string;
  area: string;
  label: string;
  description: string;
  primaryKey: string;
  importRule: string;
  columns: readonly DataExchangeColumn[];
  records: readonly Record<string, CsvValue>[];
};

const employeeColumns = [
  { key: "employee_external_id", label: "Employee ID", required: true, type: "text" },
  { key: "payroll_account_external_id", label: "Payroll account ID", required: true, type: "text" },
  { key: "legal_name", label: "Legal name", required: true, type: "text" },
  { key: "email", label: "Email", required: true, type: "text" },
  { key: "employment_status", label: "Status", required: true, type: "text" },
  { key: "pay_type", label: "Pay type", required: true, type: "text" },
  { key: "effective_date", label: "Effective date", required: true, type: "date" },
] as const satisfies readonly DataExchangeColumn[];

export const dataExchangeSections = [
  {
    id: "employers", area: "Customer setup", label: "Employer profiles", primaryKey: "employer_external_id",
    description: "Legal employer, CRA account references and jurisdiction settings.",
    importRule: "Create or update by employer_external_id after a validation pass.",
    columns: [
      { key: "employer_external_id", label: "Employer ID", required: true, type: "text" },
      { key: "legal_name", label: "Legal name", required: true, type: "text" },
      { key: "operating_name", label: "Operating name", type: "text" },
      { key: "province", label: "Province", required: true, type: "text" },
      { key: "cra_program_account_masked", label: "CRA account", type: "text" },
      { key: "remitter_type", label: "Remitter type", required: true, type: "text" },
    ],
    records: [{ employer_external_id: "EMP-PNS", legal_name: "Prairie North Services Ltd.", operating_name: "Prairie North", province: "AB", cra_program_account_masked: "***RP0001", remitter_type: "monthly" }],
  },
  {
    id: "payroll_accounts", area: "Customer setup", label: "CRA payroll accounts", primaryKey: "payroll_account_external_id",
    description: "Employer-scoped BN payroll program accounts used to separate employees, runs, remittances and statutory records.",
    importRule: "Create a draft by payroll_account_external_id; activation requires verified CRA settings and administrator approval.",
    columns: [
      { key: "payroll_account_external_id", label: "Payroll account ID", required: true, type: "text" },
      { key: "employer_external_id", label: "Employer ID", required: true, type: "text" },
      { key: "program_account_masked", label: "Program account", required: true, type: "text" },
      { key: "remitter_type", label: "Remitter type", required: true, type: "text" },
      { key: "status", label: "Status", required: true, type: "text" },
      { key: "effective_date", label: "Effective date", required: true, type: "date" },
    ],
    records: [{ payroll_account_external_id: "PA-0001", employer_external_id: "EMP-PNS", program_account_masked: "*********RP0001", remitter_type: "monthly", status: "active", effective_date: "2026-01-01" }],
  },
  {
    id: "employees", area: "People", label: "Employees", primaryKey: "employee_external_id",
    description: "Employment identity, status and effective-dated pay profile references.",
    importRule: "Create or update by employee_external_id; changes create effective-dated rows.",
    columns: employeeColumns,
    records: [
      { employee_external_id: "E-1001", payroll_account_external_id: "PA-0001", legal_name: "Avery Chen", email: "avery@example.ca", employment_status: "active", pay_type: "salary", effective_date: "2026-01-01" },
      { employee_external_id: "E-1002", payroll_account_external_id: "PA-0001", legal_name: "Noah Williams", email: "noah@example.ca", employment_status: "active", pay_type: "hourly", effective_date: "2026-01-12" },
      { employee_external_id: "E-1003", payroll_account_external_id: "PA-0001", legal_name: "Priya Singh", email: "priya@example.ca", employment_status: "active", pay_type: "salary", effective_date: "2026-01-01" },
      { employee_external_id: "E-1004", payroll_account_external_id: "PA-0001", legal_name: "Liam Martin", email: "liam@example.ca", employment_status: "active", pay_type: "hourly", effective_date: "2026-02-02" },
    ],
  },
  {
    id: "compensation", area: "People", label: "Compensation & tax profiles", primaryKey: "profile_external_id",
    description: "Effective-dated rates, TD1 claims, benefits and deduction elections.",
    importRule: "Append a new effective-dated profile; never rewrite a calculation snapshot.",
    columns: [
      { key: "profile_external_id", label: "Profile ID", required: true, type: "text" },
      { key: "employee_external_id", label: "Employee ID", required: true, type: "text" },
      { key: "effective_date", label: "Effective date", required: true, type: "date" },
      { key: "annual_salary_cents", label: "Annual salary cents", type: "money_cents" },
      { key: "hourly_rate_cents", label: "Hourly rate cents", type: "money_cents" },
      { key: "federal_td1_cents", label: "Federal TD1 cents", required: true, type: "money_cents" },
      { key: "provincial_td1_cents", label: "Provincial TD1 cents", required: true, type: "money_cents" },
    ],
    records: [{ profile_external_id: "CP-1002-20260112", employee_external_id: "E-1002", effective_date: "2026-01-12", annual_salary_cents: null, hourly_rate_cents: 3000, federal_td1_cents: 1645200, provincial_td1_cents: 2276900 }],
  },
  {
    id: "bank_instructions", area: "People", label: "Bank instructions", primaryKey: "instruction_external_id",
    description: "Masked employee deposit-routing references for migration and troubleshooting.",
    importRule: "Administrator import requires a second-person review before activation.",
    columns: [
      { key: "instruction_external_id", label: "Instruction ID", required: true, type: "text" },
      { key: "employee_external_id", label: "Employee ID", required: true, type: "text" },
      { key: "institution_number", label: "Institution", required: true, type: "text" },
      { key: "transit_number", label: "Transit", required: true, type: "text" },
      { key: "account_masked", label: "Account", required: true, type: "text" },
      { key: "effective_date", label: "Effective date", required: true, type: "date" },
    ],
    records: [{ instruction_external_id: "BI-1002-01", employee_external_id: "E-1002", institution_number: "003", transit_number: "03900", account_masked: "******4312", effective_date: "2026-01-12" }],
  },
  {
    id: "pay_schedules", area: "Customer setup", label: "Pay schedules", primaryKey: "schedule_external_id",
    description: "Pay frequency, period boundaries and planned pay dates.",
    importRule: "Create or update future schedules; started years require an explicit migration mode.",
    columns: [
      { key: "schedule_external_id", label: "Schedule ID", required: true, type: "text" },
      { key: "year", label: "Year", required: true, type: "integer" },
      { key: "frequency", label: "Frequency", required: true, type: "text" },
      { key: "periods", label: "Periods", required: true, type: "integer" },
      { key: "first_pay_date", label: "First pay date", required: true, type: "date" },
    ],
    records: [{ schedule_external_id: "PS-2026-BW", year: 2026, frequency: "biweekly", periods: 26, first_pay_date: "2026-01-09" }],
  },
  {
    id: "opening_balances", area: "Customer setup", label: "Opening balances", primaryKey: "balance_external_id",
    description: "Employee year-to-date earnings, deductions and contribution balances.",
    importRule: "Import only before the first approved Comcheq run; corrections use an adjustment batch.",
    columns: [
      { key: "balance_external_id", label: "Balance ID", required: true, type: "text" },
      { key: "employee_external_id", label: "Employee ID", required: true, type: "text" },
      { key: "as_of_date", label: "As-of date", required: true, type: "date" },
      { key: "gross_cents", label: "Gross cents", required: true, type: "money_cents" },
      { key: "income_tax_cents", label: "Income tax cents", required: true, type: "money_cents" },
      { key: "cpp_cents", label: "CPP cents", required: true, type: "money_cents" },
      { key: "ei_cents", label: "EI cents", required: true, type: "money_cents" },
    ],
    records: [{ balance_external_id: "OB-1002-2026", employee_external_id: "E-1002", as_of_date: "2026-07-31", gross_cents: 3610000, income_tax_cents: 602100, cpp_cents: 207320, ei_cents: 58843 }],
  },
  {
    id: "time_entries", area: "Payroll", label: "Time entries", primaryKey: "time_entry_external_id",
    description: "Regular, overtime and vacation hours by employee and pay run.",
    importRule: "Create or update draft time entries; approved-run time is immutable.",
    columns: [
      { key: "time_entry_external_id", label: "Time entry ID", required: true, type: "text" },
      { key: "pay_run_number", label: "Pay run", required: true, type: "integer" },
      { key: "employee_external_id", label: "Employee ID", required: true, type: "text" },
      { key: "regular_hours", label: "Regular hours", required: true, type: "text" },
      { key: "overtime_hours", label: "Overtime hours", required: true, type: "text" },
      { key: "vacation_hours", label: "Vacation hours", required: true, type: "text" },
    ],
    records: [{ time_entry_external_id: "TE-17-1002", pay_run_number: 17, employee_external_id: "E-1002", regular_hours: "80.00", overtime_hours: "2.50", vacation_hours: "0.00" }],
  },
  {
    id: "pay_runs", area: "Payroll", label: "Pay-run headers", primaryKey: "pay_run_external_id",
    description: "Numbered run dates, status, approval and control totals.",
    importRule: "Historical approved runs append through controlled migration; existing approved rows cannot be overwritten.",
    columns: [
      { key: "pay_run_external_id", label: "Pay run ID", required: true, type: "text" },
      { key: "payroll_account_external_id", label: "Payroll account ID", required: true, type: "text" },
      { key: "year", label: "Year", required: true, type: "integer" },
      { key: "run_number", label: "Run number", required: true, type: "integer" },
      { key: "period_start", label: "Period start", required: true, type: "date" },
      { key: "period_end", label: "Period end", required: true, type: "date" },
      { key: "pay_date", label: "Pay date", required: true, type: "date" },
      { key: "status", label: "Status", required: true, type: "text" },
      { key: "gross_cents", label: "Gross cents", required: true, type: "money_cents" },
      { key: "net_cents", label: "Net cents", required: true, type: "money_cents" },
    ],
    records: [{ pay_run_external_id: "PR-2026-0017", payroll_account_external_id: "PA-0001", year: 2026, run_number: 17, period_start: "2026-08-16", period_end: "2026-08-31", pay_date: "2026-09-04", status: "draft", gross_cents: 1210265, net_cents: 823897 }],
  },
  {
    id: "pay_details", area: "Payroll", label: "Employee pay details", primaryKey: "payment_external_id",
    description: "Employee-level earnings, deductions and net-pay lines for each run.",
    importRule: "Historical details append with their run; draft details are replaced by calculation.",
    columns: [
      { key: "payment_external_id", label: "Payment ID", required: true, type: "text" },
      { key: "pay_run_external_id", label: "Pay run ID", required: true, type: "text" },
      { key: "employee_external_id", label: "Employee ID", required: true, type: "text" },
      { key: "gross_cents", label: "Gross cents", required: true, type: "money_cents" },
      { key: "income_tax_cents", label: "Income tax cents", required: true, type: "money_cents" },
      { key: "cpp_cents", label: "CPP cents", required: true, type: "money_cents" },
      { key: "ei_cents", label: "EI cents", required: true, type: "money_cents" },
      { key: "net_cents", label: "Net cents", required: true, type: "money_cents" },
    ],
    records: [{ payment_external_id: "PAY-17-1002", pay_run_external_id: "PR-2026-0017", employee_external_id: "E-1002", gross_cents: 263250, income_tax_cents: 43915, cpp_cents: 15117, ei_cents: 4291, net_cents: 193927 }],
  },
  {
    id: "remittances", area: "Compliance", label: "CRA remittances", primaryKey: "remittance_external_id",
    description: "Liability, due date, payment reference and recorded-paid status.",
    importRule: "Append payment evidence or update an unpaid liability by external ID.",
    columns: [
      { key: "remittance_external_id", label: "Remittance ID", required: true, type: "text" },
      { key: "payroll_account_external_id", label: "Payroll account ID", required: true, type: "text" },
      { key: "period_end", label: "Period end", required: true, type: "date" },
      { key: "due_date", label: "Due date", required: true, type: "date" },
      { key: "liability_cents", label: "Liability cents", required: true, type: "money_cents" },
      { key: "paid_date", label: "Paid date", type: "date" },
      { key: "payment_reference", label: "Payment reference", type: "text" },
    ],
    records: [{ remittance_external_id: "CRA-2026-08", payroll_account_external_id: "PA-0001", period_end: "2026-08-31", due_date: "2026-09-15", liability_cents: 342100, paid_date: null, payment_reference: null }],
  },
  {
    id: "t4_slips", area: "Compliance", label: "T4 slips", primaryKey: "t4_external_id",
    description: "Calendar-year employee box balances and filing status.",
    importRule: "Import draft or historical filed slips; filed records are append-only versions.",
    columns: [
      { key: "t4_external_id", label: "T4 ID", required: true, type: "text" },
      { key: "payroll_account_external_id", label: "Payroll account ID", required: true, type: "text" },
      { key: "year", label: "Year", required: true, type: "integer" },
      { key: "employee_external_id", label: "Employee ID", required: true, type: "text" },
      { key: "box14_cents", label: "Box 14 cents", required: true, type: "money_cents" },
      { key: "box22_cents", label: "Box 22 cents", required: true, type: "money_cents" },
      { key: "status", label: "Status", required: true, type: "text" },
    ],
    records: [{ t4_external_id: "T4-2025-1002", payroll_account_external_id: "PA-0001", year: 2025, employee_external_id: "E-1002", box14_cents: 6210000, box22_cents: 1023200, status: "historical_filed" }],
  },
  {
    id: "roes", area: "Compliance", label: "Records of Employment", primaryKey: "roe_external_id",
    description: "Editable ROE draft fields, insurable-history controls and version status.",
    importRule: "Drafts may update by ID; submitted ROEs require a linked amendment version.",
    columns: [
      { key: "roe_external_id", label: "ROE ID", required: true, type: "text" },
      { key: "payroll_account_external_id", label: "Payroll account ID", required: true, type: "text" },
      { key: "employee_external_id", label: "Employee ID", required: true, type: "text" },
      { key: "first_day_worked", label: "First day", required: true, type: "date" },
      { key: "last_day_paid", label: "Last day paid", required: true, type: "date" },
      { key: "reason_code", label: "Reason code", required: true, type: "text" },
      { key: "insurable_hours", label: "Insurable hours", required: true, type: "text" },
      { key: "status", label: "Status", required: true, type: "text" },
    ],
    records: [{ roe_external_id: "ROE-1002-001", payroll_account_external_id: "PA-0001", employee_external_id: "E-1002", first_day_worked: "2026-01-12", last_day_paid: "2026-08-28", reason_code: "A00", insurable_hours: "412.50", status: "draft" }],
  },
  {
    id: "gl_entries", area: "Accounting", label: "General ledger entries", primaryKey: "journal_external_id",
    description: "Run-linked journal lines with account, debit and credit controls.",
    importRule: "Append balanced historical journals; approved run journals cannot be overwritten.",
    columns: [
      { key: "journal_external_id", label: "Journal ID", required: true, type: "text" },
      { key: "pay_run_external_id", label: "Pay run ID", required: true, type: "text" },
      { key: "line_number", label: "Line", required: true, type: "integer" },
      { key: "account_code", label: "Account", required: true, type: "text" },
      { key: "debit_cents", label: "Debit cents", required: true, type: "money_cents" },
      { key: "credit_cents", label: "Credit cents", required: true, type: "money_cents" },
    ],
    records: [{ journal_external_id: "GL-PR-2026-0017", pay_run_external_id: "PR-2026-0017", line_number: 1, account_code: "6000", debit_cents: 1210265, credit_cents: 0 }],
  },
  {
    id: "billing_events", area: "Administration", label: "Usage billing", primaryKey: "billing_event_external_id",
    description: "Finalized employee-payment events used for the $2.00 transaction charge.",
    importRule: "Append historical events; duplicate event IDs are rejected to prevent rebilling.",
    columns: [
      { key: "billing_event_external_id", label: "Billing event ID", required: true, type: "text" },
      { key: "pay_run_external_id", label: "Pay run ID", required: true, type: "text" },
      { key: "employee_external_id", label: "Employee ID", required: true, type: "text" },
      { key: "finalized_date", label: "Finalized date", required: true, type: "date" },
      { key: "amount_cents", label: "Amount cents", required: true, type: "money_cents" },
      { key: "reversed", label: "Reversed", required: true, type: "boolean" },
    ],
    records: [{ billing_event_external_id: "BE-16-1002", pay_run_external_id: "PR-2026-0016", employee_external_id: "E-1002", finalized_date: "2026-08-21", amount_cents: 200, reversed: false }],
  },
] as const satisfies readonly DataExchangeSection[];

function quoteCsv(value: CsvValue) {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildSectionCsv(section: DataExchangeSection, template = false) {
  const header = section.columns.map((column) => quoteCsv(column.key)).join(",");
  if (template) return `${header}\r\n`;
  const rows = section.records.map((record) => section.columns.map((column) => quoteCsv(record[column.key] ?? null)).join(","));
  return [header, ...rows].join("\r\n") + "\r\n";
}

export function buildAllSectionsCsv() {
  const keys = Array.from(new Set(dataExchangeSections.flatMap((section) => section.columns.map((column) => column.key))));
  const header = ["section", ...keys];
  const rows = dataExchangeSections.flatMap((section) => section.records.map((record) => [section.id, ...keys.map((key) => record[key] ?? null)]));
  return [header, ...rows].map((row) => row.map((value) => quoteCsv(value)).join(",")).join("\r\n") + "\r\n";
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value); value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = []; value = "";
    } else value += character;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted value.");
  if (value.length > 0 || row.length > 0) { row.push(value); rows.push(row); }
  return rows;
}

export function validateSectionCsv(section: DataExchangeSection, text: string) {
  let rows: string[][];
  try { rows = parseCsv(text); }
  catch (error) { return { valid: false, rowCount: 0, errors: [error instanceof Error ? error.message : "Unable to parse CSV."], warnings: [] as string[] }; }
  if (rows.length === 0) return { valid: false, rowCount: 0, errors: ["CSV is empty."], warnings: [] as string[] };
  const headers = rows[0].map((header) => header.trim());
  const errors: string[] = [];
  const warnings: string[] = [];
  const required = section.columns.filter((column) => column.required).map((column) => column.key);
  for (const key of required) if (!headers.includes(key)) errors.push(`Missing required column: ${key}`);
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length) errors.push(`Duplicate columns: ${Array.from(new Set(duplicateHeaders)).join(", ")}`);
  const unknown = headers.filter((header) => !section.columns.some((column) => column.key === header));
  if (unknown.length) warnings.push(`Ignored columns: ${unknown.join(", ")}`);
  rows.slice(1).forEach((dataRow, rowIndex) => {
    if (dataRow.length !== headers.length) errors.push(`Row ${rowIndex + 2} has ${dataRow.length} values; expected ${headers.length}.`);
    required.forEach((key) => {
      const columnIndex = headers.indexOf(key);
      if (columnIndex >= 0 && !(dataRow[columnIndex] ?? "").trim()) errors.push(`Row ${rowIndex + 2} is missing ${key}.`);
    });
  });
  if (rows.length === 1) warnings.push("Template contains no data rows.");
  return { valid: errors.length === 0, rowCount: Math.max(0, rows.length - 1), errors, warnings };
}
