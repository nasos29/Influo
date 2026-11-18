"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/** TikTok player/v1 fails below ~325px visible width ("Unable to load player"). */
export const TIKTOK_PLAYER_MIN_IFRAME_WIDTH = 325;

export function tikTokIframeScaleStyle(boxWidth: number): CSSProperties | undefined {
  if (boxWidth <= 0 || boxWidth >= TIKTOK_PLAYER_MIN_IFRAME_WIDTH) return undefined;
  const scale = boxWidth / TIKTOK_PLAYER_MIN_IFRAME_WIDTH;
  const invPct = (1 / scale) * 100;
  return {
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    width: `${invPct}%`,
    height: `${invPct}%`,
  };
}

/** CSS-scale a TikTok player/v1 iframe so the layout width is ≥325px inside a narrower box. */
export function useTikTokIframeScale(
  enabled: boolean,
  containerRef: RefObject<HTMLElement | null>
): CSSProperties | undefined {
  const [boxWidth, setBoxWidth] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) {
      setBoxWidth(0);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      setBoxWidth(el.getBoundingClientRect().width);
    };
    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, enabled]);

  return tikTokIframeScaleStyle(boxWidth);
}