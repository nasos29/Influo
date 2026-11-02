import assert from "node:assert/strict";
import test from "node:test";
import { MAX_SKILLS, SKILLS, sanitizeSkills, skillLabel } from "../lib/skills.ts";

test("sanitizeSkills keeps known keys, drops duplicates, and stops at 10", () => {
  const many = [
    "ugc",
    "ugc",
    "not_a_skill",
    "el",
    "Lifestyle",
    "video_editing",
    "color_grading",
    "voiceover",
    "subtitles",
    "drone",
    "studio_lighting",
    "on_camera",
    "acting",
    "live_streaming",
    "copywriting",
  ];
  const clean = sanitizeSkills(many);
  assert.equal(clean.length, MAX_SKILLS);
  assert.equal(clean[0], "ugc");
  assert.equal(clean.filter((key) => key === "ugc").length, 1);
  assert.equal(clean.includes("copywriting" as never), false);
  assert.equal(skillLabel("ugc", "el"), "UGC");
  assert.equal(skillLabel("nope", "en"), "");
  assert.equal(SKILLS.includes("short_video" as never), false);
  assert.deepEqual(sanitizeSkills(["short_video", "ugc"]), ["ugc"]);
  assert.equal(skillLabel("short_video", "el"), "");
  assert.equal(skillLabel("short_video", "en"), "");
});
