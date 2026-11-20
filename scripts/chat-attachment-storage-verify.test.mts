import assert from "node:assert/strict";
import test from "node:test";
import { verifyChatStorageObject } from "../lib/chatAttachmentStorageVerify.ts";

function fakeAdmin(infoResult: { data: unknown; error: unknown }) {
  return {
    storage: {
      from: () => ({
        info: async () => infoResult,
      }),
    },
  };
}

test("verifyChatStorageObject uses info() and checks size + mime", async () => {
  const ok = await verifyChatStorageObject(
    fakeAdmin({
      data: { size: 100, contentType: "video/mp4" },
      error: null,
    }) as never,
    "message-attachments",
    "conversations/x/a.mp4",
    100,
    "video/mp4"
  );
  assert.equal(ok.ok, true);

  const badMime = await verifyChatStorageObject(
    fakeAdmin({
      data: { size: 100, contentType: "application/octet-stream" },
      error: null,
    }) as never,
    "message-attachments",
    "conversations/x/a.mp4",
    100,
    "video/mp4"
  );
  assert.equal(badMime.ok, false);
  if (!badMime.ok) assert.equal(badMime.reason, "mime");

  const missing = await verifyChatStorageObject(
    fakeAdmin({ data: null, error: { message: "not found" } }) as never,
    "message-attachments",
    "conversations/x/a.mp4",
    100,
    "video/mp4"
  );
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.reason, "missing");
});