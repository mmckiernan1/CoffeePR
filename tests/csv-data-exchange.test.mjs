import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => vite.close());

const exchange = await vite.ssrLoadModule("/lib/payroll/csv-data-exchange.ts");

test("every administrator record section has an importable schema and export", () => {
  assert.ok(exchange.dataExchangeSections.length >= 12);
  for (const section of exchange.dataExchangeSections) {
    assert.ok(section.columns.some((column) => column.key === section.primaryKey));
    const csv = exchange.buildSectionCsv(section);
    const validation = exchange.validateSectionCsv(section, csv);
    assert.equal(validation.valid, true, `${section.id}: ${validation.errors.join("; ")}`);
    assert.equal(validation.rowCount, section.records.length);
  }
});

test("templates include required columns and report that they have no data rows", () => {
  const section = exchange.dataExchangeSections.find((item) => item.id === "employees");
  const validation = exchange.validateSectionCsv(section, exchange.buildSectionCsv(section, true));
  assert.equal(validation.valid, true);
  assert.equal(validation.rowCount, 0);
  assert.match(validation.warnings.join(" "), /no data rows/i);
});

test("CSV parsing preserves commas and quotes in fields", () => {
  const rows = exchange.parseCsv('"id","name"\r\n"1","Prairie, North ""Services"""\r\n');
  assert.deepEqual(rows, [["id", "name"], ["1", 'Prairie, North "Services"']]);
});

test("all-record export carries a section discriminator", () => {
  const rows = exchange.parseCsv(exchange.buildAllSectionsCsv());
  assert.equal(rows[0][0], "section");
  const ids = new Set(rows.slice(1).map((row) => row[0]));
  for (const section of exchange.dataExchangeSections) assert.ok(ids.has(section.id));
});

test("validation blocks missing required keys", () => {
  const section = exchange.dataExchangeSections.find((item) => item.id === "employees");
  const result = exchange.validateSectionCsv(section, '"legal_name"\r\n"Noah Williams"\r\n');
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /employee_external_id/);
});
