import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(new URL("../app/api/v1/admin/state/route.ts", import.meta.url), "utf8");
const workspaceSource = await readFile(new URL("../app/admin/workspace.tsx", import.meta.url), "utf8");

test("admin state reads cannot initialize or mutate business data", () => {
  const stateBody = routeSource.slice(routeSource.indexOf("async function state("), routeSource.indexOf("function controlledInteger"));
  const getBody = routeSource.slice(routeSource.indexOf("export async function GET"), routeSource.indexOf("export async function POST"));

  assert.doesNotMatch(stateBody, /ensureFictionalWorkspace|ensureInitialDraft|\b(?:INSERT|UPDATE|DELETE)\b/i);
  assert.doesNotMatch(getBody, /ensureFictionalWorkspace|ensureInitialDraft|\b(?:INSERT|UPDATE|DELETE)\b/i);
  assert.match(stateBody, /organizationConfigured: Boolean\(organization\)/);
});

test("demo initialization is an explicit Administrator-only action", () => {
  assert.match(routeSource, /body\.action === "initialize_demo_workspace"/);
  assert.match(routeSource, /actor\.role !== "Administrator"/);
  assert.match(routeSource, /await ensureFictionalWorkspace\(actor\.email\);\s+await ensureInitialDraft\(actor\.email\);/);
  assert.match(workspaceSource, /No organization has been configured/);
  assert.match(workspaceSource, /post\(\{ action: "initialize_demo_workspace" \}\)/);
});
