import { bi, type Bilingual, type Lang } from "@/lib/bilingual";
import type { LucideIcon } from "lucide-react";

export type BiFeature = Readonly<{
  title: Bilingual;
  desc: Bilingual;
  icon: LucideIcon;
}>;

export type BiStep = Readonly<{
  title: Bilingual;
  desc: Bilingual;
}>;

export function localizeFeatures(lang: Lang, items: readonly BiFeature[]) {
  return items.map((item) => ({
    title: bi(lang, item.title),
    desc: bi(lang, item.desc),
    icon: item.icon,
  }));
}

export function localizeSteps(lang: Lang, steps: readonly BiStep[]) {
  return steps.map((step) => ({
    title: bi(lang, step.title),
    desc: bi(lang, step.desc),
  }));
}
