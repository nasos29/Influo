"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronUp } from "lucide-react";
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_OPEN_EVENT,
  getCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookieConsent";
import { DOCK_CHANGE_EVENT, DOCK_EVENT, DOCK_KEY, type DockedChat } from "@/components/ChatDock";

const SCROLL_THRESHOLD = 600;
const CHAT_WIN_W = 340;
const CHAT_GAP = 12;

function readDockedChats(): DockedChat[] {
  try {
    const v = JSON.parse(localStorage.getItem(DOCK_KEY) || "[]");
    return Array.isArray(v) ? v.filter((c) => c && typeof c.id === "string").slice(0, 3) : [];
  } catch {
    return [];
  }
}

function cookieBannerVisible(choice: CookieConsentValue | null, forceShow: boolean): boolean {
  return choice === null || forceShow;
}

export default function BackToTop() {
  const pathname = usePathname() || "";
  const en = pathname.startsWith("/en");
  const [scrolled, setScrolled] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [cookieChoice, setCookieChoice] = useState<CookieConsentValue | null>(null);
  const [cookieForce, setCookieForce] = useState(false);
  const [dockedChats, setDockedChats] = useState<DockedChat[]>([]);
  const [desktop, setDesktop] = useState(false);

  const show = scrolled;

  const refreshScroll = useCallback(() => {
    setScrolled(window.scrollY >= SCROLL_THRESHOLD);
  }, []);

  useEffect(() => {
    refreshScroll();
    const onScroll = () => refreshScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [refreshScroll]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => setReduceMotion(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => setDesktop(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

  useEffect(() => {
    setCookieChoice(getCookieConsent());
    const onConsent = (e: Event) => {
      const v = (e as CustomEvent<CookieConsentValue>).detail;
      if (v === "accepted" || v === "rejected") {
        setCookieChoice(v);
        setCookieForce(false);
      }
    };
    const onOpen = () => setCookieForce(true);
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsent);
    window.addEventListener(COOKIE_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent);
      window.removeEventListener(COOKIE_OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    const syncDock = () => setDockedChats(readDockedChats());
    syncDock();
    const onStorage = (e: StorageEvent) => e.key === DOCK_KEY && syncDock();
    window.addEventListener(DOCK_EVENT, syncDock);
    window.addEventListener(DOCK_CHANGE_EVENT, syncDock);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DOCK_EVENT, syncDock);
      window.removeEventListener(DOCK_CHANGE_EVENT, syncDock);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const cookieBar = cookieBannerVisible(cookieChoice, cookieForce);

  const position = useMemo(() => {
    let bottom = "1.5rem";
    if (cookieBar) bottom = "9rem";
    let right = "1.5rem";

    if (desktop && dockedChats.length > 0) {
      const anyOpen = dockedChats.some((c) => !c.min);
      const dockSpan = dockedChats.length * CHAT_WIN_W + Math.max(0, dockedChats.length - 1) * CHAT_GAP;
      if (anyOpen) {
        right = `calc(1rem + ${dockSpan}px + 0.75rem)`;
      } else {
        const base = cookieBar ? 9 : 1.5;
        bottom = `${base + 2.75}rem`;
      }
    }

    return { bottom, right };
  }, [cookieBar, desktop, dockedChats]);

  const scrollTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const motion = reduceMotion
    ? ""
    : "transition-[opacity,transform] duration-300 ease-out";

  return (
    <button
      type="button"
      aria-label={en ? "Back to top" : "Επιστροφή στην κορυφή"}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      onClick={scrollTop}
      style={{ bottom: position.bottom, right: position.right }}
      className={[
        "fixed z-[80] hidden h-12 w-12 cursor-pointer items-center justify-center rounded-full",
        "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)]",
        "hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        "lg:flex",
        motion,
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      ].join(" ")}
    >
      <ChevronUp className="h-6 w-6" strokeWidth={2.5} aria-hidden />
    </button>
  );
}