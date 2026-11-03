import { test } from "node:test";
import assert from "node:assert/strict";
import { splitLinks, firstLink, isPrivateHost, parseMeta } from "../lib/linkify.ts";
test("split links", () => {
  const p = splitLinks("δες https://influo.gr/campaigns. ok");
  assert.deepEqual(p.map((x) => x.type), ["text", "link", "text"]);
  assert.equal(p[1].value, "https://influo.gr/campaigns");
  assert.equal(firstLink("no link"), null);
});
test("ssrf guard", () => {
  for (const h of ["localhost", "127.0.0.1", "10.1.2.3", "192.168.1.1", "169.254.169.254", "::1", "172.20.0.1"]) assert.ok(isPrivateHost(h), h);
  assert.equal(isPrivateHost("influo.gr"), false);
  assert.equal(isPrivateHost("8.8.8.8"), false);
});
test("parse meta", () => {
  const m = parseMeta(`<title>T</title><meta property="og:title" content="Hello &amp; you"><meta name="description" content="D">`);
  assert.equal(m.title, "Hello & you");
  assert.equal(m.description, "D");
});
