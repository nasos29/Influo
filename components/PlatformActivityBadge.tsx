"use client";

import { useEffect, useState } from "react";

/** «X συνεργασίες αυτόν τον μήνα»: anonymous, hidden when 0. */
export default function PlatformActivityBadge({ className = "" }: { className?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch("/api/platform/activity")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && Number(d.collaborationsThisMonth) > 0) setCount(Number(d.collaborationsThisMonth));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (count <= 0) return null;
  return (
    <p className={`inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
      {count === 1 ? "1 συνεργασία αυτόν τον μήνα" : `${count} συνεργασίες αυτόν τον μήνα`}
    </p>
  );
}
