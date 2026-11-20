"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Centered dialog on desktop, bottom sheet on small screens (portaled above sticky header). */
export default function ResponsiveDialog({
  open,
  onClose,
  children,
  labelledBy,
  wide = false,
  size,
  frame = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  wide?: boolean;
  /** md = 28rem, lg = 42rem, wide = 56rem. `wide` still maps to the wide size. */
  size?: "md" | "lg" | "wide";
  /** Flex column, no outer scroll — children manage scrolling (sticky footers). */
  frame?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !portalTarget) return null;

  const sheetMaxH = frame
    ? "max-h-[calc(100dvh-4.5rem-env(safe-area-inset-top,0px))] sm:max-h-[92vh]"
    : "max-h-[calc(100dvh-4.5rem-env(safe-area-inset-top,0px)-0.5rem)] sm:max-h-[92vh]";

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-[100] flex items-end justify-center sm:inset-0 sm:top-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 sm:inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`relative w-full rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl ${
          frame
            ? `flex flex-col overflow-hidden ${sheetMaxH}`
            : `overflow-y-auto ${sheetMaxH}`
        } ${
          (size ?? (wide ? "wide" : "md")) === "wide"
            ? "sm:max-w-4xl"
            : (size ?? "md") === "lg"
              ? "sm:max-w-2xl"
              : "sm:max-w-md"
        }`}
      >
        {children}
      </div>
    </div>,
    portalTarget
  );
}

export function DialogClose({
  onClose,
  light = false,
}: {
  onClose: () => void;
  light?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className={`absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none sm:right-4 sm:top-4 ${
        light ? "text-white/90 hover:bg-white/10" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      }`}
    >
      ×
    </button>
  );
}