"use client";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { formatDisplayDate } from "@/lib/formatDate";

export type AnnouncementReadItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

const COPY = {
  el: { close: "Κλείσιμο", closeAria: "Κλείσιμο ανακοίνωσης" },
  en: { close: "Close", closeAria: "Close announcement" },
} as const;

/** One announcement, shared by the creator and brand dashboards. */
export default function AnnouncementReadModal({
  item,
  lang,
  onClose,
}: {
  item: AnnouncementReadItem | null;
  lang: "el" | "en";
  onClose: () => void;
}) {
  const copy = COPY[lang];
  const titleId = "announcement-read-title";
  const dateLabel = item ? formatDisplayDate(item.createdAt) : "";

  return (
    <ResponsiveDialog open={!!item} onClose={onClose} labelledBy={titleId} wide>
      {item ? (
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                {item.title}
              </h2>
              {dateLabel ? (
                <p className="mt-1 text-sm tabular-nums text-slate-500">{dateLabel}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={copy.closeAria}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              ×
            </button>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.body}</p>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              {copy.close}
            </button>
          </div>
        </div>
      ) : null}
    </ResponsiveDialog>
  );
}
