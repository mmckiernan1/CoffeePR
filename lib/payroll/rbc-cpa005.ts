import { assertMoneyCents, sumCents, type MoneyCents } from "./money.ts";

export const RBC_CPA005_SPEC = {
  adapter: "RBC CPA005 Credit",
  logicalRecordLength: 1464,
  paymentsPerLogicalRecord: 6,
  defaultTransactionCode: "200",
  defaultTransactionDescription: "Payroll Deposit",
  sourceUrl: "https://www.rbcroyalbank.com/ach/file-451770.pdf",
  transactionCodesUrl: "https://www.rbcroyalbank.com/ach/file-450194.pdf",
} as const;

export interface RbcCpa005Config {
  mode: "test" | "production";
  clientNumber: string;
  fileCreationNumber: string;
  fileCreationDate: string;
  processingCentre: string;
  destinationCurrency: "CAD" | "USD";
  clientShortName: string;
  clientLegalName: string;
  includeRoutingRecord?: boolean;
}

export interface RbcCpa005Payment {
  employeeId: string;
  customerName: string;
  amountCents: MoneyCents;
  paymentDate: string;
  institutionNumber: string;
  branchTransit: string;
  accountNumber: string;
  transactionCode?: string;
  customerNumber?: string;
  sundryInformation?: string;
}

export interface RbcCpa005File {
  content: string;
  logicalRecords: readonly string[];
  control: {
    paymentCount: number;
    totalAmountCents: MoneyCents;
    logicalRecordCount: number;
    mode: "test" | "production";
  };
}

const RECORD_LENGTH = RBC_CPA005_SPEC.logicalRecordLength;
const SEGMENT_LENGTH = 240;

function numeric(value: string | number, length: number, label: string): string {
  const raw = String(value);
  if (!/^\d+$/.test(raw)) throw new Error(`${label} must contain digits only.`);
  if (raw.length > length) throw new Error(`${label} exceeds ${length} digits.`);
  return raw.padStart(length, "0");
}

function normalizeAlpha(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 &'().,+\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function alpha(value: string, length: number, label: string, required = false): string {
  const raw = normalizeAlpha(value);
  if (required && !raw) throw new Error(`${label} is required.`);
  if (raw.length > length) throw new Error(`${label} exceeds ${length} characters; do not silently abbreviate a legal name.`);
  return raw.padEnd(length, " ");
}

function parseIsoDate(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error(`${label} is not a valid date.`);
  return date;
}

export function toRbcJulianDate(value: string): string {
  const date = parseIsoDate(value, "date");
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const ordinal = Math.floor((date.valueOf() - yearStart) / 86_400_000) + 1;
  return `0${String(date.getUTCFullYear()).slice(-2)}${String(ordinal).padStart(3, "0")}`;
}

function validateConfig(config: RbcCpa005Config): void {
  if (!/^\d{10}$/.test(config.clientNumber)) throw new Error("RBC client number must be 10 digits.");
  if (!/^\d{5}$/.test(config.processingCentre)) throw new Error("RBC processing centre must be 5 digits.");
  if (config.mode === "test" && config.fileCreationNumber !== "TEST") throw new Error("RBC test files must use file creation number TEST.");
  if (config.mode === "production" && !/^\d{4}$/.test(config.fileCreationNumber)) throw new Error("RBC production file creation number must be 4 digits.");
  if (config.mode === "production" && config.clientNumber === "0000000000") throw new Error("A production file requires the RBC-assigned client number.");
  parseIsoDate(config.fileCreationDate, "fileCreationDate");
  alpha(config.clientShortName, 15, "clientShortName", true);
  alpha(config.clientLegalName, 30, "clientLegalName", true);
}

