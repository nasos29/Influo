"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

interface Props {
  userType: "influencer" | "brand";
  userIdentifier: string; // influencer id or brand email
  lang?: "el" | "en";
}

export default function PushNotificationPrompt({
  userType,
  userIdentifier,
  lang = "el",
}: Props) {
  const [status, setStatus] = useState<"idle" | "prompting" | "subscribing" | "subscribed" | "unsupported" | "denied" | "error">("idle");
  const [dismissed, setDismissed] = useState(false);

  const syncSubscriptionToApi = async (sub: PushSubscription) => {
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        userType,
        userIdentifier,
        userAgent: navigator.userAgent,
      }),
    });
    return res.ok;
  };

  useEffect(() => {
    if (!VAPID_PUBLIC || !userIdentifier || typeof window === "undefined") return;

    const run = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      // Register service worker and wait until ready
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      if (Notification.permission === "granted") {
        await doSubscribe();
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      // Permission "default" - show our banner, wait for user to click Enable
      setStatus("prompting");
    };

    async function doSubscribe() {
      if (!VAPID_PUBLIC) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          // Sync existing subscription for current user (same device, different account)
          const ok = await syncSubscriptionToApi(sub);
          setStatus(ok ? "subscribed" : "prompting");
          return;
        }

        const newSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
        });

        const ok = await syncSubscriptionToApi(newSub);
        setStatus(ok ? "subscribed" : "error");
      } catch (e) {
        console.error("[Push] Subscribe error:", e);
        setStatus("error");
      }
    }

    run();
  }, [userType, userIdentifier]);

  const handleEnable = async () => {
    if (!VAPID_PUBLIC || !userIdentifier || typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setStatus("subscribing");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
        });
      }
      const ok = await syncSubscriptionToApi(sub!);
      setStatus(ok ? "subscribed" : "error");
    } catch (e) {
      console.error("[Push] Enable error:", e);
      setStatus("error");
    }
  };

  const txt = {
    el: {
      enable: "Ενεργοποίηση ειδοποιήσεων",
      subscribing: "Αναμονή...",
      desc: "Λάβετε ειδοποιήσεις στο κινητό για νέα μηνύματα και προτάσεις.",
      dismissed: "Όχι τώρα",
      granted: "Ειδοποιήσεις ενεργές",
      denied: "Οι ειδοποιήσεις απενεργοποιήθηκαν.",
      unsupported: "Τα push notifications δεν υποστηρίζονται στον browser σας.",
    },
    en: {
      enable: "Enable notifications",
      subscribing: "Subscribing...",
      desc: "Get notifications on your phone for new messages and proposals.",
      dismissed: "Not now",
      granted: "Notifications enabled",
      denied: "Notifications were denied.",
      unsupported: "Push notifications are not supported in your browser.",
    },
  };

  const t = txt[lang];

  if (status === "idle" || status === "subscribed") return null;
  if (status === "denied" || status === "unsupported" || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 bg-slate-800 text-white rounded-lg shadow-lg p-4 flex items-start gap-3">
      <span className="text-2xl">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{t.enable}</p>
        <p className="text-xs text-slate-300 mt-0.5">{t.desc}</p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleEnable}
            disabled={status === "subscribing"}
            className="text-xs font-medium px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {status === "subscribing" ? (lang === "el" ? "Αναμονή…" : "Please wait…") : t.enable}
          </button>
          <button
            onClick={() => setDismissed(true)}
            disabled={status === "subscribing"}
            className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            {t.dismissed}
          </button>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
