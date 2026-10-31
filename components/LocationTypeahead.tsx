"use client";

import { useEffect, useId, useRef, useState } from "react";
import locations from "@/data/locations.json";
import { searchLocations, type LocationHit, type LocationRecord } from "@/lib/locationCatalog";

const COPY = {
  el: { city: "Πόλη", region: "Περιφέρεια", island: "Νησί", list: "Τοποθεσίες" },
  en: { city: "City", region: "Region", island: "Island", list: "Locations" },
} as const;

const CATALOG = locations as LocationRecord[];

export default function LocationTypeahead({
  lang,
  value,
  onChange,
  placeholder,
  className,
  id,
  ariaLabel,
}: {
  lang: "el" | "en";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
}) {
  const copy = COPY[lang];
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const hits = searchLocations(value, lang, 8, CATALOG);
  const visible = open && hits.length > 0;

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  const choose = (hit: LocationHit) => {
    onChange(hit.label);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        className={className}
        onChange={(event) => {
          onChange(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!hits.length) return;
            setOpen(true);
            setActive((index) => (index + 1) % hits.length);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!hits.length) return;
            setOpen(true);
            setActive((index) => (index <= 0 ? hits.length - 1 : index - 1));
            return;
          }
          if (event.key === "Escape") {
            setOpen(false);
            setActive(-1);
            return;
          }
          if (event.key === "Enter" && visible && active >= 0) {
            event.preventDefault();
            const hit = hits[active];
            if (hit) choose(hit);
          }
        }}
      />
      {visible ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={copy.list}
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg"
        >
          {hits.map((hit, index) => (
            <li
              key={`${hit.country}-${hit.name_el}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
            >
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(hit)}
                className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-sm ${
                  index === active ? "bg-blue-50 text-slate-900" : "text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{hit.label}</span>
                  {hit.region && hit.region !== hit.label ? (
                    <span className="block truncate text-xs text-slate-500">{hit.region}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {copy[hit.type]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
