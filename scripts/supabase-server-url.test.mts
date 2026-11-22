import assert from "node:assert/strict";
import test from "node:test";
import {
  getServerSupabaseUrl,
  publicSupabaseStorageObjectUrl,
} from "../lib/supabaseServerUrl.ts";

const origPublic = process.env.NEXT_PUBLIC_SUPABASE_URL;
const origInternal = process.env.SUPABASE_INTERNAL_URL;

function restoreEnv() {
  if (origPublic === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = origPublic;
  if (origInternal === undefined) delete process.env.SUPABASE_INTERNAL_URL;
  else process.env.SUPABASE_INTERNAL_URL = origInternal;
}

test("getServerSupabaseUrl prefers trimmed internal URL", () => {
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.example.com/";
    process.env.SUPABASE_INTERNAL_URL = "  https://internal.example.com/  ";
    assert.equal(getServerSupabaseUrl(), "https://internal.example.com");
  } finally {
    restoreEnv();
  }
});

test("getServerSupabaseUrl falls back to public when internal unset or blank", () => {
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.example.com";
    delete process.env.SUPABASE_INTERNAL_URL;
    assert.equal(getServerSupabaseUrl(), "https://public.example.com");

    process.env.SUPABASE_INTERNAL_URL = "   ";
    assert.equal(getServerSupabaseUrl(), "https://public.example.com");
  } finally {
    restoreEnv();
  }
});

test("publicSupabaseStorageObjectUrl always uses public host", () => {
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.example.com";
    process.env.SUPABASE_INTERNAL_URL = "https://internal.example.com";
    assert.equal(
      publicSupabaseStorageObjectUrl("avatars", "a/b.png"),
      "https://public.example.com/storage/v1/object/public/avatars/a/b.png"
    );
  } finally {
    restoreEnv();
  }
});

test("publicSupabaseStorageObjectUrl encodeURI matches supabase-js for spaces and non-ASCII", () => {
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.example.com";
    const objectPath = "album/φωτό file.jpg";
    const raw = `https://public.example.com/storage/v1/object/public/media/${objectPath}`;
    assert.equal(publicSupabaseStorageObjectUrl("media", objectPath), encodeURI(raw));
  } finally {
    restoreEnv();
  }
});