function validatePayment(payment: RbcCpa005Payment): void {
  assertMoneyCents(payment.amountCents, `${payment.employeeId}.amountCents`);
  if (payment.amountCents <= 0) throw new Error(`${payment.employeeId}.amountCents must be greater than zero.`);
  numeric(payment.amountCents, 10, `${payment.employeeId}.amountCents`);
  if (!/^\d{3}$/.test(payment.institutionNumber)) throw new Error(`${payment.employeeId}.institutionNumber must be 3 digits.`);
  if (!/^\d{5}$/.test(payment.branchTransit)) throw new Error(`${payment.employeeId}.branchTransit must be 5 digits.`);
  if (!/^\d{1,12}$/.test(payment.accountNumber)) throw new Error(`${payment.employeeId}.accountNumber must contain 1 to 12 digits.`);
  if (!/^\d{3}$/.test(payment.transactionCode ?? "200")) throw new Error(`${payment.employeeId}.transactionCode must be 3 digits.`);
  parseIsoDate(payment.paymentDate, `${payment.employeeId}.paymentDate`);
  alpha(payment.customerName, 30, `${payment.employeeId}.customerName`, true);
  alpha(payment.customerNumber ?? payment.employeeId, 19, `${payment.employeeId}.customerNumber`);
  alpha(payment.sundryInformation ?? "PAYROLL", 15, `${payment.employeeId}.sundryInformation`);
}

function headerRecord(config: RbcCpa005Config): string {
  const value = [
    "A",
    numeric(1, 9, "recordCount"),
    alpha(config.clientNumber, 10, "clientNumber", true),
    alpha(config.fileCreationNumber, 4, "fileCreationNumber", true),
    numeric(toRbcJulianDate(config.fileCreationDate), 6, "fileCreationDate"),
    numeric(config.processingCentre, 5, "processingCentre"),
    " ".repeat(20),
    alpha(config.destinationCurrency, 3, "destinationCurrency", true),
    " ".repeat(1406),
  ].join("");
  if (value.length !== RECORD_LENGTH) throw new Error("RBC header record length invariant failed.");
  return value;
}

function paymentSegment(config: RbcCpa005Config, payment: RbcCpa005Payment): string {
  const value = [
    alpha(payment.transactionCode ?? "200", 3, "transactionCode", true),
    numeric(payment.amountCents, 10, "amountCents"),
    numeric(toRbcJulianDate(payment.paymentDate), 6, "paymentDate"),
    numeric(`0${payment.institutionNumber}${payment.branchTransit}`, 9, "destinationRouting"),
    alpha(payment.accountNumber, 12, "accountNumber", true),
    "0".repeat(22),
    "0".repeat(3),
    alpha(config.clientShortName, 15, "clientShortName", true),
    alpha(payment.customerName, 30, "customerName", true),
    alpha(config.clientLegalName, 30, "clientLegalName", true),
    alpha(config.clientNumber, 10, "clientNumber", true),
    alpha(payment.customerNumber ?? payment.employeeId, 19, "customerNumber"),
    "0".repeat(9),
    " ".repeat(12),
    alpha(payment.sundryInformation ?? "PAYROLL", 15, "sundryInformation"),
    " ".repeat(22),
    " ".repeat(2),
    " ".repeat(11),
  ].join("");
  if (value.length !== SEGMENT_LENGTH) throw new Error("RBC payment segment length invariant failed.");
  return value;
}

function unusedPaymentSegment(): string {
  const value = [
    " ".repeat(3), "0".repeat(10), "0".repeat(6), "0".repeat(9), " ".repeat(12),
    "0".repeat(22), "0".repeat(3), " ".repeat(15), " ".repeat(30), " ".repeat(30),
    " ".repeat(10), " ".repeat(19), "0".repeat(9), " ".repeat(12), " ".repeat(15),
    " ".repeat(22), " ".repeat(2), " ".repeat(11),
  ].join("");
  if (value.length !== SEGMENT_LENGTH) throw new Error("RBC unused segment length invariant failed.");
  return value;
}

function paymentRecord(config: RbcCpa005Config, payments: readonly RbcCpa005Payment[], recordCount: number): string {
  const segments = [...payments.map((payment) => paymentSegment(config, payment))];
  while (segments.length < 6) segments.push(unusedPaymentSegment());
  const value = [
    "C",
    numeric(recordCount, 9, "recordCount"),
    alpha(config.clientNumber, 10, "clientNumber", true),
    alpha(config.fileCreationNumber, 4, "fileCreationNumber", true),
    ...segments,
  ].join("");
  if (value.length !== RECORD_LENGTH) throw new Error("RBC payment record length invariant failed.");
  return value;
}

