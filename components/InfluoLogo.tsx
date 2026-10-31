"use client";

import { useId } from "react";
import styles from "./influoLogo.module.css";

/**
 * Wordmark used in the header, footer, and other brand spots.
 * Three dots play one short staggered entrance on load and again on hover.
 */
export default function InfluoLogo({
  className = "h-10 w-auto",
  title = "Influo",
}: {
  className?: string;
  /** Empty string marks the mark as decorative. */
  title?: string;
}) {
  const gradId = `influo-grad-${useId().replace(/:/g, "")}`;
  const decorative = title === "";

  return (
    <svg
      viewBox="0 0 104 36"
      className={`${styles.logo} ${className}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative ? true : undefined}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <g className={`${styles.dot} ${styles.d1}`}>
        <circle cx="4" cy="18" r="3" fill={`url(#${gradId})`} />
      </g>
      <rect x="7.15" y="17.15" width="3.7" height="1.7" rx="0.85" fill={`url(#${gradId})`} opacity="0.55" />
      <g className={`${styles.dot} ${styles.d2}`}>
        <circle cx="14" cy="18" r="3" fill={`url(#${gradId})`} opacity="0.7" />
      </g>
      <rect x="17.15" y="17.15" width="3.7" height="1.7" rx="0.85" fill={`url(#${gradId})`} opacity="0.55" />
      <g className={`${styles.dot} ${styles.d3}`}>
        <circle cx="24" cy="18" r="3" fill={`url(#${gradId})`} opacity="0.5" />
      </g>
      <text
        x="34"
        y="18.5"
        fill={`url(#${gradId})`}
        fontFamily="var(--font-roboto), Roboto, Arial, sans-serif"
        fontSize="20"
        fontWeight="700"
        letterSpacing="-0.4"
        dominantBaseline="central"
      >
        INFLUO
      </text>
    </svg>
  );
}
