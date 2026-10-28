"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

const VIEWPORT_MARGIN_PX = 8;
const TIP_GAP_PX = 6; // matches previous mt-1.5

type TipPos = { top: number; left: number };

function computeTipPos(button: DOMRect, tip: DOMRect): TipPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = button.bottom + TIP_GAP_PX;
  let left = button.left + button.width / 2 - tip.width / 2;

  if (left < VIEWPORT_MARGIN_PX) left = VIEWPORT_MARGIN_PX;
  const maxLeft = vw - VIEWPORT_MARGIN_PX - tip.width;
  if (left > maxLeft) left = Math.max(VIEWPORT_MARGIN_PX, maxLeft);

  if (top + tip.height > vh - VIEWPORT_MARGIN_PX) {
    top = Math.max(VIEWPORT_MARGIN_PX, vh - VIEWPORT_MARGIN_PX - tip.height);
  }

  return { top, left };
}

/**
 * Small info icon with a one-sentence tip.
 * Desktop: hover. Mobile: tap to toggle; tap outside closes.
 * Tip is portaled to document.body (fixed) so overflow parents cannot clip it.
 */
export default function InfoTooltip({
  text,
  ariaLabel,
}: Readonly<{
  text: string;
  ariaLabel: string;
}>) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<TipPos>({ top: 0, left: 0 });
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (tipRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  const updatePosition = useCallback(() => {
    const button = rootRef.current?.querySelector("button");
    const tip = tipRef.current;
    if (!button || !tip) return;
    const next = computeTipPos(button.getBoundingClientRect(), tip.getBoundingClientRect());
    setPos((prev) => {
      if (prev.top === next.top && prev.left === next.left) return prev;
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    if (!open || !mounted) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    // capture: true so nested scroll containers also trigger a recompute
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, mounted, text, updatePosition]);

  const leaveIfOutside = (event: ReactMouseEvent, other: HTMLElement | null) => {
    const related = event.relatedTarget as Node | null;
    if (related && other?.contains(related)) return;
    setOpen(false);
  };

  const tip =
    open && mounted
      ? createPortal(
          <span
            ref={tipRef}
            id={tipId}
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[9999] w-44 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-[10px] font-normal leading-snug normal-case tracking-normal text-slate-600 shadow-lg"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={(event) => leaveIfOutside(event, rootRef.current)}
          >
            {text}
          </span>,
          document.body
        )
      : null;

  return (
    <span
      ref={rootRef}
      className="relative inline-flex shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(event) => leaveIfOutside(event, tipRef.current)}
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
      {tip}
    </span>
  );
}
