"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type CountUpProps = {
  /** Final integer value (also rendered in SSR HTML for SEO / no-JS). */
  value: number;
  /** Animation duration in ms (default ~1.5s). */
  durationMs?: number;
  className?: string;
};

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Count from 0 → value once when the element enters the viewport.
 * SSR / no-JS: final value is in the HTML. Reduced motion: no animation.
 */
export default function CountUp({ value, durationMs = 1500, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const played = useRef(false);
  const reduced = useRef(false);

  useLayoutEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) {
      setDisplay(value);
      return;
    }
    // Reset before paint so JS users don't flash the final value, then wait for IO.
    setDisplay(0);
  }, [value]);

  useEffect(() => {
    if (reduced.current || played.current) return;
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    let raf = 0;
    const startAnim = () => {
      if (played.current) return;
      played.current = true;
      const start = performance.now();
      const from = 0;
      const to = value;

      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const next = Math.round(from + (to - from) * easeOutCubic(t));
        setDisplay(next);
        if (t < 1) raf = requestAnimationFrame(tick);
        else setDisplay(to);
      };
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          startAnim();
          io.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, durationMs]);

  return (
    <span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {display}
    </span>
  );
}
