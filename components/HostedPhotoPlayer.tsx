"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import { createPortal } from "react-dom";
import InstagramStaticCarousel from "@/components/InstagramStaticCarousel";
import type { HostedMedia } from "@/lib/creatorMedia";
import { carouselImageList } from "@/lib/hostedMediaRender";

const COPY = {
  expand: { el: "Μεγέθυνση", en: "Enlarge" },
  shrink: { el: "Σμίκρυνση", en: "Shrink" },
} as const;

const ANIM_MS = 220;
const ANIM_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

type Box = { width: number; height: number; left: number; top: number };

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function enlargedBox(srcW: number, srcH: number): Box {
  const aspect = srcW / Math.max(1, srcH);
  const pad = 16;
  const viewW = typeof window !== "undefined" ? window.innerWidth : srcW;
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const viewH = vv?.height ?? (typeof window !== "undefined" ? window.innerHeight : srcH);
  const offsetTop = vv?.offsetTop ?? 0;
  const offsetLeft = vv?.offsetLeft ?? 0;
  const maxW = Math.max(0, viewW - pad * 2);
  const maxH = Math.max(0, viewH - pad * 2);
  let width = srcW * 2;
  let height = srcH * 2;
  if (width > maxW) {
    width = maxW;
    height = width / aspect;
  }
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }
  return {
    width,
    height,
    left: offsetLeft + (viewW - width) / 2,
    top: offsetTop + (viewH - height) / 2,
  };
}

function invertTransform(from: Box, to: Box): string {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const sx = from.width / Math.max(1, to.width);
  const sy = from.height / Math.max(1, to.height);
  return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
}

function readBox(el: HTMLElement | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return { width: r.width, height: r.height, left: r.left, top: r.top };
}

/**
 * In-card viewer for self-hosted photos and carousels (no play chrome).
 */
export default function HostedPhotoPlayer({
  media,
  lang = "el",
}: {
  media: HostedMedia;
  lang?: "el" | "en";
}) {
  const uiLang = lang === "en" ? "en" : "el";
  const images = carouselImageList(media);
  const isCarousel = media.mediaType === "carousel" && images.length > 1;
  const slotRef = useRef<HTMLDivElement | null>(null);
  const closingRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [slotBox, setSlotBox] = useState<Box | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [expandedBox, setExpandedBox] = useState<Box | null>(null);
  const [closing, setClosing] = useState(false);
  const [flip, setFlip] = useState("");
  const [flipReady, setFlipReady] = useState(false);

  const lightbox = expanded || closing;
  const box = lightbox && expandedBox ? expandedBox : slotBox;

  const finishClose = useCallback(() => {
    closingRef.current = false;
    setClosing(false);
    setExpanded(false);
    setExpandedBox(null);
    setFlip("");
    setFlipReady(false);
  }, []);

  const collapse = useCallback(() => {
    if (closingRef.current || !expanded) return;
    const from = readBox(slotRef.current) || slotBox;
    const to = expandedBox;
    if (!from || !to || prefersReducedMotion()) {
      finishClose();
      return;
    }
    closingRef.current = true;
    setClosing(true);
    setFlipReady(true);
    setFlip(invertTransform(from, to));
  }, [expanded, expandedBox, slotBox, finishClose]);

  const expand = useCallback(() => {
    if (expanded || closingRef.current) {
      collapse();
      return;
    }
    const from = readBox(slotRef.current) || slotBox;
    if (!from) return;
    const to = enlargedBox(from.width, from.height);
    setExpandedBox(to);
    setExpanded(true);
    setClosing(false);
    if (prefersReducedMotion()) {
      setFlip("");
      setFlipReady(true);
      return;
    }
    setFlipReady(false);
    setFlip(invertTransform(from, to));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlipReady(true);
        setFlip("");
      });
    });
  }, [expanded, slotBox, collapse]);

  useLayoutEffect(() => {
    setMounted(true);
    const next = readBox(slotRef.current);
    if (next) setSlotBox(next);
  }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    const update = () => {
      const next = readBox(slotRef.current);
      if (next) setSlotBox(next);
    };
    update();
    const slot = slotRef.current;
    const ro = new ResizeObserver(update);
    if (slot) ro.observe(slot);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [mounted]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        collapse();
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox, collapse]);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(finishClose, ANIM_MS + 80);
    return () => window.clearTimeout(timer);
  }, [closing, finishClose]);

  const onShellTransitionEnd = useCallback(
    (event: ReactTransitionEvent<HTMLDivElement>) => {
      if (event.propertyName !== "transform") return;
      if (closingRef.current) finishClose();
    },
    [finishClose]
  );

  const reduceMotion = mounted && prefersReducedMotion();
  const backdropOpen = expanded && !closing && (flipReady || reduceMotion);
  const cover = images[0] || media.posterUrl || media.playUrl;

  const shell = box ? (
    <div
      data-hosted-shell="true"
      data-hosted-expanded={expanded && !closing ? "true" : "false"}
      className="overflow-hidden bg-black"
      style={{
        position: "fixed",
        width: box.width,
        height: box.height,
        left: box.left,
        top: box.top,
        zIndex: lightbox ? 210 : 20,
        borderRadius: 12,
        boxShadow: lightbox ? "0 25px 50px -12px rgba(0,0,0,0.45)" : "none",
        transform: flip || "none",
        transformOrigin: "top left",
        transition:
          !flipReady || reduceMotion
            ? "none"
            : `transform ${ANIM_MS}ms ${ANIM_EASE}, box-shadow ${ANIM_MS}ms ${ANIM_EASE}`,
      }}
      onTransitionEnd={onShellTransitionEnd}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-hosted-expand]")) return;
        expand();
      }}
    >
      {isCarousel ? (
        <InstagramStaticCarousel images={images} lang={uiLang} />
      ) : cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- self-hosted WebP on our CDN
        <img
          src={cover}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 z-[5] h-full w-full object-cover"
          draggable={false}
        />
      ) : null}
      {lightbox ? (
        <button
          type="button"
          data-hosted-close="true"
          className="absolute right-2 top-2 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white shadow-md hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          aria-label={COPY.shrink[uiLang]}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            collapse();
          }}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
            <path d="M18.3 5.71 12 12.01 5.7 5.7 4.29 7.11 10.59 13.4 4.29 19.7 5.7 21.11 12 14.82 18.29 21.11 19.7 19.7 13.41 13.4 19.71 7.11z" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          data-hosted-expand="true"
          className="absolute right-2 bottom-2 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white shadow-md hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          aria-label={COPY.expand[uiLang]}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            expand();
          }}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
            <path d="M7 14H5v5h5v-2H7v-3zm0-9h2v3h3v2H5V5h2zm12 12h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
          </svg>
        </button>
      )}
    </div>
  ) : null;

  return (
    <>
      <div ref={slotRef} className="pointer-events-none absolute inset-0" aria-hidden />
      {mounted
        ? createPortal(
            <>
              {lightbox ? (
                <div
                  data-hosted-backdrop="true"
                  className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md"
                  style={{
                    opacity: backdropOpen ? 1 : 0,
                    transition: reduceMotion ? "none" : `opacity ${ANIM_MS}ms ${ANIM_EASE}`,
                  }}
                  onClick={collapse}
                />
              ) : null}
              {shell}
            </>,
            document.body
          )
        : null}
    </>
  );
}