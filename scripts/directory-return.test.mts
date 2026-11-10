import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consumeDirectoryReturnPath,
  directoryPathFromReferrer,
  rememberDirectoryReturn,
  restoreDirectoryScroll,
} from "../lib/directoryReturn.ts";

describe("directoryReturn", () => {
  it("remember + consume restores path and queues scroll", () => {
    const store = new Map<string, string>();
    const sessionStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    // @ts-expect-error test shim
    globalThis.sessionStorage = sessionStorage;
    // @ts-expect-error test shim
    globalThis.window = {
      location: { pathname: "/directory", search: "?category=Fashion&page=2" },
      scrollY: 640,
      scrollTo: () => {},
    };
    // @ts-expect-error test shim
    globalThis.document = { referrer: "" };

    rememberDirectoryReturn();
    const path = consumeDirectoryReturnPath();
    assert.equal(path, "/directory?category=Fashion&page=2");
    assert.equal(store.get("influo:directory-return-scroll"), "640");
  });

  it("directoryPathFromReferrer accepts same-origin directory URLs", () => {
    // @ts-expect-error test shim
    globalThis.window = { location: { origin: "https://www.influo.gr" } };
    // @ts-expect-error test shim
    globalThis.document = {
      referrer: "https://www.influo.gr/en/directory?q=maria",
    };
    assert.equal(directoryPathFromReferrer(), "/en/directory?q=maria");
  });

  it("restoreDirectoryScroll clears the scroll key", () => {
    const store = new Map<string, string>([["influo:directory-return-scroll", "120"]]);
    let scrolledTo: number | null = null;
    const sessionStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    // @ts-expect-error test shim
    globalThis.sessionStorage = sessionStorage;
    // @ts-expect-error test shim
    globalThis.window = {
      scrollTo: (_x: number, y: number) => {
        scrolledTo = y;
      },
    };
    let raf = 0;
    // @ts-expect-error test shim
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      raf += 1;
      cb(0);
      return raf;
    };
    restoreDirectoryScroll();
    assert.equal(scrolledTo, 120);
    assert.equal(store.has("influo:directory-return-scroll"), false);
  });
});
