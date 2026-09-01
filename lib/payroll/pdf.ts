export type PdfMetadataItem = {
  label: string;
  value: string;
};

export type PdfReportRow = {
  label: string;
  detail?: string;
  value: string;
  emphasis?: boolean;
};

export type PdfReportSection = {
  title: string;
  rows: PdfReportRow[];
};

export type PdfReportDefinition = {
  clientName: string;
  title: string;
  subtitle: string;
  metadata: PdfMetadataItem[];
  sections: PdfReportSection[];
  footer: string;
};

const PAGE_WIDTH = 612;

function ascii(value: string) {
  return value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7e]/g, " ");
}

function pdfText(value: string) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function drawText(x: number, y: number, size: number, value: string, options: { bold?: boolean; colour?: string } = {}) {
  const font = options.bold ? "F2" : "F1";
  const colour = options.colour ?? "0.18 0.14 0.28";
  return `BT /${font} ${size} Tf ${colour} rg 1 0 0 1 ${x} ${y} Tm (${pdfText(value)}) Tj ET`;
}

function drawRect(x: number, y: number, width: number, height: number, colour: string) {
  return `q ${colour} rg ${x} ${y} ${width} ${height} re f Q`;
}

function drawStrokeRect(x: number, y: number, width: number, height: number, colour = "0.50 0.62 0.72", lineWidth = 1) {
  return `q ${colour} RG ${lineWidth} w ${x} ${y} ${width} ${height} re S Q`;
}

function drawLine(x1: number, y1: number, x2: number, y2: number, colour = "0.87 0.84 0.91") {
  return `q ${colour} RG 0.7 w ${x1} ${y1} m ${x2} ${y2} l S Q`;
}

function truncate(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, Math.max(0, limit - 3))}...` : value;
}

function assemblePdf(pageStreams: readonly string[]) {
  const pageCount = pageStreams.length;
  const regularFontId = 3 + pageCount;
  const boldFontId = 4 + pageCount;
  const firstContentId = 5 + pageCount;
  const pageIds = Array.from({ length: pageCount }, (_, index) => index + 3);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    ...pageStreams.map((_, index) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${firstContentId + index} 0 R >>`),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ...pageStreams.map((stream) => `<< /Length ${stream.length} >>\nstream\n${stream}endstream`),
  ];

  let output = "%PDF-1.4\n%1234\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(output);
}

export function buildBrandedPdf(definition: PdfReportDefinition) {
  const commands: string[] = [];
  commands.push(drawRect(0, 724, PAGE_WIDTH, 68, "0.43 0.29 1.00"));
  commands.push(drawRect(0, 716, PAGE_WIDTH, 8, "0.00 0.66 0.65"));
  commands.push(drawText(42, 761, 16, definition.clientName, { bold: true, colour: "1 1 1" }));
  commands.push(drawText(42, 742, 8, "COMCHEQ PAYROLL", { bold: true, colour: "0.80 0.95 0.94" }));
  commands.push(drawText(42, 682, 22, definition.title, { bold: true }));
  commands.push(drawText(42, 663, 9, definition.subtitle, { colour: "0.45 0.40 0.50" }));

  let y = 632;
  definition.metadata.slice(0, 6).forEach((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = column === 0 ? 42 : 318;
    const itemY = y - row * 38;
    commands.push(drawRect(x, itemY - 17, 252, 32, "0.96 0.94 1.00"));
    commands.push(drawText(x + 10, itemY + 3, 7, item.label.toUpperCase(), { bold: true, colour: "0.35 0.22 0.64" }));
    commands.push(drawText(x + 10, itemY - 11, 9, truncate(item.value, 38), { bold: true }));
  });
  y -= Math.ceil(Math.min(definition.metadata.length, 6) / 2) * 38 + 5;

  for (const section of definition.sections) {
    commands.push(drawRect(42, y - 4, 528, 24, "0.93 0.91 1.00"));
    commands.push(drawText(52, y + 4, 9, section.title.toUpperCase(), { bold: true, colour: "0.31 0.18 0.63" }));
    y -= 25;
    section.rows.forEach((row) => {
      commands.push(drawText(52, y, row.emphasis ? 9 : 8.5, truncate(row.label, 38), { bold: row.emphasis }));
      if (row.detail) commands.push(drawText(302, y, 8, truncate(row.detail, 24), { colour: "0.45 0.40 0.50" }));
      commands.push(drawText(487, y, row.emphasis ? 9 : 8.5, truncate(row.value, 16), { bold: true, colour: row.emphasis ? "0.31 0.18 0.63" : undefined }));
      commands.push(drawLine(52, y - 7, 560, y - 7));
      y -= 20;
    });
    y -= 10;
  }

  commands.push(drawLine(42, 44, 570, 44, "0.78 0.72 0.88"));
  commands.push(drawText(42, 28, 7, truncate(definition.footer, 112), { colour: "0.45 0.40 0.50" }));
  commands.push(drawText(510, 12, 7, "Page 1 of 1", { colour: "0.45 0.40 0.50" }));

  return assemblePdf([`${commands.join("\n")}\n`]);
}

