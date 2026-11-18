"use client";

import { useSyncExternalStore } from "react";

/**
 * Phones and most tablets: a narrow viewport, or a coarse pointer with no
 * hover (touch-first). Desktop mouse / trackpad UIs stay on the in-card player.
 */
export function preferTikTokFullscreenModalFromEnv(env: {
  width: number;
  coarsePointer: boolean;
  hoverNone: boolean;
}): boolean {
  if (env.width > 0 && env.width <= 767) return true;
  return Boolean(env.coarsePointer && env.hoverNone);
}

function getSnapshot(): boolean {
  return preferTikTokFullscreenModalFromEnv({
    width: window.innerWidth,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    hoverNone: window.matchMedia("(hover: none)").matches,
  });
}

function subscribe(onStoreChange: () => void): () => void {
  const qNarrow = window.matchMedia("(max-width: 767px)");
  const qCoarse = window.matchMedia("(pointer: coarse)");
  const qHoverNone = window.matchMedia("(hover: none)");
  qNarrow.addEventListener("change", onStoreChange);
  qCoarse.addEventListener("change", onStoreChange);
  qHoverNone.addEventListener("change", onStoreChange);
  window.addEventListener("resize", onStoreChange);
  return () => {
    qNarrow.removeEventListener("change", onStoreChange);
    qCoarse.removeEventListener("change", onStoreChange);
    qHoverNone.removeEventListener("change", onStoreChange);
    window.removeEventListener("resize", onStoreChange);
  };
}

export function usePreferTikTokFullscreenModal(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
