"use client";

import { useEffect, useState } from "react";

type ToastItem = { id: number; kind: "ok" | "err"; text: string };
type ConfirmRequest = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  resolve: (value: boolean) => void;
};

let pushToast: ((kind: "ok" | "err", text: string) => void) | null = null;
let pushConfirm: ((request: Omit<ConfirmRequest, "resolve">) => Promise<boolean>) | null = null;
let nextToastId = 1;

export function toastSuccess(text: string) {
  pushToast?.("ok", text);
}

export function toastError(text: string) {
  pushToast?.("err", text);
}

export function askConfirm(opts: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  if (!pushConfirm) return Promise.resolve(false);
  return pushConfirm({
    title: opts.title,
    body: opts.body,
    confirmLabel: opts.confirmLabel,
    cancelLabel: opts.cancelLabel || "Ακύρωση",
    danger: opts.danger,
  });
}

export default function FeedbackHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    pushToast = (kind, text) => {
      const id = nextToastId;
      nextToastId += 1;
      setToasts((prev) => [...prev.slice(-4), { id, kind, text }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 5200);
    };
    pushConfirm = (request) =>
      new Promise((resolve) => {
        setConfirm({ ...request, resolve });
      });
    return () => {
      pushToast = null;
      pushConfirm = null;
    };
  }, []);

  const closeConfirm = (value: boolean) => {
    confirm?.resolve(value);
    setConfirm(null);
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-[200] flex w-[min(100%-2rem,22rem)] flex-col gap-2 pointer-events-none">
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg ${
              item.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            {item.text}
          </div>
        ))}
      </div>
      {confirm && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="influo-confirm-title"
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200"
          >
            <h3 id="influo-confirm-title" className="text-lg font-semibold text-slate-900">
              {confirm.title}
            </h3>
            <p className="text-sm text-slate-600 mt-3 leading-relaxed whitespace-pre-wrap">{confirm.body}</p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
              >
                {confirm.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
                  confirm.danger ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
