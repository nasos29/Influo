import assert from "node:assert/strict";
import test from "node:test";
import {
  attachmentDisplayFilename,
  chatAttachmentKind,
  needsChunkedChatUpload,
  validateChatAttachment,
  MAX_CHAT_FILE_BYTES,
  MAX_CHAT_VIDEO_BYTES,
} from "../lib/chatAttachmentUpload.ts";

test("chat attachment kinds and size limits", () => {
  assert.equal(chatAttachmentKind("video/mp4", "clip.mp4"), "video");
  assert.equal(chatAttachmentKind("application/octet-stream", "a.MOV"), "video");
  assert.equal(chatAttachmentKind("application/pdf", "doc.pdf"), "pdf");
  assert.equal(chatAttachmentKind("image/jpeg", "x.jpg"), "image");

  const smallVideo = validateChatAttachment({ mimeType: "video/mp4", fileName: "a.mp4", size: 5_000_000 });
  assert.equal(smallVideo.ok, true);

  const bigVideo = validateChatAttachment({ mimeType: "video/mp4", fileName: "a.mp4", size: MAX_CHAT_VIDEO_BYTES + 1 });
  assert.equal(bigVideo.ok, false);
  if (!bigVideo.ok) assert.match(bigVideo.message.el, /2GB/i);

  const bigPdf = validateChatAttachment({ mimeType: "application/pdf", fileName: "a.pdf", size: MAX_CHAT_FILE_BYTES + 1 });
  assert.equal(bigPdf.ok, false);
  if (!bigPdf.ok) assert.match(bigPdf.message.el, /10MB/);

  assert.equal(needsChunkedChatUpload(MAX_CHAT_FILE_BYTES + 1, "video"), true);
  assert.equal(needsChunkedChatUpload(1_000, "video"), false);
});

test("display filename keeps Greek letters", () => {
  assert.equal(attachmentDisplayFilename("Παράδειγμα 3.txt"), "Παράδειγμα 3.txt");
  assert.equal(attachmentDisplayFilename("evil<script>.pdf"), "evilscript.pdf");
});