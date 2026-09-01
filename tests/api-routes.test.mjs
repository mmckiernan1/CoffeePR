import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("api-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const context = { waitUntil() {}, passThroughOnException() {} };

async function get(path) {
  return worker.fetch(new Request(`http://localhost${path}`), env, context);
}

test("health endpoint identifies the fictional foundation", async () => {
  const response = await get("/api/v1/health");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.environment, "public-fictional-prototype");
  assert.match(body.capabilities.rbcBankAdapter, /test-mode$/);
});

test("OpenAPI endpoint distinguishes implemented demos from planned contracts", async () => {
  const response = await get("/api/v1/openapi");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.openapi, "3.1.0");
  assert.equal(body.paths["/api/v1/pay-runs/{payRunId}/approve"].post["x-comcheq-maturity"], "planned");
});

test("demo endpoint returns a balanced RBC CPA005 TEST download", async () => {
  const response = await get("/api/v1/demo/rbc-cpa005");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-comcheq-file-mode"), "TEST");
  assert.equal(response.headers.get("x-comcheq-payment-count"), "4");
  const lines = (await response.text()).split("\r\n");
  assert.equal(lines[0], "$$AA01CPA1464[TEST[NL$$");
  assert.deepEqual(lines.slice(1).map((line) => line.length), [1464, 1464, 1464]);
  assert.deepEqual(lines.slice(1).map((line) => line[0]), ["A", "C", "Z"]);
});

test("Alberta calculation demo returns pinned rules and CRA-reconciled values", async () => {
  const response = await get("/api/v1/demo/alberta-calculation");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.environment, "public-fictional-prototype");
  assert.equal(body.calculation.ruleset.version, "CRA-T4127-2026-AB-v1");
  assert.equal(body.calculation.audit.formulaSelectedBy, "employee-facts");
  assert.equal(body.calculation.deductions.cppCents, 7_335);
  assert.equal(body.calculation.deductions.eiCents, 2_119);
  assert.equal(body.calculation.deductions.incomeTaxCents, 17_020);
});
