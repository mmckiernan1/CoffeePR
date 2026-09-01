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

function drawLine(x1: number, y1: number, x2: number, y2: number, colour = "0.87 0.84 0.91") {
  return `q ${colour} RG 0.7 w ${x1} ${y1} m ${x2} ${y2} l S Q`;
}

function truncate(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, Math.max(0, limit - 3))}...` : value;
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

  const stream = `${commands.join("\n")}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];

  let output = "%PDF-1.4\n%1234\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(output);
}
