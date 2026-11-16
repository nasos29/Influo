/** Preset options for the brand campaign «Θέσεις» select (excludes «Χωρίς όριο» / «Άλλο»). */
export const SLOT_PRESETS = ["1", "2", "3", "5", "10", "20"] as const;

export type SlotPreset = (typeof SLOT_PRESETS)[number];

export function isSlotPreset(value: string): boolean {
  return (SLOT_PRESETS as readonly string[]).includes(value);
}

/** Open custom mode when stored value is a positive number that is not a preset. */
export function slotsCustomFromStored(slots: string): boolean {
  return Boolean(slots) && !isSlotPreset(slots);
}

/** Controlled `<select>` value: "" | preset | "custom". */
export function slotsSelectValue(slots: string, isCustom: boolean): string {
  if (isCustom) return "custom";
  return slots;
}

/**
 * Apply a change from the slots `<select>`.
 * Picking «Άλλο» / "custom" always enters custom mode (even if the current value is a preset).
 * Picking any other option leaves custom mode.
 */
export function applySlotsSelectChange(
  selectValue: string,
  currentSlots: string
): { slots: string; isCustom: boolean } {
  if (selectValue === "custom") {
    const slots = currentSlots && !isSlotPreset(currentSlots) ? currentSlots : "4";
    return { slots, isCustom: true };
  }
  return { slots: selectValue, isCustom: false };
}
