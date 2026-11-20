import assert from "node:assert/strict";
import test from "node:test";
import { buildChatAttachmentObjectName } from "../lib/chatAttachmentObjectName.ts";
import { parseChatUploadConversationId } from "../lib/chatAttachmentUpload.ts";
import { supabaseResumableTusTarget } from "../lib/supabaseClientTus.ts";

test("parseChatUploadConversationId accepts UUID or temp", () => {
  assert.equal(parseChatUploadConversationId("temp"), "temp");
  assert.equal(parseChatUploadConversationId(undefined), "temp");
  assert.equal(
    parseChatUploadConversationId("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  );
  assert.equal(parseChatUploadConversationId("not-a-uuid"), null);
  assert.equal(parseChatUploadConversationId("../evil"), null);
});

test("buildChatAttachmentObjectName targets conversations/{id}/{ts}_{rand}.ext", () => {
  const name = buildChatAttachmentObjectName("temp", "Βίντεο.mp4", "video/mp4");
  assert.match(name, /^conversations\/temp\/\d+_[a-z0-9]+\.mp4$/);
  const mov = buildChatAttachmentObjectName(
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "clip",
    "video/quicktime"
  );
  assert.match(mov, /^conversations\/a1b2c3d4-e5f6-7890-abcd-ef1234567890\/\d+_[a-z0-9]+\.mov$/);
});

test("supabaseResumableTusTarget signed vs bearer", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  const signed = supabaseResumableTusTarget({ mode: "signed", signature: "tok" });
  assert.equal(signed.endpoint, "https://example.supabase.co/storage/v1/upload/resumable/sign");
  assert.equal(signed.headers["x-signature"], "tok");
  assert.equal(signed.headers["x-upsert"], "false");

  const bearer = supabaseResumableTusTarget({ mode: "bearer", accessToken: "jwt" });
  assert.equal(bearer.endpoint, "https://example.supabase.co/storage/v1/upload/resumable");
  assert.equal(bearer.headers.Authorization, "Bearer jwt");
});