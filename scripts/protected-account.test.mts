import assert from "node:assert/strict";
import test from "node:test";
import { isProtectedTestAccount } from "../lib/protectedAccount.ts";

test("protects the account named test", () => {
  assert.equal(isProtectedTestAccount({ display_name: "test" }), true);
  assert.equal(isProtectedTestAccount({ display_name: "Test" }), true);
  assert.equal(isProtectedTestAccount({ brand_name: "test", contact_email: "other@example.com" }), true);
  assert.equal(isProtectedTestAccount({ contact_email: "test@influo.gr" }), true);
  assert.equal(isProtectedTestAccount({ display_name: "Test User", contact_email: "maria@example.com" }), false);
});
