"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

/** TikTok player/v1 and embed/v2 fail below ~325px layout width ("Unable to load player"). */
export const TIKTOK_PLAYER_MIN_IFRAME_WIDTH = 325;

/**
 * Native video aspect (height / width). Official player/v1 oEmbed is 325x578,
 * which is 9:16. Covers are object-cover in a box that may be 2:3 or minHeight-tall.
 */
export const TIKTOK_PLAYER_VIDEO_ASPECT = 16 / 9;

/**
 * Classic embed/v2 iframe is taller than the 9:16 video because of author /
 * caption chrome. Common default size is 325x739; the video sits at the top.
 * @see https://stackoverflow.com/questions/78246584
 */
export const TIKTOK_EMBED_V2_IFRAME_WIDTH = 325;
export const TIKTOK_EMBED_V2_IFRAME_HEIGHT = 739;
export const TIKTOK_EMBED_V2_CHROME_RATIO =
  (TIKTOK_EMBED_V2_IFRAME_HEIGHT - TIKTOK_EMBED_V2_IFRAME_WIDTH * TIKTOK_PLAYER_VIDEO_ASPECT) /
  TIKTOK_EMBED_V2_IFRAME_WIDTH;

export type TikTokIframeVariant = "player" | "embed";

export type TikTokIframeScale = {
  style: CSSProperties | undefined;
  /** True after the container size has been read at least once. */
  measured: boolean;
};

export type TikTokIframeScaleOptions = {
  /**
   * Once the iframe is mounted, keep the first locked box size. ResizeObserver
   * updates (mobile chrome URL bar, scroll) would otherwise change transform
   * mid-init and can make TikTok show "Unable to load player".
   */
  freeze?: boolean;
  /** player/v1 is 9:16; embed/v2 adds chrome below the video. */
  variant?: TikTokIframeVariant;
};

export function tikTokIframeVariantFromSrc(src: string | null | undefined): TikTokIframeVariant {
  if (src && /tiktok\.com\/embed\/v2\//i.test(src)) return "embed";
  return "player";
}

/**
 * Size a TikTok iframe so that, after CSS scale, the 9:16 *video* object-covers
 * the cover box (same visual fill as the poster). Layout width is at least 325px.
 * For embed/v2 the iframe is taller than the video; overflow on the wrapper
 * crops the chrome (and any overflow of the video itself). The cover box size
 * is not changed.
 */
export function tikTokIframeScaleStyle(
  boxWidth: number,
  boxHeight = 0,
  variant: TikTokIframeVariant = "player"
): CSSProperties | undefined {
  if (boxWidth <= 0) return undefined;
  const height = boxHeight > 0 ? boxHeight : boxWidth * 1.5;
  if (height <= 0) return undefined;
  const layoutW = Math.max(TIKTOK_PLAYER_MIN_IFRAME_WIDTH, boxWidth);
  const videoH = layoutW * TIKTOK_PLAYER_VIDEO_ASPECT;
  const chromeH = variant === "embed" ? layoutW * TIKTOK_EMBED_V2_CHROME_RATIO : 0;
  const layoutH = videoH + chromeH;
  const scale = Math.max(boxWidth / layoutW, height / videoH);
  const visualVideoW = layoutW * scale;
  const visualVideoH = videoH * scale;
  // Video is at the top of the iframe; center that region in the cover box.
  return {
    position: "absolute",
    top: (height - visualVideoH) / 2,
    left: (boxWidth - visualVideoW) / 2,
    width: layoutW,
    height: layoutH,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  };
}

/**
 * Measure the cover box and return an object-cover style for the TikTok iframe.
 * Enable while the cover is visible so the first Play tap mounts already sized.
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
  const variant = options?.variant ?? "player";

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

  return { style: tikTokIframeScaleStyle(boxWidth, boxHeight, variant), measured };
}
