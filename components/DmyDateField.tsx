"use client";

import { useEffect, useId, useRef, useState } from "react";
import { dmyToYmd, isImpossibleDmy, maskDmyInput, ymdToDmy } from "@/lib/formatDate";

const MONTHS = {
  el: [
    "Ιανουάριος",
    "Φεβρουάριος",
    "Μάρτιος",
    "Απρίλιος",
    "Μάιος",
    "Ιούνιος",
    "Ιούλιος",
    "Αύγουστος",
    "Σεπτέμβριος",
    "Οκτώβριος",
    "Νοέμβριος",
    "Δεκέμβριος",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
} as const;

const WEEKDAYS = {
  el: ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
} as const;

function inRange(ymd: string, min?: string, max?: string): boolean {
  if (min && ymd < min) return false;
  if (max && ymd > max) return false;
  return true;
}

function monthCells(year: number, month: number): Array<number | null> {
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const cells: Array<number | null> = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * One dd/mm/yyyy field plus a small month grid.
 * The parent value stays YYYY-MM-DD, the same format stored today.
 */
export default function DmyDateField({
  value,
  onChange,
  required,
  min,
  max,
  id,
  className,
  ariaLabel,
  lang = "el",
  disabled,
}: {
  value: string;
  onChange: (ymd: string) => void;
  required?: boolean;
  min?: string;
  max?: string;
  id?: string;
  className?: string;
  ariaLabel?: string;
  lang?: "el" | "en";
  disabled?: boolean;
}) {
  const autoId = useId();
  const fieldId = id || autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => ymdToDmy(value));
  const [synced, setSynced] = useState(value);
  const [view, setView] = useState(() => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) return { year: Number(match[1]), month: Number(match[2]) };
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  });

  if (value !== synced && !focused.current) {
    setSynced(value);
    setText(ymdToDmy(value));
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const publish = (ymd: string) => {
    setSynced(ymd);
    onChange(ymd);
  };

  const onText = (raw: string) => {
    const next = maskDmyInput(raw, text);
    const caret = inputRef.current?.selectionStart ?? raw.length;
    const typedAtEnd = caret >= raw.length;
    setText(next);
    if (typedAtEnd && next !== raw) {
      requestAnimationFrame(() => {
        const node = inputRef.current;
        if (!node || document.activeElement !== node) return;
        node.setSelectionRange(next.length, next.length);
      });
    }
    if (!next) {
      publish("");
      return;
    }
    const ymd = dmyToYmd(next);
    if (ymd) publish(ymd);
    else if (value) publish("");
  };

  const onBlur = () => {
    focused.current = false;
    const ymd = dmyToYmd(text);
    if (ymd) {
      setText(ymdToDmy(ymd));
      return;
    }
    if (isImpossibleDmy(text)) return;
    setText(ymdToDmy(value));
    if (value !== synced) setSynced(value);
  };

  const pick = (day: number) => {
    const ymd = `${view.year}-${String(view.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!inRange(ymd, min, max)) return;
    setText(ymdToDmy(ymd));
    publish(ymd);
    setOpen(false);
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(view.year, view.month - 1 + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() + 1 });
  };

  const openCalendar = () => {
    if (disabled) return;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) setView({ year: Number(match[1]), month: Number(match[2]) });
    setOpen((current) => !current);
  };

  const impossible = isImpossibleDmy(text);
  const invalidMessage = lang === "el" ? "Αυτή η ημερομηνία δεν υπάρχει." : "This date does not exist.";

  useEffect(() => {
    inputRef.current?.setCustomValidity(impossible ? " " : "");
  }, [impossible]);

  const inputClass =
    className ||
    "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white";
  const placeholder = lang === "el" ? "ηη/μμ/εεεε" : "dd/mm/yyyy";
  const label = ariaLabel || (lang === "el" ? "Ημερομηνία (ηη/μμ/εεεε)" : "Date (dd/mm/yyyy)");
  const cells = monthCells(view.year, view.month);
  const selected = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  return (
    <div ref={rootRef}>
      <div className="relative">
      <input
        ref={inputRef}
        id={fieldId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={impossible}
        aria-describedby={impossible ? `${fieldId}-error` : undefined}
        value={text}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(event) => onText(event.target.value)}
        onBlur={onBlur}
        onInvalid={(event) => {
          if (impossible) event.preventDefault();
        }}
        className={`${inputClass} pr-10 tabular-nums`}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={lang === "el" ? "Άνοιγμα ημερολογίου" : "Open calendar"}
        aria-expanded={open}
        aria-controls={`${fieldId}-calendar`}
        onClick={openCalendar}
        className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
        </svg>
      </button>
      {open ? (
        <div
          id={`${fieldId}-calendar`}
          role="dialog"
          aria-label={lang === "el" ? "Ημερολόγιο" : "Calendar"}
          onMouseDown={(event) => event.preventDefault()}
          className="absolute left-0 z-50 mt-1 w-[17.5rem] rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label={lang === "el" ? "Προηγούμενος μήνας" : "Previous month"}
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-slate-900">
              {MONTHS[lang][view.month - 1]} {view.year}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label={lang === "el" ? "Επόμενος μήνας" : "Next month"}
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
            {WEEKDAYS[lang].map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const ymd = `${view.year}-${String(view.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const disabledDay = !inRange(ymd, min, max);
              const isSelected = !!selected && Number(selected[1]) === view.year && Number(selected[2]) === view.month && Number(selected[3]) === day;
              return (
                <button
                  key={ymd}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => pick(day)}
                  className={`h-8 rounded-lg text-sm tabular-nums ${
                    isSelected
                      ? "bg-blue-600 font-semibold text-white"
                      : disabledDay
                        ? "text-slate-300"
                        : "text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      </div>
      {impossible ? (
        <p id={`${fieldId}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {invalidMessage}
        </p>
      ) : null}
    </div>
  );
}
