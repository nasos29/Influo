import assert from "node:assert/strict";
import test from "node:test";
import { handleOpenInBrowserClick } from "../lib/openInBrowser.ts";

test("click handler prevents default and stops propagation", () => {
  let prevented = false;
  let stopped = false;
  handleOpenInBrowserClick(
    {
      preventDefault() {
        prevented = true;
      },
      stopPropagation() {
        stopped = true;
      },
    },
    "https://www.influo.gr/in/test"
  );
  assert.equal(prevented, true);
  assert.equal(stopped, true);
});
