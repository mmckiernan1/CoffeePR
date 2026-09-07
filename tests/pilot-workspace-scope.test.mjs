import assert from "node:assert/strict";
import test from "node:test";
import { pilotWorkspaceScope } from "../lib/pilot/workspace-scope.ts";

test("pilot workspace scope is stable for the same authenticated user", () => {
  const first = pilotWorkspaceScope("user-alpha");
  const second = pilotWorkspaceScope("user-alpha");
  assert.deepEqual(first, second);
  assert.equal(first.workspaceId, "WS-PILOT-user-alpha");
  assert.equal(first.stateId, "UAT-user-alpha");
  assert.equal(first.paymentStateId, "PAY-UAT-user-alpha");
});

test("different authenticated users receive disjoint pilot row ids", () => {
  const alpha = pilotWorkspaceScope("user-alpha");
  const beta = pilotWorkspaceScope("user-beta");

  for (const key of Object.keys(alpha)) {
    assert.notEqual(alpha[key], beta[key], `${key} must not be shared across users`);
  }
});

test("pilot workspace scope rejects an empty authenticated user id", () => {
  assert.throws(() => pilotWorkspaceScope("   "), /Authenticated user id is required/);
});
