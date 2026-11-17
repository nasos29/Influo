"use client";

import { firstLink, splitLinks } from "@/lib/linkify";
import LinkPreview from "@/components/LinkPreview";

/** Shared bubble body: wraps long URLs on mobile and linkifies http(s) links. */
export default function ChatBubbleText({
  content,
  own,
  showPreview = true,
  className = "",
}: {
  content: string;
  own?: boolean;
  showPreview?: boolean;
  className?: string;
}) {
  const text = content || "";
  if (!text) return null;
  return (
    <>
      <p
        className={`text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed min-w-0 max-w-full ${className}`}
      >
        {splitLinks(text).map((part, pi) =>
          part.type === "link" ? (
            <a
              key={pi}
              href={part.value}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline underline-offset-2 break-all [overflow-wrap:anywhere] ${
                own ? "text-white" : "text-blue-700"
              }`}
            >
              {part.value}
            </a>
          ) : (
            <span key={pi}>{part.value}</span>
          )
        )}
      </p>
      {showPreview && firstLink(text) ? <LinkPreview url={firstLink(text) as string} own={!!own} /> : null}
    </>
  );
}
