"use client";

import { useEffect, useRef, useState } from "react";
import { directoryShopExamples } from "@/lib/directoryIndustries";
import { SKILL_GROUPS, type SkillKey } from "@/lib/skills";
import { CATEGORIES, GENERAL_CATEGORY, categoryTranslations } from "@/lib/categories";
import { isProtectedTestAccount } from "@/lib/protectedAccount";

const EL_SHOP_PREFIXES = ["influencer για", "δημιουργός για", "creator για"] as const;
const EL_NAMES = ["influencer", "δημιουργός", "creator"] as const;

/** Grammatical Greek after για/με. Not the nominative skill label. */
const EL_SKILL_PHRASE: Record<SkillKey, { prep: "για" | "με"; text: string }> = {
  ugc: { prep: "για", text: "UGC βίντεο" },
  product_photo: { prep: "με", text: "φωτογραφία προϊόντος" },
  reviews: { prep: "με", text: "κριτικές προϊόντων" },
  tutorials: { prep: "με", text: "οδηγούς" },
  vlogs: { prep: "με", text: "vlogs" },
  video_editing: { prep: "με", text: "μοντάζ" },
  color_grading: { prep: "με", text: "χρωματική διόρθωση" },
  voiceover: { prep: "με", text: "voiceover" },
  subtitles: { prep: "με", text: "υπότιτλους" },
  drone: { prep: "με", text: "λήψεις drone" },
  studio_lighting: { prep: "με", text: "φωτισμό στούντιο" },
  on_camera: { prep: "με", text: "παρουσίαση στην κάμερα" },
  acting: { prep: "με", text: "ηθοποιία" },
  live_streaming: { prep: "με", text: "ζωντανή μετάδοση" },
  copywriting: { prep: "με", text: "copywriting" },
  social_strategy: { prep: "με", text: "στρατηγική για social" },
  event_hosting: { prep: "με", text: "διοργάνωση events" },
};

const EXTRAS = {
  el: ["UGC creator", "reel έως 50 €", "fitness Θεσσαλονίκη", "μαρία"],
  en: ["UGC creator", "reel up to 50 €", "fitness Thessaloniki", "maria"],
} as const;

export const DIRECTORY_TYPEWRITER_STATIC = {
  el: "δημιουργός για καφέ",
  en: "creator for cafe",
} as const;

export function directoryExamplePool(lang: "el" | "en"): string[] {
  const shops = directoryShopExamples();
  const skills = SKILL_GROUPS.flatMap((group) => [...group.skills]);
  if (lang === "en") {
    return [
      ...new Set([
        ...shops.map((shop) => `creator for ${shop.en}`),
        ...skills.map((skill) => `creator with ${skill.label.en.toLowerCase()}`),
        ...EXTRAS.en,
      ]),
    ];
  }
  return [
    ...new Set([
      ...EL_SHOP_PREFIXES.flatMap((prefix) => shops.map((shop) => `${prefix} ${shop.el}`)),
      ...skills.flatMap((skill) => {
        const phrase = EL_SKILL_PHRASE[skill.key];
        return EL_NAMES.map((name) => `${name} ${phrase.prep} ${phrase.text}`);
      }),
      ...EXTRAS.el,
    ]),
  ];
}

/** Site categories in the current language (no «Γενικά»). */
export function directoryCategoryPool(lang: "el" | "en"): string[] {
  return CATEGORIES.filter((c) => c !== GENERAL_CATEGORY).map((c) => categoryTranslations[c]?.[lang] || c);
}

/** Skill labels in the current language. */
export function directorySkillPool(lang: "el" | "en"): string[] {
  return [...new Set(SKILL_GROUPS.flatMap((group) => group.skills.map((skill) => skill.label[lang])))];
}

/** Display names of listed creators. Never the test account. */
export function directoryNamePool(names: readonly (string | null | undefined)[]): string[] {
  return [
    ...new Set(
      names
        .map((n) => String(n || "").trim())
        .filter((n) => n.length >= 3 && n.length <= 40 && !isProtectedTestAccount({ display_name: n }))
    ),
  ];
}

/**
 * Mixed example: picks a group at random (phrases, categories, skills, names),
 * then a random entry, so short categories/names are not drowned by the long phrase list.
 */
export function nextMixedDirectoryExample(
  lang: "el" | "en",
  previous: string,
  names: readonly string[],
  random: () => number = Math.random
): string {
  const groups = [
    directoryExamplePool(lang),
    directoryCategoryPool(lang),
    directorySkillPool(lang),
    names,
  ].filter((g) => g.length > 0);
  for (let attempt = 0; attempt < 8; attempt++) {
    const group = groups[Math.min(groups.length - 1, Math.floor(random() * groups.length))];
    const next = group?.[Math.min(group.length - 1, Math.floor(random() * group.length))];
    if (next && next !== previous) return next;
  }
  return nextDirectoryExample(lang, previous, random);
}

/** Next rotating example. Never the same string as the previous one. */
export function nextDirectoryExample(
  lang: "el" | "en",
  previous: string,
  random: () => number = Math.random
): string {
  const pool = directoryExamplePool(lang);
  if (!pool.length) return previous;
  for (let attempt = 0; attempt < 8; attempt++) {
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    const next = pool[index];
    if (next && next !== previous) return next;
  }
  const current = pool.indexOf(previous);
  return pool[(current + 1) % pool.length] || pool[0];
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Types a random search example, then deletes it. Stops while `active` is false.
 * Reduced motion keeps one static example.
 */
export function useDirectoryTypewriter(
  lang: "el" | "en",
  active: boolean,
  creatorNames: readonly (string | null | undefined)[] = []
): string {
  const namesRef = useRef<string[]>([]);
  // Keep every name seen so filtering the list does not shrink the pool. Visual only.
  namesRef.current = directoryNamePool([...namesRef.current, ...creatorNames]).slice(0, 300);
  const staticExample = DIRECTORY_TYPEWRITER_STATIC[lang];
  const [text, setText] = useState<string>(staticExample);

  useEffect(() => {
    setText(staticExample);
  }, [staticExample]);

  useEffect(() => {
    if (!active || prefersReducedMotion()) return;
    let cancelled = false;
    let handle = 0;
    let wake = () => {};
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        wake = resolve;
        handle = window.setTimeout(resolve, ms);
      });
    const type = async (value: string) => {
      for (let i = 1; i <= value.length && !cancelled; i++) {
        setText(value.slice(0, i));
        await sleep(72);
      }
    };
    const erase = async (value: string) => {
      for (let i = value.length - 1; i >= 0 && !cancelled; i--) {
        setText(value.slice(0, i));
        await sleep(36);
      }
    };

    let current: string = staticExample;
    void (async () => {
      await sleep(480);
      while (!cancelled) {
        await sleep(1400);
        if (cancelled) return;
        await erase(current);
        if (cancelled) return;
        await sleep(320);
        current = nextMixedDirectoryExample(lang, current, namesRef.current);
        await type(current);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
      wake();
    };
  }, [active, lang, staticExample]);

  return text;
}
