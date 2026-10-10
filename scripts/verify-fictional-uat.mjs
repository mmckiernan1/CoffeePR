import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const configPath = resolve("dist/server/wrangler.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

function requireCondition(ok, message) {
  if (!ok) throw new Error(`Unsafe fictional UAT package: ${message}`);
}

requireCondition(config.name === "coffee-payroll-fictional-uat", "separate UAT Worker name is missing");
requireCondition(config.workers_dev === false, "workers.dev must remain disabled before Access protection");
requireCondition(config.preview_urls === false, "unprotected preview URLs must remain disabled");
requireCondition(!config.route && (!config.routes || config.routes.length === 0), "no custom routes are permitted");
requireCondition(!config.d1_databases || config.d1_databases.length === 0, "D1 must not be bound");
requireCondition(!config.r2_buckets || config.r2_buckets.length === 0, "R2 must not be bound");
requireCondition(!config.kv_namespaces || config.kv_namespaces.length === 0, "KV must not be bound");
requireCondition(!config.services || config.services.length === 0, "service bindings must not be present");
requireCondition(config.vars?.COFFEE_PAYROLL_UAT_ONLY === "true", "fictional route guard must be enabled");
requireCondition(config.assets?.run_worker_first === true, "Worker must check requests before serving assets");
requireCondition(typeof config.main === "string", "bundled Worker entry point is required");

const mainPath = resolve(dirname(configPath), config.main);
requireCondition(existsSync(mainPath), `bundled Worker entry not found: ${mainPath}`);

const mainSource = readFileSync(mainPath, "utf8");
const marker = "UAT_DEVICE_ONLY";
if (!mainSource.includes(marker)) {
  const containing = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (extname(path) === ".js" && readFileSync(path, "utf8").includes(marker)) containing.push(path);
    }
  }
  walk(dirname(configPath));
  requireCondition(false, `bundled entry does not contain route-guard marker; found in: ${containing.join(", ") || "(none)"}`);
}

console.log("Fictional UAT package verified: separate closed Worker, no DB/buckets/services, Worker-first route guard.");
