"use client";

type Lang = "el" | "en";

const copy = {
  retry: { el: "Δοκίμασε ξανά", en: "Try again" },
  timeout: { el: "Η φόρτωση διήρκησε πολύ.", en: "This is taking too long." },
  error: { el: "Κάτι πήγε στραβά.", en: "Something went wrong." },
  prev: { el: "Προηγούμενη", en: "Previous" },
  next: { el: "Επόμενη", en: "Next" },
  page: { el: "Σελίδα", en: "Page" },
  of: { el: "από", en: "of" },
  showing: { el: "Εμφάνιση", en: "Showing" },
} as const;

export function AdminListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

export function AdminLoadError({
  lang,
  timedOut,
  onRetry,
}: {
  lang: Lang;
  timedOut?: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm text-slate-600">{timedOut ? copy.timeout[lang] : copy.error[lang]}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white"
      >
        {copy.retry[lang]}
      </button>
    </div>
  );
}

export function AdminPager({
  lang,
  page,
  total,
  pageSize,
  disabled,
  onPage,
}: {
  lang: Lang;
  page: number;
  total: number;
  pageSize: number;
  disabled?: boolean;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        {copy.showing[lang]} {from}–{to} {copy.of[lang]} {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {copy.prev[lang]}
        </button>
        <span className="text-sm text-slate-600 tabular-nums">
          {copy.page[lang]} {page} {copy.of[lang]} {totalPages}
        </span>
        <button
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {copy.next[lang]}
        </button>
      </div>
    </div>
  );
}
