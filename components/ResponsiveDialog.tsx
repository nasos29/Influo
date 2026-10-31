"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Centered dialog on desktop, bottom sheet on small screens. */
export default function ResponsiveDialog({
  open,
  onClose,
  children,
  labelledBy,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  wide?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl ${
          wide ? "sm:max-w-4xl" : "sm:max-w-md"
        }`}
      >
        {children}
      </div>
    </div>
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
