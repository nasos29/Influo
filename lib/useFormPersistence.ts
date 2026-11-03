"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/** useState mirrored into sessionStorage, so a modal/wizard keeps its answers across close, reload and back. */
export function useSessionState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = sessionStorage.getItem(key);
      return raw == null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage blocked */
    }
  }, [key, value]);
  return [value, setValue];
}

export function clearSessionKeys(prefix: string) {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith(prefix)) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

let ignorePops = 0;

/**
 * While `active`, the browser / mobile back gesture calls `onBack` instead of leaving the page.
 * `onBack` returns true to stay (e.g. went to the previous step) or false to close.
 */
export function useBackGesture(active: boolean, onBack: () => boolean) {
  const cb = useRef(onBack);
  cb.current = onBack;
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const marker = { influoStep: Math.random() };
    window.history.pushState({ ...(window.history.state || {}), ...marker }, "");
    let popped = false;
    const onPop = () => {
      if (ignorePops > 0) {
        ignorePops--;
        return;
      }
      if (cb.current()) window.history.pushState({ ...(window.history.state || {}), ...marker }, "");
      else popped = true;
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed via a button: drop our extra history entry so Back isn't "eaten" later.
      if (!popped && window.history.state?.influoStep === marker.influoStep) {
        ignorePops++;
        window.history.back();
      }
    };
  }, [active]);
}
