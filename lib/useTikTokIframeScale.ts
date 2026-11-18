"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

/** TikTok player/v1 and embed/v2 fail below ~325px layout width ("Unable to load player"). */
export const TIKTOK_PLAYER_MIN_IFRAME_WIDTH = 325;

export type TikTokIframeScale = {
  style: CSSProperties | undefined;
  /** True after the container width has been read at least once. */
  measured: boolean;
};

export type TikTokIframeScaleOptions = {
  /**
   * Once the iframe is mounted, keep the first locked width. ResizeObserver
   * updates (mobile chrome URL bar, scroll) would otherwise change transform
   * mid-init and can make TikTok show "Unable to load player".
   */
  freeze?: boolean;
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
  containerRef: RefObject<HTMLElement | null>,
  options?: TikTokIframeScaleOptions
): TikTokIframeScale {
  const [boxWidth, setBoxWidth] = useState(0);
  const [measured, setMeasured] = useState(false);
  const frozenWidthRef = useRef<number | null>(null);
  const freeze = Boolean(options?.freeze);

  useLayoutEffect(() => {
    if (!enabled) {
      frozenWidthRef.current = null;
      setBoxWidth(0);
      setMeasured(false);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const apply = (width: number) => {
      setBoxWidth(width);
      setMeasured(true);
    };

    const measure = () => {
      if (freeze && frozenWidthRef.current != null) return;
      const width = el.getBoundingClientRect().width;
      if (width <= 0) return;
      if (freeze) frozenWidthRef.current = width;
      apply(width);
    };
    measure();
    if (freeze && frozenWidthRef.current != null) return;

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, enabled, freeze]);

  return { style: tikTokIframeScaleStyle(boxWidth), measured };
}
