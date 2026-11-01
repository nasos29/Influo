import assert from "node:assert/strict";
import test from "node:test";
import {
  clearHeaderAvatarCache,
  getHeaderAvatarSnapshot,
  HEADER_AVATAR_BOOT_SCRIPT,
  resetHeaderAvatarCacheForTests,
  writeHeaderAvatarCache,
} from "../lib/headerAvatarCache.ts";

function installStorage(): void {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
    },
  });
}

test("header avatar cache shows immediately after refresh and clears on logout", () => {
  installStorage();
  resetHeaderAvatarCacheForTests();
  writeHeaderAvatarCache({
    userKind: "brand",
    accountName: "Test",
    avatarUrl: "https://cdn.example/logo.jpg",
    avatarName: "Test",
  });
  resetHeaderAvatarCacheForTests();
  const restored = getHeaderAvatarSnapshot();
  assert.equal(restored.ready, true);
  assert.equal(restored.userKind, "brand");
  assert.equal(restored.avatarUrl, "https://cdn.example/logo.jpg");
  assert.equal(restored.avatarName, "Test");

  clearHeaderAvatarCache();
  const cleared = getHeaderAvatarSnapshot();
  assert.equal(cleared.userKind, "none");
  assert.equal(cleared.avatarUrl, "");
  assert.equal(cleared.ready, true);
  resetHeaderAvatarCacheForTests();
  assert.equal(getHeaderAvatarSnapshot().userKind, "none");
  assert.equal(getHeaderAvatarSnapshot().avatarUrl, "");

  const photo = runBoot(JSON.stringify({
    userKind: "influencer",
    accountName: "Νίκος",
    avatarUrl: "https://cdn.example/a.jpg",
    avatarName: "Νίκος",
  }));
  assert.equal(photo.classes.includes("header-avatar-hot"), true);
  assert.equal(photo.props["--header-avatar-image"], 'url("https://cdn.example/a.jpg")');
  assert.match(photo.css, /header-avatar-pending\{display:none/);
  assert.doesNotMatch(photo.css, /header-avatar-initial/);

  const injected = runBoot(JSON.stringify({
    userKind: "brand",
    avatarUrl: 'https://cdn.example/x");color:red',
    avatarName: "Άννα",
  }));
  assert.equal(injected.props["--header-avatar-image"], undefined);
  assert.equal(injected.classes.includes("header-avatar-initial"), true);
  assert.equal(injected.props["--header-avatar-initial"], '"Ά"');
  assert.match(injected.css, /content:var\(--header-avatar-initial\)/);

  const empty = runBoot(null);
  assert.deepEqual(empty.classes, []);
  assert.equal(empty.css, "");
});

function runBoot(raw: string | null): { classes: string[]; props: Record<string, string>; css: string } {
  const classes = new Set<string>();
  const props: Record<string, string> = {};
  let css = "";
  const previousStorage = globalThis.localStorage;
  const previousDocument = globalThis.document;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => raw },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: {
        classList: {
          add: (...names: string[]) => names.forEach((name) => classes.add(name)),
        },
        style: {
          setProperty: (key: string, value: string) => {
            props[key] = value;
          },
        },
      },
      head: { appendChild: (node: { textContent: string }) => { css = node.textContent; } },
      createElement: () => ({ id: "", textContent: "" }),
    },
  });
  try {
    eval(HEADER_AVATAR_BOOT_SCRIPT);
  } finally {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousStorage });
    Object.defineProperty(globalThis, "document", { configurable: true, value: previousDocument });
  }
  return { classes: [...classes], props, css };
}
