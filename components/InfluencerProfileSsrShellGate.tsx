"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noopSubscribe = () => () => {};

/** Server + hydration snapshot: show SSR shell (crawler-friendly HTML). */
function serverSnapshot() {
  return false;
}

/** After hydration: hide shell so only the client profile card H1 remains. */
function clientSnapshot() {
  return true;
}

export default function InfluencerProfileSsrShellGate({ children }: { children: ReactNode }) {
  const hideShell = useSyncExternalStore(noopSubscribe, clientSnapshot, serverSnapshot);
  if (hideShell) return null;
  return <div suppressHydrationWarning>{children}</div>;
}