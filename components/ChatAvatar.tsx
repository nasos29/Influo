"use client";
import { useState } from "react";

export default function ChatAvatar({ src, name, size = 40, onClick }: { src?: string | null; name: string; size?: number; onClick?: () => void }) {
  const [broken, setBroken] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  const inner =
    src && !broken ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-full w-full object-cover" />
    ) : (
      <span aria-hidden>{initial}</span>
    );
  const cls = "rounded-full overflow-hidden bg-slate-200 text-slate-600 font-semibold flex items-center justify-center shrink-0 ring-1 ring-black/5";
  if (onClick && src && !broken)
    return (
      <button type="button" onClick={onClick} aria-label={`Προβολή φωτογραφίας: ${name}`} className={`${cls} cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`} style={style}>
        {inner}
      </button>
    );
  return <span className={cls} style={style}>{inner}</span>;
}
