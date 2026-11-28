"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Check, RotateCcw, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO,
  HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO_KEY,
} from "@/lib/homepageBrandCtaDecorativePhoto";
import {
  DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS,
  HOMEPAGE_FEATURED_COLLABORATIONS_KEY,
  featuredCollaborationSlotsFromConfig,
  homepageFeaturedCollaborationsConfigFromSlots,
  type HomepageFeaturedCollaborationsConfig,
} from "@/lib/homepageFeaturedCollaborations";
import type { FeaturedCollaborationCandidate } from "@/lib/loadFeaturedCollaborationCandidates";

async function adminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type Props = {
  disabled?: boolean;
};

const SLOT_LABELS = [
  "Κύριο βίντεο (μεγάλο)",
  "Βίντεο 2",
  "Βίντεο 3",
  "Βίντεο 4",
  "Βίντεο 5",
] as const;

export default function AdminBrandCtaShowcaseEditor({ disabled = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSavedVideos, setJustSavedVideos] = useState(false);
  const [justSavedPhoto, setJustSavedPhoto] = useState(false);

  const [savedSlots, setSavedSlots] = useState<string[]>(() =>
    featuredCollaborationSlotsFromConfig(DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS)
  );
  const [slots, setSlots] = useState<string[]>(() =>
    featuredCollaborationSlotsFromConfig(DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS)
  );
  const [savedPhoto, setSavedPhoto] = useState(DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO);
  const [photoUrl, setPhotoUrl] = useState(DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO);

  const [candidates, setCandidates] = useState<FeaturedCollaborationCandidate[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const candidateById = useMemo(() => {
    const map = new Map<string, FeaturedCollaborationCandidate>();
    for (const c of candidates) map.set(c.curatedId, c);
    return map;
  }, [candidates]);

  const videosDirty = useMemo(
    () => slots.length !== savedSlots.length || slots.some((id, i) => id !== savedSlots[i]),
    [slots, savedSlots]
  );
  const photoDirty = photoUrl !== savedPhoto;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await adminAuthHeaders();
      const [settingsRes, candidatesRes] = await Promise.all([
        fetch("/api/admin/settings", { headers }),
        fetch("/api/admin/homepage-featured-collaborations/candidates?limit=150", { headers }),
      ]);
      if (!settingsRes.ok) throw new Error("Αποτυχία φόρτωσης ρυθμίσεων showcase.");
      const data = (await settingsRes.json()) as {
        homepage_featured_collaborations?: HomepageFeaturedCollaborationsConfig;
        homepage_featured_collaboration_slots?: string[];
        homepage_brand_cta_decorative_photo?: string;
      };
      const config =
        data.homepage_featured_collaborations ?? DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS;
      const nextSlots =
        data.homepage_featured_collaboration_slots ??
        featuredCollaborationSlotsFromConfig(config);
      const photo =
        data.homepage_brand_cta_decorative_photo ?? DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO;
      setSlots(nextSlots);
      setSavedSlots(nextSlots);
      setPhotoUrl(photo);
      setSavedPhoto(photo);

      if (candidatesRes.ok) {
        const candData = (await candidatesRes.json()) as { items?: FeaturedCollaborationCandidate[] };
        setCandidates(candData.items ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία φόρτωσης.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!justSavedVideos) return;
    const id = window.setTimeout(() => setJustSavedVideos(false), 1600);
    return () => window.clearTimeout(id);
  }, [justSavedVideos]);

  useEffect(() => {
    if (!justSavedPhoto) return;
    const id = window.setTimeout(() => setJustSavedPhoto(false), 1600);
    return () => window.clearTimeout(id);
  }, [justSavedPhoto]);

  function optionLabel(curatedId: string): string {
    const c = candidateById.get(curatedId);
    if (c) return c.label;
    return curatedId;
  }

  function setSlot(index: number, value: string) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function saveVideos(reset = false) {
    setBusy(true);
    setError(null);
    try {
      const body = reset
        ? { key: HOMEPAGE_FEATURED_COLLABORATIONS_KEY, reset: true }
        : { key: HOMEPAGE_FEATURED_COLLABORATIONS_KEY, value: slots };
      const config = reset ? null : homepageFeaturedCollaborationsConfigFromSlots(slots);
      if (!reset && !config) {
        throw new Error("5 μοναδικά έγκυρα βίντεο απαιτούνται.");
      }
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await adminAuthHeaders()),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Αποτυχία αποθήκευσης βίντεο.");
      const nextSlots =
        (data.homepage_featured_collaboration_slots as string[] | undefined) ??
        featuredCollaborationSlotsFromConfig(
          (data.homepage_featured_collaborations as HomepageFeaturedCollaborationsConfig) ??
            DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS
        );
      setSlots(nextSlots);
      setSavedSlots(nextSlots);
      setJustSavedVideos(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία αποθήκευσης.");
    } finally {
      setBusy(false);
    }
  }

  async function persistPhoto(url: string) {
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await adminAuthHeaders()),
      },
      body: JSON.stringify({
        key: HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO_KEY,
        value: url,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Αποτυχία αποθήκευσης εικόνας.");
    const next =
      (data.homepage_brand_cta_decorative_photo as string | undefined) ??
      DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO;
    setPhotoUrl(next);
    setSavedPhoto(next);
    setJustSavedPhoto(true);
  }

  async function resetPhoto() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await adminAuthHeaders()),
        },
        body: JSON.stringify({ key: HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO_KEY, reset: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Αποτυχία επαναφοράς.");
      const next =
        (data.homepage_brand_cta_decorative_photo as string) ??
        DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO;
      setPhotoUrl(next);
      setSavedPhoto(next);
      setJustSavedPhoto(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία επαναφοράς.");
    } finally {
      setBusy(false);
    }
  }

  async function onPhotoFileChange(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const uploadRes = await fetch("/api/admin/settings/brand-cta-decorative-photo", {
        method: "POST",
        headers: await adminAuthHeaders(),
        body: form,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploadData.error || "Αποτυχία μεταφόρτωσης.");
      const url = typeof uploadData.url === "string" ? uploadData.url : "";
      if (!url) throw new Error("Άκυρη διεύθυνση εικόνας.");
      setPhotoUrl(url);
      await persistPhoto(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Αποτυχία μεταφόρτωσης.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <p className="border-t border-slate-200 px-2 py-3 text-xs text-slate-500">Φόρτωση περιεχομένου showcase…</p>
    );
  }

  return (
    <div className="border-t border-slate-200 bg-white px-2 py-3 sm:px-3">
      <p className="mb-2 text-[11px] font-semibold text-slate-800">
        Περιεχόμενο showcase «Έχετε Επιχείρηση;»
      </p>
      {error ? (
        <p className="mb-2 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ShowcaseSubsection
          title="Διακοσμητική εικόνα"
          saved={justSavedPhoto}
          actions={
            <>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <Upload className="h-3 w-3" aria-hidden />
                Μεταφόρτωση
              </button>
              <button
                type="button"
                disabled={disabled || busy || photoUrl === DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO}
                onClick={() => void resetPhoto()}
                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                title="Επαναφορά προεπιλογής"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Επαναφορά
              </button>
            </>
          }
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/webp,image/jpeg,image/png"
            className="sr-only"
            onChange={(e) => void onPhotoFileChange(e.target.files?.[0] ?? null)}
          />
          <p className="mb-2 text-[10px] leading-snug text-slate-500">
            Προτεινόμενες διαστάσεις: 900×1200 px (αναλογία 3:4)
          </p>
          <div className="flex gap-3">
            <div className="relative h-28 w-[5.25rem] shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
              <Image
                src={photoUrl}
                alt="Προεπισκόπηση διακοσμητικής εικόνας"
                width={84}
                height={112}
                className="h-full w-full object-cover"
                unoptimized={photoUrl.startsWith("http")}
              />
            </div>
            <p className="min-w-0 flex-1 break-all text-[10px] text-slate-500">{photoUrl}</p>
          </div>
          {photoDirty && !busy ? (
            <p className="mt-1 text-[10px] text-amber-700">Μη αποθηκευμένη αλλαγή (αυτόματη αποθήκευση μετά τη μεταφόρτωση).</p>
          ) : null}
        </ShowcaseSubsection>

        <ShowcaseSubsection
          title="Βίντεο showcase (5 θέσεις)"
          saved={justSavedVideos}
          actions={
            <>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => void saveVideos(true)}
                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Επαναφορά
              </button>
              <button
                type="button"
                disabled={disabled || busy || !videosDirty}
                onClick={() => void saveVideos(false)}
                className="inline-flex h-8 cursor-pointer items-center rounded-md bg-slate-900 px-2.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {busy ? "Αποθήκευση…" : "Αποθήκευση βίντεο"}
              </button>
            </>
          }
        >
          <p className="mb-2 text-[10px] leading-snug text-slate-500">
            Προτεινόμενη αναλογία βίντεο: κατακόρυφο 9:16
          </p>
          <ul className="space-y-2">
            {slots.map((curatedId, index) => (
              <li key={index} className="flex flex-wrap items-center gap-2">
                <span className="w-36 shrink-0 text-[10px] font-medium text-slate-600">
                  {SLOT_LABELS[index]}
                </span>
                <select
                  value={curatedId}
                  disabled={disabled || busy}
                  onChange={(e) => setSlot(index, e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900 disabled:opacity-50"
                >
                  {curatedId && !candidateById.has(curatedId) ? (
                    <option value={curatedId}>{optionLabel(curatedId)}</option>
                  ) : null}
                  {candidates.map((c) => (
                    <option key={c.curatedId} value={c.curatedId}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </ShowcaseSubsection>
      </div>
    </div>
  );
}

function ShowcaseSubsection({
  title,
  saved,
  actions,
  children,
}: {
  title: string;
  saved: boolean;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/50 p-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-800">{title}</span>
        <div className="flex flex-wrap items-center gap-1">
          {saved ? (
            <span
              className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
              role="status"
            >
              <Check className="h-3 w-3" aria-hidden />
              Αποθηκεύτηκε
            </span>
          ) : null}
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
}