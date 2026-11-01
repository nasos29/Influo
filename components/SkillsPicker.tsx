"use client";

import { MAX_SKILLS, SKILL_GROUPS, sanitizeSkills, skillLabel, type SkillKey } from "@/lib/skills";

type Props = {
  lang: "el" | "en";
  selected: string[];
  onChange: (next: SkillKey[]) => void;
  label?: string;
  description?: string;
};

export default function SkillsPicker({ lang, selected, onChange, label, description }: Props) {
  const keys = sanitizeSkills(selected);
  const atMax = keys.length >= MAX_SKILLS;
  const title = label || (lang === "el" ? "Δεξιότητες" : "Skills");
  const hint = description || (lang === "el" ? "Προαιρετικό. Έως 10." : "Optional. Up to 10.");

  const toggle = (key: SkillKey) => {
    if (keys.includes(key)) {
      onChange(keys.filter((item) => item !== key));
      return;
    }
    if (atMax) return;
    onChange(sanitizeSkills([...keys, key]));
  };

  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium text-slate-800">{title}</legend>
      <p className="mb-3 text-xs text-slate-500">
        {hint}{" "}
        <span className="font-medium text-slate-700">
          {keys.length}/{MAX_SKILLS}
        </span>
      </p>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        {SKILL_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label[lang]}</p>
            <div className="flex flex-wrap gap-2">
              {group.skills.map((skill) => {
                const on = keys.includes(skill.key);
                const disabled = !on && atMax;
                return (
                  <button
                    key={skill.key}
                    type="button"
                    aria-pressed={on}
                    disabled={disabled}
                    onClick={() => toggle(skill.key)}
                    className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm transition-colors ${
                      on
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {skillLabel(skill.key, lang)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
