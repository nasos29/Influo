"use client";

import { useEffect, useState } from "react";
import { directoryShopExamples } from "@/lib/directoryIndustries";
import { SKILL_GROUPS, type SkillKey } from "@/lib/skills";

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
export function useDirectoryTypewriter(lang: "el" | "en", active: boolean): string {
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
        current = nextDirectoryExample(lang, current);
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
