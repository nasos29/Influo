export const MAX_SKILLS = 10;

export const SKILL_GROUPS = [
  {
    id: "content",
    label: { el: "Περιεχόμενο", en: "Content" },
    skills: [
      { key: "ugc", label: { el: "UGC", en: "UGC" } },
      { key: "product_photo", label: { el: "Φωτογραφία προϊόντος", en: "Product photography" } },
      { key: "reviews", label: { el: "Reviews προϊόντων", en: "Product reviews" } },
      { key: "tutorials", label: { el: "Tutorials/How-to", en: "Tutorials/How-to" } },
      { key: "vlogs", label: { el: "Vlogs", en: "Vlogs" } },
    ],
  },
  {
    id: "production",
    label: { el: "Παραγωγή", en: "Production" },
    skills: [
      { key: "video_editing", label: { el: "Μοντάζ", en: "Video editing" } },
      { key: "color_grading", label: { el: "Color grading", en: "Color grading" } },
      { key: "voiceover", label: { el: "Voiceover", en: "Voiceover" } },
      { key: "subtitles", label: { el: "Υπότιτλοι", en: "Subtitles/captions" } },
      { key: "drone", label: { el: "Λήψεις drone", en: "Drone footage" } },
      { key: "studio_lighting", label: { el: "Studio φωτισμός", en: "Studio lighting" } },
    ],
  },
  {
    id: "presentation",
    label: { el: "Παρουσίαση", en: "Presentation" },
    skills: [
      { key: "on_camera", label: { el: "Παρουσίαση στην κάμερα", en: "On-camera presenting" } },
      { key: "acting", label: { el: "Ηθοποιία/σκετς", en: "Acting/skits" } },
      { key: "live_streaming", label: { el: "Live streaming", en: "Live streaming" } },
    ],
  },
  {
    id: "other",
    label: { el: "Άλλα", en: "Other" },
    skills: [
      { key: "copywriting", label: { el: "Copywriting", en: "Copywriting" } },
      { key: "social_strategy", label: { el: "Στρατηγική social", en: "Social media strategy" } },
      { key: "event_hosting", label: { el: "Διοργάνωση/παρουσίαση events", en: "Event hosting" } },
    ],
  },
] as const;

export type SkillKey = (typeof SKILL_GROUPS)[number]["skills"][number]["key"];

const SKILL_LABEL = new Map<string, { el: string; en: string }>(
  SKILL_GROUPS.flatMap((group) => group.skills.map((skill) => [skill.key, skill.label]))
);

export const SKILLS: SkillKey[] = SKILL_GROUPS.flatMap((group) => group.skills.map((skill) => skill.key));

export function skillLabel(key: string, lang: "el" | "en"): string {
  return SKILL_LABEL.get(key)?.[lang] || "";
}

/** Known keys only, unique, capped at 10. Languages and categories are not skills. */
export function sanitizeSkills(value: unknown): SkillKey[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const out: SkillKey[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const key = item.trim();
    if (!SKILL_LABEL.has(key) || out.includes(key as SkillKey)) continue;
    out.push(key as SkillKey);
    if (out.length >= MAX_SKILLS) break;
  }
  return out;
}
