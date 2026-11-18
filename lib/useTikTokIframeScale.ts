"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/** TikTok player/v1 and embed/v2 fail below ~325px layout width ("Unable to load player"). */
export const TIKTOK_PLAYER_MIN_IFRAME_WIDTH = 325;

export type TikTokIframeScale = {
  style: CSSProperties | undefined;
  /** True after the container width has been read at least once. */
  measured: boolean;
};

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

/**
 * CSS-scale a TikTok player/v1 or embed/v2 iframe so the layout width is
 * ≥325px inside a narrower box. Enable while the cover is visible so the
 * first Play tap can mount the iframe already sized.
 */
export function useTikTokIframeScale(
  enabled: boolean,
  containerRef: RefObject<HTMLElement | null>
): TikTokIframeScale {
  const [boxWidth, setBoxWidth] = useState(0);
  const [measured, setMeasured] = useState(false);

  useLayoutEffect(() => {
    if (!enabled) {
      setBoxWidth(0);
      setMeasured(false);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      setBoxWidth(el.getBoundingClientRect().width);
      setMeasured(true);
    };
    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, enabled]);

  return { style: tikTokIframeScaleStyle(boxWidth), measured };
}
