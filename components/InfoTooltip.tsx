"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

type Align = "center" | "left" | "right";

const VIEWPORT_MARGIN_PX = 8;

const ALIGN_CLASS: Record<Align, string> = {
  center: "left-1/2 right-auto -translate-x-1/2",
  left: "left-0 right-auto translate-x-0",
  right: "right-0 left-auto translate-x-0",
};

function pickAlign(button: DOMRect, tip: DOMRect, viewportWidth: number): Align {
  const centerX = button.left + button.width / 2;
  const centeredLeft = centerX - tip.width / 2;
  const centeredRight = centeredLeft + tip.width;
  if (centeredRight > viewportWidth - VIEWPORT_MARGIN_PX) return "right";
  if (centeredLeft < VIEWPORT_MARGIN_PX) return "left";
  return "center";
}

/**
 * Small info icon with a one-sentence tip.
 * Desktop: hover. Mobile: tap to toggle; tap outside closes.
 * Horizontal align flips so the tip stays inside the viewport.
 */
export default function InfoTooltip({
  text,
  ariaLabel,
}: Readonly<{
  text: string;
  ariaLabel: string;
}>) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<Align>("center");
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
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

  useLayoutEffect(() => {
    if (!open) {
      setAlign("center");
      return;
    }

    const updateAlign = () => {
      const button = rootRef.current?.querySelector("button");
      const tip = tipRef.current;
      if (!button || !tip) return;
      const next = pickAlign(
        button.getBoundingClientRect(),
        tip.getBoundingClientRect(),
        window.innerWidth
      );
      setAlign((prev) => (prev === next ? prev : next));
    };

    updateAlign();
    window.addEventListener("resize", updateAlign);
    return () => {
      window.removeEventListener("resize", updateAlign);
    };
  }, [open, text]);

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
          ref={tipRef}
          id={tipId}
          role="tooltip"
          className={`absolute top-full z-40 mt-1.5 w-44 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-[10px] font-normal leading-snug normal-case tracking-normal text-slate-600 shadow-lg ${ALIGN_CLASS[align]}`}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
