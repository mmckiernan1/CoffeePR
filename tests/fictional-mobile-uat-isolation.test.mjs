import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isFictionalUatDeviceApi,
  isFictionalUatPathAllowed,
} from "../lib/fictional-uat-route-guard.ts";

test("isolated fictional UAT allows only the mobile payroll journey and required assets", () => {
  for (const path of [
    "/uat",
    "/uat/fictional",
    "/uat/time",
    "/uat/review",
    "/uat/payments",
    "/uat/complete",
    "/uat/reports",
    "/guided-payroll",
    "/_next/static/chunk.js",
    "/assets/app.css",
    "/favicon.svg",
  ]) assert.equal(isFictionalUatPathAllowed(path), true, path);

  for (const path of [
    "/admin",
    "/login",
    "/setup",
    "/onboarding",
    "/api/v1/health",
    "/api/v1/admin/state",
    "/reports",
  ]) assert.equal(isFictionalUatPathAllowed(path), false, path);
});

test("isolated fictional UAT keeps pilot APIs device-only", () => {
  assert.equal(isFictionalUatDeviceApi("/api/pilot/workspace"), true);
  assert.equal(isFictionalUatDeviceApi("/api/pilot/payments"), true);
  assert.equal(isFictionalUatDeviceApi("/api/v1/health"), false);
});

test("fictional UAT wrangler config cannot publish or bind production D1", async () => {
  const config = JSON.parse(await readFile(new URL("../wrangler.uat.jsonc", import.meta.url), "utf8"));
  assert.equal(config.name, "coffee-payroll-fictional-uat");
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.vars?.COFFEE_PAYROLL_UAT_ONLY, "true");
  assert.equal(config.assets?.run_worker_first, true);
  assert.equal("d1_databases" in config, false);
  assert.equal("routes" in config, false);
});
