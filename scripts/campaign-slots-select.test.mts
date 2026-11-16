import assert from "node:assert/strict";
import test from "node:test";
import {
  SLOT_PRESETS,
  applySlotsSelectChange,
  isSlotPreset,
  slotsCustomFromStored,
  slotsSelectValue,
} from "../lib/campaignSlotsSelect.ts";

test("isSlotPreset covers listed presets only", () => {
  for (const n of SLOT_PRESETS) assert.equal(isSlotPreset(n), true);
  assert.equal(isSlotPreset(""), false);
  assert.equal(isSlotPreset("4"), false);
  assert.equal(isSlotPreset("7"), false);
  assert.equal(isSlotPreset("custom"), false);
});

test("slotsCustomFromStored: non-preset opens custom; preset/empty does not", () => {
  assert.equal(slotsCustomFromStored(""), false);
  assert.equal(slotsCustomFromStored("5"), false);
  assert.equal(slotsCustomFromStored("4"), true);
  assert.equal(slotsCustomFromStored("7"), true);
  assert.equal(slotsCustomFromStored("20"), false);
});

test("slotsSelectValue: custom mode always shows custom option", () => {
  assert.equal(slotsSelectValue("5", true), "custom");
  assert.equal(slotsSelectValue("4", true), "custom");
  assert.equal(slotsSelectValue("5", false), "5");
  assert.equal(slotsSelectValue("", false), "");
});

test("applySlotsSelectChange: Άλλο from empty opens custom with default 4", () => {
  assert.deepEqual(applySlotsSelectChange("custom", ""), { slots: "4", isCustom: true });
});

test("applySlotsSelectChange: Άλλο from preset still opens custom (does not keep collapsing)", () => {
  assert.deepEqual(applySlotsSelectChange("custom", "5"), { slots: "4", isCustom: true });
  assert.deepEqual(applySlotsSelectChange("custom", "20"), { slots: "4", isCustom: true });
});

test("applySlotsSelectChange: Άλλο keeps existing non-preset value", () => {
  assert.deepEqual(applySlotsSelectChange("custom", "7"), { slots: "7", isCustom: true });
});

test("applySlotsSelectChange: picking a preset or no-limit leaves custom mode", () => {
  assert.deepEqual(applySlotsSelectChange("5", "7"), { slots: "5", isCustom: false });
  assert.deepEqual(applySlotsSelectChange("", "4"), { slots: "", isCustom: false });
});

test("typing a preset number stays in custom when isCustom is kept by caller", () => {
  // Caller keeps isCustom=true while typing; select value stays "custom" even if slots=="5".
  assert.equal(slotsSelectValue("5", true), "custom");
  assert.equal(slotsSelectValue("1", true), "custom");
});
