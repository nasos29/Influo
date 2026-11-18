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
   * Once the iframe is mounted, keep the first locked box size. ResizeObserver
   * updates (mobile chrome URL bar, scroll) would otherwise change transform
   * mid-init and can make TikTok show "Unable to load player".
   */
  freeze?: boolean;
};

/**
 * Layout size for a TikTok iframe that CSS-scales to fill a narrower cover box.
 * Width is a fixed 325px (TikTok's minimum). Height is the cover height divided
 * by the same scale, in pixels, so after `transform: scale(...)` the visual
 * size equals the cover exactly — no percentage-height cycle on the aspect box.
 */
export function tikTokIframeScaleStyle(boxWidth: number, boxHeight = 0): CSSProperties | undefined {
  if (boxWidth <= 0 || boxWidth >= TIKTOK_PLAYER_MIN_IFRAME_WIDTH) return undefined;
  const scale = boxWidth / TIKTOK_PLAYER_MIN_IFRAME_WIDTH;
  const height = boxHeight > 0 ? boxHeight / scale : `${(1 / scale) * 100}%`;
  return {
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    width: TIKTOK_PLAYER_MIN_IFRAME_WIDTH,
    height,
  };
}

/**
 * CSS-scale a TikTok player/v1 or embed/v2 iframe so the layout width is
 * ≥325px inside a narrower box. Enable while the cover is visible so the
 * first Play tap can mount the iframe already sized to that same box.
 */
export function useTikTokIframeScale(
  enabled: boolean,
  containerRef: RefObject<HTMLElement | null>,
  options?: TikTokIframeScaleOptions
): TikTokIframeScale {
  const [boxWidth, setBoxWidth] = useState(0);
  const [boxHeight, setBoxHeight] = useState(0);
  const [measured, setMeasured] = useState(false);
  const frozenRef = useRef<{ width: number; height: number } | null>(null);
  const freeze = Boolean(options?.freeze);

  useLayoutEffect(() => {
    if (!enabled) {
      frozenRef.current = null;
      setBoxWidth(0);
      setBoxHeight(0);
      setMeasured(false);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const apply = (width: number, height: number) => {
      setBoxWidth(width);
      setBoxHeight(height);
      setMeasured(true);
    };

    const measure = () => {
      if (freeze && frozenRef.current) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (freeze) frozenRef.current = { width: rect.width, height: rect.height };
      apply(rect.width, rect.height);
    };
    measure();
    if (freeze && frozenRef.current) return;

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, enabled, freeze]);

  return { style: tikTokIframeScaleStyle(boxWidth, boxHeight), measured };
}
