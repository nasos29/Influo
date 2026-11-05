import assert from "node:assert/strict";
import test from "node:test";
import { publicProfileBrowserUrl, publicProfilePath } from "../lib/profileSlug.ts";

test("public profile path prefers slug", () => {
  assert.equal(publicProfilePath("ria-spuropoulou", "abc"), "/in/ria-spuropoulou");
  assert.equal(publicProfilePath(null, "abc"), "/influencer/abc");
});

test("browser URL leaves www PWA via apex host", () => {
  assert.equal(
    publicProfileBrowserUrl("ria-spuropoulou", "abc", "www.influo.gr"),
    "https://influo.gr/in/ria-spuropoulou"
  );
});

test("browser URL leaves apex PWA via www host", () => {
  assert.equal(
    publicProfileBrowserUrl(null, "abc", "influo.gr"),
    "https://www.influo.gr/influencer/abc"
  );
});

test("browser URL keeps unknown hosts absolute on themselves", () => {
  assert.equal(
    publicProfileBrowserUrl("ria", "1", "preview.example.com"),
    "https://preview.example.com/in/ria"
  );
});
