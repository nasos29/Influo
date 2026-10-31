"use client";

import { useState } from "react";
import ResponsiveDialog, { DialogClose } from "@/components/ResponsiveDialog";

const COPY = {
  el: {
    share: "Κοινοποίηση",
    title: "Κοινοποίηση προφίλ",
    body: "Αντίγραψε τον σύνδεσμο ή στείλε τον απευθείας.",
    copy: "Αντιγραφή",
    copied: "Αντιγράφηκε",
  },
  en: {
    share: "Share",
    title: "Share profile",
    body: "Copy the link or send it directly.",
    copy: "Copy",
    copied: "Copied",
  },
} as const;

const CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", mark: "W", tone: "bg-emerald-500" },
  { id: "viber", label: "Viber", mark: "V", tone: "bg-purple-600" },
  { id: "facebook", label: "Facebook", mark: "F", tone: "bg-blue-600" },
  { id: "x", label: "X", mark: "X", tone: "bg-slate-900" },
  { id: "email", label: "Email", mark: "E", tone: "bg-slate-500" },
] as const;

function channelHref(id: (typeof CHANNELS)[number]["id"], url: string, title: string): string {
  const encoded = encodeURIComponent(url);
  const text = encodeURIComponent(`${title} ${url}`);
  if (id === "whatsapp") return `https://wa.me/?text=${text}`;
  if (id === "viber") return `viber://forward?text=${text}`;
  if (id === "facebook") return `https://www.facebook.com/sharer/sharer.php?u=${encoded}`;
  if (id === "x") return `https://twitter.com/intent/tweet?url=${encoded}&text=${encodeURIComponent(title)}`;
  return `mailto:?subject=${encodeURIComponent(title)}&body=${encoded}`;
}

export default function ProfileShareButton({
  lang,
  title,
  path,
}: {
  lang: "el" | "en";
  title: string;
  path: string;
}) {
  const copy = COPY[lang];
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  const share = async () => {
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (mobile && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    setCopied(false);
    setOpen(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("textarea");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <span aria-hidden>↗</span>
        {copy.share}
      </button>
      <ResponsiveDialog open={open} onClose={() => setOpen(false)} labelledBy="profile-share-title">
        <DialogClose onClose={() => setOpen(false)} />
        <div className="px-5 pb-6 pt-6 sm:px-6 sm:pb-7 sm:pt-7">
          <h2 id="profile-share-title" className="pr-8 text-xl font-bold text-slate-900">
            {copy.title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{copy.body}</p>
          <div className="mt-4 flex gap-2">
            <input
              readOnly
              value={url}
              aria-label={copy.title}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"
            />
            <button
              type="button"
              onClick={() => void copyLink()}
              className="shrink-0 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white"
            >
              {copied ? copy.copied : copy.copy}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {CHANNELS.map((channel) => (
              <a
                key={channel.id}
                href={channelHref(channel.id, url, title)}
                target={channel.id === "email" || channel.id === "viber" ? undefined : "_blank"}
                rel={channel.id === "email" || channel.id === "viber" ? undefined : "noopener noreferrer"}
                className="flex flex-col items-center gap-1.5 text-[11px] font-medium text-slate-600"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white ${channel.tone}`}>
                  {channel.mark}
                </span>
                {channel.label}
              </a>
            ))}
          </div>
        </div>
      </ResponsiveDialog>
    </>
  );
}
