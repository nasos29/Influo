"use client";

import type { ReactNode } from "react";

export type NextStepItem = {
  id: string;
  title: string;
  why?: string;
  cta: string;
  how?: ReactNode;
  done?: boolean;
  onAction: () => void;
};

export default function NextStepsChecklist({
  lang,
  setupSteps,
  alerts = [],
}: {
  lang: "el" | "en";
  setupSteps: NextStepItem[];
  alerts?: NextStepItem[];
}) {
  const total = setupSteps.length;
  const doneCount = setupSteps.filter((step) => step.done).length;
  const remaining = setupSteps.filter((step) => !step.done);
  const completed = setupSteps.filter((step) => step.done);
  const allSetupDone = total > 0 && doneCount === total;
  const empty = allSetupDone && alerts.length === 0;
  const progressLabel =
    total === 0
      ? ""
      : lang === "el"
        ? `${doneCount} από ${total} ολοκληρώθηκαν`
        : `${doneCount} of ${total} completed`;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base sm:text-lg font-semibold text-slate-900">
          {lang === "el" ? "Επόμενα βήματα" : "Next steps"}
        </h2>
        {total > 0 ? (
          <p
            className="shrink-0 text-sm font-semibold tabular-nums text-slate-600"
            aria-label={progressLabel}
          >
            {doneCount}/{total}
          </p>
        ) : null}
      </div>
      {total > 0 ? (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={doneCount}
          aria-label={progressLabel}
        >
          <div
            className="h-full rounded-full bg-blue-600 transition-[width]"
            style={{ width: `${Math.round((doneCount / total) * 100)}%` }}
          />
        </div>
      ) : null}

      {alerts.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {alerts.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
            >
              <p className="text-sm leading-relaxed text-amber-950">{item.title}</p>
              <button
                type="button"
                onClick={item.onAction}
                className="shrink-0 min-h-11 px-3 text-sm font-medium text-amber-900 hover:bg-amber-100 rounded-lg"
              >
                {item.cta}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {empty ? (
        <p className="mt-4 text-sm text-slate-600">
          {lang === "el"
            ? "Είσαι ενήμερος. Δεν εκκρεμεί κάποιο βήμα."
            : "You are up to date. Nothing is waiting."}
        </p>
      ) : remaining.length > 0 ? (
        <ul className="mt-4 divide-y divide-slate-100">
          {remaining.map((step) => (
            <li key={step.id} className="py-3 first:pt-1 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm font-medium text-slate-900">{step.title}</p>
                <button
                  type="button"
                  onClick={step.onAction}
                  className="shrink-0 min-h-11 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-lg"
                >
                  {step.cta}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : allSetupDone && alerts.length > 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          {lang === "el" ? "Το προφίλ είναι συμπληρωμένο." : "Your profile setup is complete."}
        </p>
      ) : null}

      {completed.length > 0 && remaining.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">
            {lang === "el" ? `Ολοκληρώθηκαν (${completed.length})` : `Completed (${completed.length})`}
          </summary>
          <ul className="mt-2 space-y-1">
            {completed.map((step) => (
              <li key={step.id} className="flex items-center gap-2 text-sm text-slate-500">
                <span aria-hidden="true" className="text-emerald-600">
                  ✓
                </span>
                {step.title}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}