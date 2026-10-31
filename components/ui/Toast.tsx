"use client";

import { useCallback, useState } from "react";

export type ToastTone = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev.slice(-4), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 4500);
      return id;
    },
    [dismiss]
  );

  return { toasts, push, dismiss };
}

const toneClass: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-emerald-50",
  error: "border-red-200 bg-red-50",
  info: "border-slate-200 bg-white",
};

export default function ToastViewport({
  toasts,
  onDismiss,
  dismissLabel,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  dismissLabel: string;
}) {
  if (!toasts.length) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[80] flex w-[min(100%-2rem,22rem)] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`flex items-start gap-2 rounded-xl border px-3 py-3 shadow-lg ${toneClass[toast.tone]}`}
        >
          <p className="flex-1 text-sm leading-relaxed text-slate-800">{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label={dismissLabel}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5 hover:text-slate-800"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}
