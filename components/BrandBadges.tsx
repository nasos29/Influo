"use client";

import { useEffect, useState } from "react";

type BrandBadgeType = "new_brand" | "frequent_partner";

const META: Record<BrandBadgeType, { el: string; en: string; icon: string; cls: string; titleEl: string; titleEn: string }> = {
  frequent_partner: {
    el: "Συχνός συνεργάτης",
    en: "Frequent partner",
    icon: "🤝",
    cls: "text-sky-800 bg-sky-50 border-sky-300",
    titleEl: "3+ ολοκληρωμένες συνεργασίες στο Influo",
    titleEn: "3+ completed collaborations on Influo",
  },
  new_brand: {
    el: "Νέο Brand",
    en: "New brand",
    icon: "🌱",
    cls: "text-lime-800 bg-lime-50 border-lime-300",
    titleEl: "Εγγράφηκε στο Influo τις τελευταίες 30 μέρες",
    titleEn: "Joined Influo in the last 30 days",
  },
};

// Batched, de-duplicated client fetch (one request per tick for all visible brands).
const known = new Map<string, BrandBadgeType[]>();
const waiters = new Map<string, ((b: BrandBadgeType[]) => void)[]>();
let queued = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const ids = [...queued];
  queued = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    fetch(`/api/brands/badges?ids=${chunk.join(",")}`)
      .then((r) => (r.ok ? r.json() : { badges: {} }))
      .catch(() => ({ badges: {} }))
      .then((j: { badges?: Record<string, BrandBadgeType[]> }) => {
        for (const id of chunk) {
          const b = j.badges?.[id] || [];
          known.set(id, b);
          (waiters.get(id) || []).forEach((fn) => fn(b));
          waiters.delete(id);
        }
      });
  }
}

function load(id: string, fn: (b: BrandBadgeType[]) => void) {
  const k = known.get(id);
  if (k) return fn(k);
  const list = waiters.get(id) || [];
  list.push(fn);
  waiters.set(id, list);
  queued.add(id);
  if (!timer) timer = setTimeout(flush, 30);
}

export default function BrandBadges({ brandId, lang = "el", className = "" }: { brandId?: string | null; lang?: "el" | "en"; className?: string }) {
  const [badges, setBadges] = useState<BrandBadgeType[]>(() => (brandId && known.get(brandId)) || []);
  useEffect(() => {
    if (!brandId || !/^[0-9a-f-]{36}$/i.test(brandId)) return;
    let alive = true;
    load(brandId, (b) => alive && setBadges(b));
    return () => {
      alive = false;
    };
  }, [brandId]);
  if (!badges.length) return null;
  const el = lang !== "en";
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {badges.map((b) => {
        const m = META[b];
        return (
          <span
            key={b}
            data-brand-badge={b}
            title={el ? m.titleEl : m.titleEn}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none ${m.cls}`}
          >
            <span aria-hidden>{m.icon}</span>
            {el ? m.el : m.en}
          </span>
        );
      })}
    </span>
  );
}