export type PayrollRegisterEmployee = {
  employeeNumber: string;
  employeeName: string;
  regularHours: string;
  overtimeHours: string;
  gross: string;
  incomeTax: string;
  cpp: string;
  ei: string;
  otherDeductions: string;
  netPay: string;
};

export function buildPayrollRegisterPdf(input: {
  clientName: string;
  period: string;
  payDate: string;
  runLabel: string;
  employees: readonly PayrollRegisterEmployee[];
  grossTotal: string;
  deductionTotal: string;
  netTotal: string;
}) {
  if (!input.employees.length) throw new Error("A payroll register requires at least one employee.");
  const sorted = [...input.employees].sort((left, right) => left.employeeNumber.localeCompare(right.employeeNumber, "en-CA", { numeric: true }));
  const chunks = Array.from({ length: Math.ceil(sorted.length / 8) }, (_, index) => sorted.slice(index * 8, index * 8 + 8));
  const pageStreams = chunks.map((employees, pageIndex) => {
    const commands: string[] = [];
    commands.push(drawRect(0, 724, PAGE_WIDTH, 68, "0.29 0.46 0.60"));
    commands.push(drawRect(0, 716, PAGE_WIDTH, 8, "0.56 0.68 0.45"));
    commands.push(drawText(42, 760, 16, input.clientName, { bold: true, colour: "1 1 1" }));
    commands.push(drawText(42, 741, 8, "COMCHEQ PAYROLL REGISTER", { bold: true, colour: "0.91 0.96 0.99" }));
    commands.push(drawText(42, 687, 19, `Payroll register - ${input.runLabel}`, { bold: true }));
    commands.push(drawText(42, 668, 8.5, `${input.period}  |  Pay date ${input.payDate}  |  Sorted by employee number`, { colour: "0.34 0.39 0.44" }));

    employees.forEach((employee, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = column === 0 ? 42 : 312;
      const bottom = 525 - row * 128;
      const width = 258;
      const height = 116;
      commands.push(drawRect(x, bottom, width, height, "0.985 0.990 0.994"));
      commands.push(drawStrokeRect(x, bottom, width, height, "0.43 0.57 0.68", 1.2));
      commands.push(drawRect(x, bottom + 92, width, 24, "0.91 0.95 0.98"));
      commands.push(drawText(x + 10, bottom + 101, 8, employee.employeeNumber, { bold: true, colour: "0.19 0.37 0.52" }));
      commands.push(drawText(x + 72, bottom + 101, 9, truncate(employee.employeeName, 28), { bold: true }));
      commands.push(drawLine(x + 129, bottom + 8, x + 129, bottom + 87, "0.82 0.87 0.91"));
      const left = [["Regular hours", employee.regularHours], ["Overtime hours", employee.overtimeHours], ["Gross earnings", employee.gross]];
      const right = [["Income tax", employee.incomeTax], ["CPP / CPP2", employee.cpp], ["EI", employee.ei], ["Other deductions", employee.otherDeductions], ["NET PAY", employee.netPay]];
      left.forEach(([label, value], item) => {
        const y = bottom + 75 - item * 22;
        commands.push(drawText(x + 10, y, 6.5, label.toUpperCase(), { bold: true, colour: "0.39 0.44 0.49" }));
        commands.push(drawText(x + 10, y - 11, 8, value, { bold: item === 2, colour: item === 2 ? "0.19 0.37 0.52" : undefined }));
      });
      right.forEach(([label, value], item) => {
        const y = bottom + 80 - item * 16;
        commands.push(drawText(x + 139, y, 6.2, label, { bold: item === 4, colour: item === 4 ? "0.19 0.37 0.52" : "0.39 0.44 0.49" }));
        commands.push(drawText(x + 205, y, 7, value, { bold: true, colour: item === 4 ? "0.19 0.37 0.52" : undefined }));
      });
    });

    if (pageIndex === chunks.length - 1) {
      commands.push(drawRect(42, 58, 528, 45, "0.91 0.95 0.98"));
      commands.push(drawStrokeRect(42, 58, 528, 45, "0.43 0.57 0.68", 1));
      const totals = [["GROSS TOTAL", input.grossTotal], ["DEDUCTIONS", input.deductionTotal], ["NET PAY TOTAL", input.netTotal]];
      totals.forEach(([label, value], index) => {
        const x = 58 + index * 174;
        commands.push(drawText(x, 86, 7, label, { bold: true, colour: "0.32 0.40 0.47" }));
        commands.push(drawText(x, 69, 11, value, { bold: true, colour: index === 2 ? "0.19 0.37 0.52" : undefined }));
      });
    }
    commands.push(drawText(42, 28, 7, "Fictional payroll register preview. Approved registers are retained with the numbered pay run.", { colour: "0.42 0.46 0.50" }));
    commands.push(drawText(510, 12, 7, `Page ${pageIndex + 1} of ${chunks.length}`, { colour: "0.42 0.46 0.50" }));
    return `${commands.join("\n")}\n`;
  });
  return assemblePdf(pageStreams);
}
