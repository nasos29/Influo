"use client";

import Link from "next/link";
import ResponsiveDialog, { DialogClose } from "@/components/ResponsiveDialog";

const COPY = {
  el: {
    eyebrow: "Για brands",
    title: "Συνδέσου για να προσκαλέσεις creators",
    body: "Οι creators έρχονται σε σένα. Εσύ διαλέγεις με ποιους θα συνεργαστείς.",
    login: "Σύνδεση ως brand",
    signup: "Εγγραφή brand – δωρεάν",
    creator: "Είσαι creator;",
    creatorLink: "Σύνδεση creator",
  },
  en: {
    eyebrow: "For brands",
    title: "Sign in to invite creators",
    body: "Creators come to you. You choose who you work with.",
    login: "Log in as a brand",
    signup: "Brand signup – free",
    creator: "Are you a creator?",
    creatorLink: "Creator login",
  },
} as const;

const TILES = [
  "from-indigo-100 to-violet-100",
  "from-blue-100 to-indigo-100",
  "from-violet-100 to-fuchsia-100",
  "from-sky-100 to-blue-100",
  "from-purple-100 to-indigo-50",
  "from-blue-50 to-violet-100",
  "from-indigo-50 to-sky-100",
  "from-fuchsia-100 to-purple-100",
];

export default function BrandGateModal({
  open,
  onClose,
  lang,
  returnPath,
}: {
  open: boolean;
  onClose: () => void;
  lang: "el" | "en";
  returnPath: string;
}) {
  const copy = COPY[lang];
  const back = encodeURIComponent(returnPath || "/");
  return (
    <ResponsiveDialog open={open} onClose={onClose} labelledBy="brand-gate-title">
      <DialogClose onClose={onClose} />
      <div className="px-5 pb-6 pt-6 sm:px-6 sm:pb-7 sm:pt-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-purple-600">{copy.eyebrow}</p>
        <h2 id="brand-gate-title" className="mt-2 pr-8 text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
          {copy.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{copy.body}</p>
        <div className="mt-5 grid grid-cols-4 gap-2.5" aria-hidden>
          {TILES.map((tone) => (
            <div key={tone} className={`aspect-square rounded-2xl bg-gradient-to-br ${tone}`} />
          ))}
        </div>
        <Link
          href={`/login?redirect=${back}`}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-purple-700"
        >
          {copy.login}
        </Link>
        <Link
          href={`/brand/signup?redirect=${back}`}
          className="mt-2.5 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-blue-500 bg-white px-4 text-sm font-semibold text-blue-600 hover:bg-blue-50"
        >
          {copy.signup}
        </Link>
        <p className="mt-4 text-center text-sm text-slate-500">
          {copy.creator}{" "}
          <Link href={`/login?redirect=${back}`} className="font-semibold text-blue-600 hover:text-blue-800">
            {copy.creatorLink}
          </Link>
        </p>
      </div>
    </ResponsiveDialog>
  );
}
