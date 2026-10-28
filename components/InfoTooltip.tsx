"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

/**
 * Small info icon with a one-sentence tip.
 * Desktop: hover. Mobile: tap to toggle; tap outside closes.
 */
export default function InfoTooltip({
  text,
  ariaLabel,
}: {
  text: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="relative inline-flex shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full p-0.5 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <Info size={14} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          className="absolute left-1/2 top-full z-40 mt-1.5 w-48 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-[11px] font-normal normal-case tracking-normal text-slate-600 shadow-lg sm:w-56"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
