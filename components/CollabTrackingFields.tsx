"use client";

import { useEffect, useState } from "react";
import { sessionFetch } from "@/lib/sessionFetch";
import { buildInfluoUtmUrl } from "@/lib/utmBuilder";

type Lang = "el" | "en";
type Source = "proposal" | "campaign";

const COPY = {
  el: {
    title: "Κωδικοί & UTM",
    promo: "Promo code",
    utm: "UTM link",
    spark: "Spark / Partnership code",
    save: "Αποθήκευση",
    saved: "Αποθηκεύτηκε.",
    buildUtm: "Δημιουργία UTM",
    baseUrl: "Βάση URL",
    campaign: "utm_campaign",
    creator: "utm_content",
  },
  en: {
    title: "Codes & UTM",
    promo: "Promo code",
    utm: "UTM link",
    spark: "Spark / Partnership code",
    save: "Save",
    saved: "Saved.",
    buildUtm: "Build UTM",
    baseUrl: "Base URL",
    campaign: "utm_campaign",
    creator: "utm_content",
  },
} as const;

export default function CollabTrackingFields({
  source,
  id,
  lang,
  isBrand,
  brandName,
  creatorSlug,
}: {
  source: Source;
  id: string;
  lang: Lang;
  isBrand: boolean;
  brandName?: string;
  creatorSlug?: string;
}) {
  const txt = COPY[lang];
  const [promo, setPromo] = useState("");
  const [utm, setUtm] = useState("");
  const [spark, setSpark] = useState("");
  const [utmBase, setUtmBase] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmCreator, setUtmCreator] = useState(creatorSlug || "");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void sessionFetch(`/api/collaborations/tracking?source=${source}&id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data: { fields?: Record<string, string | null> }) => {
        setPromo(String(data.fields?.collab_promo_code || ""));
        setUtm(String(data.fields?.collab_utm_link || ""));
        setSpark(String(data.fields?.collab_spark_ads_code || ""));
      })
      .catch(() => undefined);
  }, [source, id]);

  const save = async (patch: Record<string, unknown>) => {
    setErr(null);
    setOk(false);
    const res = await sessionFetch("/api/collaborations/tracking", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, id, ...patch }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(body.error || "error");
      return;
    }
    setOk(true);
  };

  const buildUtm = () => {
    const built = buildInfluoUtmUrl({
      baseUrl: utmBase,
      campaign: utmCampaign,
      creator: utmCreator,
      brandName,
    });
    if (built) setUtm(built);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 text-sm">
      <p className="font-semibold text-slate-900">{txt.title}</p>
      <label className="block">
        <span className="text-xs text-slate-500">{txt.promo}</span>
        <input
          value={promo}
          onChange={(e) => setPromo(e.target.value)}
          readOnly={!isBrand}
          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">{txt.utm}</span>
        <input
          value={utm}
          onChange={(e) => setUtm(e.target.value)}
          readOnly={!isBrand}
          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm"
        />
      </label>
      {isBrand ? (
        <MotionlessUtmBuilder
          txt={txt}
          utmBase={utmBase}
          setUtmBase={setUtmBase}
          utmCampaign={utmCampaign}
          setUtmCampaign={setUtmCampaign}
          utmCreator={utmCreator}
          setUtmCreator={setUtmCreator}
          onBuild={buildUtm}
        />
      ) : null}
      <label className="block">
        <span className="text-xs text-slate-500">{txt.spark}</span>
        <input
          value={spark}
          onChange={(e) => setSpark(e.target.value)}
          readOnly={isBrand}
          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm"
        />
      </label>
      <button
        type="button"
        onClick={() =>
          void save({
            ...(isBrand ? { promoCode: promo, utmLink: utm } : {}),
            ...(!isBrand ? { sparkAdsCode: spark } : { sparkAdsCode: spark }),
          })
        }
        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
      >
        {txt.save}
      </button>
      {ok ? <p className="text-xs text-emerald-700">{txt.saved}</p> : null}
      {err ? <p className="text-xs text-red-700">{err}</p> : null}
    </div>
  );
}

function MotionlessUtmBuilder({
  txt,
  utmBase,
  setUtmBase,
  utmCampaign,
  setUtmCampaign,
  utmCreator,
  setUtmCreator,
  onBuild,
}: {
  txt: (typeof COPY)[Lang];
  utmBase: string;
  setUtmBase: (v: string) => void;
  utmCampaign: string;
  setUtmCampaign: (v: string) => void;
  utmCreator: string;
  setUtmCreator: (v: string) => void;
  onBuild: () => void;
}) {
  return (
    <div className="rounded border border-dashed border-slate-200 p-2 space-y-1">
      <p className="text-[10px] font-medium text-slate-600">{txt.buildUtm}</p>
      <input
        value={utmBase}
        onChange={(e) => setUtmBase(e.target.value)}
        placeholder={txt.baseUrl}
        className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
      />
      <div className="flex gap-1">
        <input
          value={utmCampaign}
          onChange={(e) => setUtmCampaign(e.target.value)}
          placeholder={txt.campaign}
          className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
        />
        <input
          value={utmCreator}
          onChange={(e) => setUtmCreator(e.target.value)}
          placeholder={txt.creator}
          className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
        />
      </div>
      <button type="button" onClick={onBuild} className="text-xs font-semibold text-blue-700 underline">
        {txt.buildUtm}
      </button>
    </div>
  );
}