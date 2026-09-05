import type { PilotUatEmployee } from "@/lib/payroll/pilot-uat";

export const EMPLOYEE_CSV_HEADERS = ["employee_name", "pay_type", "rate", "hire_date"] as const;

export type EmployeeImportResult = {
  employees: PilotUatEmployee[];
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

export function employeeCsvTemplate() {
  return `${EMPLOYEE_CSV_HEADERS.join(",")}\nAvery Chen,Salary,80000,2024-01-08\nNoah Williams,Hourly,30.00,2024-05-13\n`;
}

export function parseEmployeeCsv(input: string, startingNumber = 1): EmployeeImportResult {
  const rows = parseCsvRows(input.replace(/^\uFEFF/, ""));
  if (rows.length === 0) return { employees: [], errors: ["The CSV file is empty."] };

  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const missing = EMPLOYEE_CSV_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) return { employees: [], errors: [`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`] };

  const indexOf = (header: string) => headers.indexOf(header);
  const employees: PilotUatEmployee[] = [];
  const errors: string[] = [];

  rows.slice(1).forEach((row, rowIndex) => {
    const line = rowIndex + 2;
    const name = (row[indexOf("employee_name")] ?? "").trim();
    const rawPayType = (row[indexOf("pay_type")] ?? "").trim().toLowerCase();
    const rawRate = (row[indexOf("rate")] ?? "").trim().replace(/[$,]/g, "");
    const hireDate = (row[indexOf("hire_date")] ?? "").trim();
    const payType = rawPayType === "salary" ? "Salary" : rawPayType === "hourly" ? "Hourly" : null;
    const rate = Number(rawRate);

    if (!name) errors.push(`Row ${line}: employee_name is required.`);
    if (!payType) errors.push(`Row ${line}: pay_type must be Salary or Hourly.`);
    if (!Number.isFinite(rate) || rate <= 0) errors.push(`Row ${line}: rate must be greater than zero.`);
    if (!validIsoDate(hireDate)) errors.push(`Row ${line}: hire_date must use YYYY-MM-DD.`);
    if (!name || !payType || !Number.isFinite(rate) || rate <= 0 || !validIsoDate(hireDate)) return;

    const id = `EMP-${String(startingNumber + employees.length).padStart(4, "0")}`;
    employees.push({
      id,
      name: name.slice(0, 160),
      payType,
      rate,
      rateHistory: [{ effectiveDate: hireDate, rate }],
      status: "Active",
      hireDate,
      taxSetupComplete: false,
    });
  });

  const duplicateNames = employees.map((employee) => employee.name.toLowerCase()).filter((name, index, all) => all.indexOf(name) !== index);
  if (duplicateNames.length > 0) errors.push("The CSV contains duplicate employee names. Remove duplicates before importing.");

  return { employees, errors };
}