function trailerRecord(config: RbcCpa005Config, recordCount: number, paymentCount: number, totalAmountCents: MoneyCents): string {
  const value = [
    "Z",
    numeric(recordCount, 9, "recordCount"),
    alpha(config.clientNumber, 10, "clientNumber", true),
    alpha(config.fileCreationNumber, 4, "fileCreationNumber", true),
    "0".repeat(14),
    "0".repeat(8),
    numeric(totalAmountCents, 14, "totalAmountCents"),
    numeric(paymentCount, 8, "paymentCount"),
    "0".repeat(1396),
  ].join("");
  if (value.length !== RECORD_LENGTH) throw new Error("RBC trailer record length invariant failed.");
  return value;
}

export function generateRbcCpa005CreditFile(
  config: RbcCpa005Config,
  payments: readonly RbcCpa005Payment[],
): RbcCpa005File {
  validateConfig(config);
  if (!payments.length) throw new Error("At least one credit payment is required.");
  payments.forEach(validatePayment);

  const logicalRecords: string[] = [headerRecord(config)];
  for (let index = 0; index < payments.length; index += 6) {
    logicalRecords.push(paymentRecord(config, payments.slice(index, index + 6), logicalRecords.length + 1));
  }
  const totalAmountCents = sumCents(payments.map((payment) => payment.amountCents));
  logicalRecords.push(trailerRecord(config, logicalRecords.length + 1, payments.length, totalAmountCents));

  const routingRecord = `$$AA01CPA1464[${config.mode === "test" ? "TEST" : "PROD"}[NL$$`;
  const lines = config.includeRoutingRecord === false ? logicalRecords : [routingRecord, ...logicalRecords];
  const file: RbcCpa005File = {
    content: lines.join("\r\n"),
    logicalRecords,
    control: {
      paymentCount: payments.length,
      totalAmountCents,
      logicalRecordCount: logicalRecords.length,
      mode: config.mode,
    },
  };
  validateRbcCpa005CreditFile(file.content, config.includeRoutingRecord !== false);
  return file;
}

export function validateRbcCpa005CreditFile(content: string, hasRoutingRecord = true): RbcCpa005File["control"] {
  const lines = content.split(/\r?\n/).filter((line, index, all) => !(index === all.length - 1 && line === ""));
  if (hasRoutingRecord) {
    if (!/^\$\$AA01CPA1464\[(TEST|PROD)\[NL\$\$$/.test(lines[0] ?? "")) throw new Error("Invalid RBC file transmission routing record.");
    lines.shift();
  }
  if (lines.length < 3 || lines[0][0] !== "A" || lines.at(-1)?.[0] !== "Z") throw new Error("RBC file must contain A, C and Z logical records in order.");
  lines.forEach((line, index) => {
    if (line.length !== RECORD_LENGTH) throw new Error(`Logical record ${index + 1} must be ${RECORD_LENGTH} characters.`);
    if (Number(line.slice(1, 10)) !== index + 1) throw new Error(`Logical record ${index + 1} has an invalid record count.`);
  });
  const paymentRecords = lines.slice(1, -1);
  if (paymentRecords.some((record) => record[0] !== "C")) throw new Error("Only C payment records are allowed between the header and trailer.");

  let paymentCount = 0;
  let totalAmountCents = 0;
  for (const record of paymentRecords) {
    for (let segment = 0; segment < 6; segment += 1) {
      const offset = 24 + segment * SEGMENT_LENGTH;
      const transactionCode = record.slice(offset, offset + 3).trim();
      if (!transactionCode) continue;
      if (!/^\d{3}$/.test(transactionCode)) throw new Error("Payment transaction code is invalid.");
      paymentCount += 1;
      totalAmountCents += Number(record.slice(offset + 3, offset + 13));
    }
  }
  const trailer = lines.at(-1)!;
  const trailerTotal = Number(trailer.slice(46, 60));
  const trailerCount = Number(trailer.slice(60, 68));
  if (trailerTotal !== totalAmountCents) throw new Error("RBC trailer amount does not balance to the payment records.");
  if (trailerCount !== paymentCount) throw new Error("RBC trailer payment count does not balance to the payment records.");

  return {
    paymentCount,
    totalAmountCents,
    logicalRecordCount: lines.length,
    mode: lines[0].slice(20, 24) === "TEST" ? "test" : "production",
  };
}
