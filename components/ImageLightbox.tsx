"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Full-screen photo viewer: dark backdrop, fade + zoom in, closes on X, Esc, backdrop click or swipe down.
 */
export default function ImageLightbox({ src, alt, open, onClose, lang = "el" }: { src: string; alt: string; open: boolean; onClose: () => void; lang?: "el" | "en" }) {
  const [shown, setShown] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => setShown(true));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") { e.preventDefault(); closeRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      setShown(false);
      setDragY(0);
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const label = lang === "el" ? "Κλείσιμο" : "Close";
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/85 backdrop-blur-sm transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
      onClick={onClose}
      onTouchStart={(e) => { touchY.current = e.touches[0].clientY; }}
      onTouchMove={(e) => { if (touchY.current != null) setDragY(Math.max(0, e.touches[0].clientY - touchY.current)); }}
      onTouchEnd={() => { if (dragY > 80) onClose(); else setDragY(0); touchY.current = null; }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        style={{ transform: `translateY(${dragY}px) scale(${shown ? 1 : 0.92})`, opacity: dragY ? Math.max(0.4, 1 - dragY / 400) : undefined }}
        className="max-w-full max-h-[88vh] rounded-2xl object-contain shadow-2xl transition-transform duration-200 ease-out select-none"
        draggable={false}
      />
      <button
        ref={closeRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-slate-900 text-2xl leading-none shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        aria-label={label}
      >
        ×
      </button>
    </div>,
    document.body
  );
}
