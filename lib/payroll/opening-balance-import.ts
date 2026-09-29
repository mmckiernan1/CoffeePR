import { dollarsToCents } from "./money.ts";

export const OPENING_BALANCE_CSV_HEADERS = [
  "employee_id",
  "employee_name",
  "as_of_date",
  "taxable_earnings",
  "pensionable_earnings",
  "insurable_earnings",
  "income_tax",
  "cpp",
  "cpp2",
  "ei",
] as const;

export type OpeningBalanceImportRow = {
  employeeId: string;
  employeeName: string;
  asOfDate: string;
  taxableEarningsCents: number;
  pensionableEarningsCents: number;
  insurableEarningsCents: number;
  incomeTaxCents: number;
  cppCents: number;
  cpp2Cents: number;
  eiCents: number;
};

export type OpeningBalanceImportResult = {
  rows: OpeningBalanceImportRow[];
  errors: string[];
};

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  return rows;
}

function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseNonNegativeMoney(value: string): number | null {
  try {
    const cents = dollarsToCents(value.trim() || "0");
    return cents >= 0 ? cents : null;
  } catch {
    return null;
  }
}

export function openingBalanceCsvTemplate(employees: Array<{ id: string; name: string }> = []) {
  const rows = employees.length > 0
    ? employees.map((employee) => `${employee.id},"${employee.name.replaceAll('"', '""')}",2026-08-31,0,0,0,0,0,0,0`)
    : ["EMP-0001,Avery Chen,2026-08-31,42000.00,42000.00,42000.00,6800.00,2300.00,0.00,680.00"];
  return `${OPENING_BALANCE_CSV_HEADERS.join(",")}\n${rows.join("\n")}\n`;
}

export function parseOpeningBalanceCsv(input: string, expectedEmployees: Array<{ id: string; name: string }> = []): OpeningBalanceImportResult {
  const rows = parseCsvRows(input.replace(/^\uFEFF/, ""));
  if (rows.length === 0) return { rows: [], errors: ["The CSV file is empty."] };

  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const missing = OPENING_BALANCE_CSV_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) return { rows: [], errors: [`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`] };

  const expectedById = new Map(expectedEmployees.map((employee) => [employee.id, employee.name]));
  const indexOf = (header: string) => headers.indexOf(header);
  const imported: OpeningBalanceImportRow[] = [];
  const errors: string[] = [];

  rows.slice(1).forEach((row, rowIndex) => {
    const line = rowIndex + 2;
    const employeeId = (row[indexOf("employee_id")] ?? "").trim();
    const employeeName = (row[indexOf("employee_name")] ?? "").trim();
    const asOfDate = (row[indexOf("as_of_date")] ?? "").trim();
    const moneyColumns = [
      "taxable_earnings",
      "pensionable_earnings",
      "insurable_earnings",
      "income_tax",
      "cpp",
      "cpp2",
      "ei",
    ] as const;
    const money = Object.fromEntries(moneyColumns.map((column) => [column, parseNonNegativeMoney(row[indexOf(column)] ?? "0")])) as Record<(typeof moneyColumns)[number], number | null>;

    if (!employeeId) errors.push(`Row ${line}: employee_id is required.`);
    if (!employeeName) errors.push(`Row ${line}: employee_name is required.`);
    if (!validIsoDate(asOfDate)) errors.push(`Row ${line}: as_of_date must use YYYY-MM-DD.`);
    for (const column of moneyColumns) {
      if (money[column] === null) errors.push(`Row ${line}: ${column} must be a non-negative dollar amount with no more than two decimals.`);
    }
    if (expectedById.size > 0 && employeeId && !expectedById.has(employeeId)) errors.push(`Row ${line}: employee_id ${employeeId} is not in this Coffee Payroll workspace.`);
    const expectedName = expectedById.get(employeeId);
    if (expectedName && employeeName && expectedName.trim().toLowerCase() !== employeeName.toLowerCase()) errors.push(`Row ${line}: employee_name does not match ${employeeId}.`);

    if (!employeeId || !employeeName || !validIsoDate(asOfDate) || moneyColumns.some((column) => money[column] === null) || (expectedById.size > 0 && !expectedById.has(employeeId)) || (expectedName && expectedName.trim().toLowerCase() !== employeeName.toLowerCase())) return;

    imported.push({
      employeeId,
      employeeName: employeeName.slice(0, 160),
      asOfDate,
      taxableEarningsCents: money.taxable_earnings as number,
      pensionableEarningsCents: money.pensionable_earnings as number,
      insurableEarningsCents: money.insurable_earnings as number,
      incomeTaxCents: money.income_tax as number,
      cppCents: money.cpp as number,
      cpp2Cents: money.cpp2 as number,
      eiCents: money.ei as number,
    });
  });

  const duplicateIds = imported.map((row) => row.employeeId).filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicateIds.length > 0) errors.push("The CSV contains duplicate employee IDs. Keep one opening-balance row per employee.");

  return { rows: imported, errors };
}
