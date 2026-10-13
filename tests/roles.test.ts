import { test } from "node:test";
import assert from "node:assert/strict";
import { roles, isRole, canAccessRole } from "../src/config/roles";
test("Only explicit database roles are accepted", () => {
  for (const value of [
    null,
    undefined,
    "owner",
    "ADMIN",
    {},
    "admin/../teacher",
  ])
    assert.equal(isRole(value), false);
  for (const role of roles) assert.equal(isRole(role), true);
});
test("All 16 role-route combinations enforce exact role", () => {
  for (const actual of roles)
    for (const requested of roles)
      assert.equal(canAccessRole(actual, requested), actual === requested);
});
