import assert from "node:assert/strict";
import test from "node:test";
import { publicProfileBrowserUrl, publicProfilePath } from "../lib/profileSlug.ts";

test("public profile path prefers slug", () => {
  assert.equal(publicProfilePath("ria-spuropoulou", "abc"), "/in/ria-spuropoulou");
  assert.equal(publicProfilePath(null, "abc"), "/influencer/abc");
});

test("browser URL is always the canonical www website profile", () => {
  assert.equal(
    publicProfileBrowserUrl("ria-spuropoulou", "abc", "www.influo.gr"),
    "https://www.influo.gr/in/ria-spuropoulou"
  );
  assert.equal(
    publicProfileBrowserUrl(null, "abc", "influo.gr"),
    "https://www.influo.gr/influencer/abc"
  );
  assert.equal(
    publicProfileBrowserUrl("ria", "1", "preview.example.com"),
    "https://www.influo.gr/in/ria"
  );
});
