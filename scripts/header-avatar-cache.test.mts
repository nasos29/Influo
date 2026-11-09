import assert from "node:assert/strict";
import test from "node:test";
import { hasLikelySupabaseAuthSession } from "../lib/authStorage.ts";
import {
  clearHeaderAvatarCache,
  getHeaderAvatarServerSnapshot,
  getHeaderAvatarSnapshot,
  HEADER_AVATAR_BOOT_SCRIPT,
  resetHeaderAvatarCacheForTests,
  writeHeaderAvatarCache,
} from "../lib/headerAvatarCache.ts";

function installStorage(seed: Record<string, string> = {}): Map<string, string> {
  const data = new Map<string, string>(Object.entries(seed));
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
      key: (index: number) => [...data.keys()][index] ?? null,
      get length() {
        return data.size;
      },
    },
  });
  return data;
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
  assert.equal(getHeaderAvatarSnapshot().ready, true);

  const photo = runBoot(JSON.stringify({
    userKind: "influencer",
    accountName: "Νίκος",
    avatarUrl: "https://cdn.example/a.jpg",
    avatarName: "Νίκος",
  }));
  assert.equal(photo.classes.includes("header-avatar-hot"), true);
  assert.equal(photo.props["--header-avatar-image"], 'url("https://cdn.example/a.jpg")');
  assert.match(photo.css, /header-avatar-pending\{display:none/);
  assert.match(photo.css, /header-login-link/);
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

test("guests are ready immediately; skeleton only when auth storage exists", () => {
  installStorage();
  resetHeaderAvatarCacheForTests();
  const server = getHeaderAvatarServerSnapshot();
  assert.equal(server.ready, true);
  assert.equal(server.userKind, "none");

  const guest = getHeaderAvatarSnapshot();
  assert.equal(guest.ready, true);
  assert.equal(guest.userKind, "none");
  assert.equal(hasLikelySupabaseAuthSession(), false);

  installStorage({ "sb-xyz-auth-token": JSON.stringify({ access_token: "x" }) });
  resetHeaderAvatarCacheForTests();
  assert.equal(hasLikelySupabaseAuthSession(), true);
  const pending = getHeaderAvatarSnapshot();
  assert.equal(pending.ready, false);
  assert.equal(pending.userKind, "none");

  const bootPending = runBoot(null, { "sb-xyz-auth-token": "1" });
  assert.equal(bootPending.classes.includes("header-auth-pending"), true);
  assert.match(bootPending.css, /header-login-link/);
  assert.match(bootPending.css, /header-avatar-pending\{display:inline-block/);
});

function runBoot(
  raw: string | null,
  extra: Record<string, string> = {}
): { classes: string[]; props: Record<string, string>; css: string } {
  const classes = new Set<string>();
  const props: Record<string, string> = {};
  let css = "";
  const previousStorage = globalThis.localStorage;
  const previousDocument = globalThis.document;
  const data = new Map<string, string>(Object.entries(extra));
  if (raw != null) data.set("influo:header-avatar", raw);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      key: (index: number) => [...data.keys()][index] ?? null,
      get length() {
        return data.size;
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      cookie: "",
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
