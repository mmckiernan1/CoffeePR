import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isFictionalUatPathAllowed } from "../lib/fictional-uat-route-guard.ts";

const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("fictional UAT allows its bundled CSS and JavaScript without exposing API or admin routes", () => {
  assert.equal(isFictionalUatPathAllowed("/assets/index-example.css"), true);
  assert.equal(isFictionalUatPathAllowed("/assets/app-example.js"), true);
  assert.equal(isFictionalUatPathAllowed("/_next/static/example.js"), true);
  assert.equal(isFictionalUatPathAllowed("/favicon.svg"), true);
  assert.equal(isFictionalUatPathAllowed("/admin"), false);
  assert.equal(isFictionalUatPathAllowed("/api/v1/configuration"), false);
});

test("Worker-first UAT routes allowed asset requests through the ASSETS binding", () => {
  const restrictedBlock = worker.slice(
    worker.indexOf('if (env.COFFEE_PAYROLL_UAT_ONLY === "true")'),
    worker.indexOf("return handler.fetch(request, env, ctx);"),
  );
  assert.match(restrictedBlock, /if \(!isFictionalUatPathAllowed\(path\)\)/);
  assert.match(restrictedBlock, /path\.startsWith\("\/assets\/"\)/);
  assert.match(restrictedBlock, /path\.startsWith\("\/_next\/static\/"\)/);
  assert.match(restrictedBlock, /return env\.ASSETS\.fetch\(request\)/);
  assert.ok(
    restrictedBlock.indexOf("if (!isFictionalUatPathAllowed(path))") <
      restrictedBlock.indexOf("return env.ASSETS.fetch(request)"),
    "the access guard must run before serving static assets",
  );
});
