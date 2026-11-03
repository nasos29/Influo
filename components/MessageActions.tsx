"use client";
import { useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { QUICK_REACTIONS } from "@/lib/reactions";

const EmojiPicker = dynamic(() => import("@/components/EmojiPicker"), { ssr: false });

type Props = {
  own: boolean;
  pinned: boolean;
  disabled?: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onPin: () => void;
  children: ReactNode;
};

/** Wraps a bubble: hover toolbar on desktop, long-press sheet + swipe-right-to-reply on touch. */
export default function MessageActions({ own, pinned, disabled, onReply, onReact, onPin, children }: Props) {
  const [sheet, setSheet] = useState(false);
  const [picker, setPicker] = useState(false);
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const press = useRef<number | null>(null);
  const swiping = useRef(false);

  if (disabled) return <>{children}</>;

  const clearPress = () => {
    if (press.current) window.clearTimeout(press.current);
    press.current = null;
  };
  const react = (e: string) => {
    onReact(e);
    setSheet(false);
    setPicker(false);
  };

  return (
    <div
      className={`group relative flex items-center gap-1 ${own ? "flex-row-reverse" : ""}`}
      onTouchStart={(e) => {
        const t = e.touches[0];
        start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
        swiping.current = false;
        clearPress();
        press.current = window.setTimeout(() => {
          if (!swiping.current) {
            try { navigator.vibrate?.(15); } catch { /* noop */ }
            setSheet(true);
          }
        }, 450);
      }}
      onTouchMove={(e) => {
        const s = start.current;
        if (!s) return;
        const t = e.touches[0];
        const mx = t.clientX - s.x;
        const my = Math.abs(t.clientY - s.y);
        if (Math.abs(mx) > 8 || my > 8) clearPress();
        if (mx > 10 && my < 30) {
          swiping.current = true;
          setDx(Math.min(mx, 80));
        }
      }}
      onTouchEnd={() => {
        clearPress();
        if (dx >= 60) onReply();
        setDx(0);
        start.current = null;
      }}
      onContextMenu={(e) => {
        if (window.matchMedia("(hover: none)").matches) e.preventDefault();
      }}
    >
      {dx > 0 ? (
        <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-slate-400" style={{ opacity: dx / 60 }} aria-hidden>
          ↩
        </span>
      ) : null}
      <div style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? "none" : "transform 150ms" }} className="min-w-0 max-w-full">
        {children}
      </div>
      <div className="relative hidden shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:hover)]:flex">
        <button type="button" onClick={onReply} title="Απάντηση" aria-label="Απάντηση" className="h-7 w-7 rounded-full text-slate-500 hover:bg-slate-100">↩</button>
        <button type="button" data-emoji-toggle onClick={() => setPicker((v) => !v)} title="Αντίδραση" aria-label="Αντίδραση" className="h-7 w-7 rounded-full text-slate-500 hover:bg-slate-100">☺</button>
        <button type="button" onClick={onPin} title={pinned ? "Ξεκαρφίτσωμα" : "Καρφίτσωμα"} aria-label={pinned ? "Ξεκαρφίτσωμα" : "Καρφίτσωμα"} className="h-7 w-7 rounded-full text-slate-500 hover:bg-slate-100">📌</button>
        {picker ? (
          <div className={`absolute bottom-full z-30 mb-1 ${own ? "right-0" : "left-0"}`}>
            <div className="mb-1 flex gap-0.5 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-lg">
              {QUICK_REACTIONS.map((e) => (
                <button key={e} type="button" onClick={() => react(e)} className="h-8 w-8 rounded-full text-xl hover:bg-slate-100 hover:scale-110 transition-transform">{e}</button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {sheet ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => { setSheet(false); setPicker(false); }} aria-hidden />
          {picker ? (
            <EmojiPicker onPick={react} onClose={() => { setPicker(false); setSheet(false); }} />
          ) : (
            <div role="dialog" aria-label="Ενέργειες μηνύματος" className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-2xl">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" aria-hidden />
              <div className="mb-3 flex justify-between">
                {QUICK_REACTIONS.map((e) => (
                  <button key={e} type="button" onClick={() => react(e)} className="h-12 w-12 rounded-full text-2xl active:scale-90 transition-transform">{e}</button>
                ))}
                <button type="button" data-emoji-toggle onClick={() => setPicker(true)} aria-label="Περισσότερα emoji" className="h-12 w-12 rounded-full bg-slate-100 text-xl">＋</button>
              </div>
              <button type="button" onClick={() => { setSheet(false); onReply(); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-slate-800 active:bg-slate-100">↩ Απάντηση</button>
              <button type="button" onClick={() => { setSheet(false); onPin(); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-slate-800 active:bg-slate-100">📌 {pinned ? "Ξεκαρφίτσωμα" : "Καρφίτσωμα"}</button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
