"use client";

import { useEffect, useState } from "react";

type Lang = "el" | "en";

export type DocsTocItem = {
  id: string;
  label: { el: string; en: string };
};

export type DocsTocGroup = {
  title: { el: string; en: string };
  items: DocsTocItem[];
};

type DocsTocProps = {
  lang: Lang;
  groups: DocsTocGroup[];
  /** Render only mobile accordion, only desktop sticky, or both (default). */
  variant?: "mobile" | "desktop" | "all";
};

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string>(ids[0] ?? "");

  useEffect(() => {
    if (!ids.length) return;
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids.join("|")]);

  return active;
}

function TocLinks({
  lang,
  groups,
  active,
  onNavigate,
}: {
  lang: Lang;
  groups: DocsTocGroup[];
  active: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label={lang === "el" ? "Περιεχόμενα" : "Contents"} className="space-y-5">
      {groups.map((group) => (
        <div key={group.title.en}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            {group.title[lang]}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const isActive = active === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={onNavigate}
                    className={`block rounded-lg px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                      isActive
                        ? "bg-blue-50 text-blue-800 font-semibold border border-blue-100"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                    aria-current={isActive ? "location" : undefined}
                  >
                    {item.label[lang]}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Sticky desktop TOC + collapsible mobile contents. */
export default function DocsToc({ lang, groups, variant = "all" }: DocsTocProps) {
  const ids = groups.flatMap((g) => g.items.map((i) => i.id));
  const active = useActiveSection(ids);
  const [open, setOpen] = useState(false);
  const contentsLabel = lang === "el" ? "Περιεχόμενα" : "Contents";
  const showMobile = variant === "mobile" || variant === "all";
  const showDesktop = variant === "desktop" || variant === "all";

  return (
    <>
      {showMobile && (
        <div className="mb-8">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="docs-toc-mobile-panel"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <span>{contentsLabel}</span>
            <svg
              className={`w-4 h-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            id="docs-toc-mobile-panel"
            className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-4">
                <TocLinks lang={lang} groups={groups} active={active} onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {showDesktop && (
        <aside>
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-900 mb-4">{contentsLabel}</p>
            <TocLinks lang={lang} groups={groups} active={active} />
          </div>
        </aside>
      )}
    </>
  );
}
