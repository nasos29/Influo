"use client";

import { useEffect, useState } from "react";
import { sessionFetch } from "@/lib/sessionFetch";
import { canConfirmReceipt, canEditShippingAddress, canMarkShipped, type ShippingRow } from "@/lib/shippingState";

type Lang = "el" | "en";

const COPY = {
  el: {
    title: "Αποστολή προϊόντος",
    name: "Ονοματεπώνυμο",
    phone: "Τηλέφωνο",
    street: "Διεύθυνση",
    city: "Πόλη",
    postal: "Τ.Κ.",
    country: "Χώρα",
    notes: "Σημείωση",
    submit: "Υποβολή διεύθυνσης",
    courier: "Courier",
    tracking: "Αριθμός tracking",
    trackingUrl: "Tracking URL (προαιρ.)",
    markShipped: "Σήμανση ως αποσταλμένο",
    confirm: "Επιβεβαίωση παραλαβής",
  },
  en: {
    title: "Product shipping",
    name: "Full name",
    phone: "Phone",
    street: "Street address",
    city: "City",
    postal: "Postal code",
    country: "Country",
    notes: "Notes",
    submit: "Submit address",
    courier: "Courier",
    tracking: "Tracking number",
    trackingUrl: "Tracking URL (optional)",
    markShipped: "Mark as shipped",
    confirm: "Confirm receipt",
  },
} as const;

export default function CollabShippingPanel({
  applicationId,
  lang,
  party,
}: {
  applicationId: string;
  lang: Lang;
  party: "influencer" | "brand";
}) {
  const txt = COPY[lang];
  const [shipping, setShipping] = useState<ShippingRow | null>(null);
  const [form, setForm] = useState({
    recipientName: "",
    phone: "",
    street: "",
    city: "",
    postalCode: "",
    country: "GR",
    notes: "",
    courier: "",
    trackingNumber: "",
    trackingUrl: "",
  });
  const [err, setErr] = useState<string | null>(null);

  const reload = () => {
    void sessionFetch(`/api/collaborations/shipping?applicationId=${encodeURIComponent(applicationId)}`)
      .then((r) => r.json())
      .then((d: { shipping?: ShippingRow | null }) => {
        setShipping(d.shipping || null);
        if (d.shipping) {
          setForm((f) => ({
            ...f,
            recipientName: d.shipping?.recipient_name || f.recipientName,
            phone: d.shipping?.phone || f.phone,
            street: d.shipping?.street || f.street,
            city: d.shipping?.city || f.city,
            postalCode: d.shipping?.postal_code || f.postalCode,
            country: d.shipping?.country || "GR",
            notes: d.shipping?.notes || f.notes,
            courier: d.shipping?.courier || f.courier,
            trackingNumber: d.shipping?.tracking_number || f.trackingNumber,
            trackingUrl: d.shipping?.tracking_url || f.trackingUrl,
          }));
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    reload();
  }, [applicationId]);

  const post = async (action: string, extra?: Record<string, unknown>) => {
    setErr(null);
    const res = await sessionFetch("/api/collaborations/shipping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, action, ...extra }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(body.error || "error");
      return;
    }
    reload();
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2 text-sm">
      <p className="font-semibold text-amber-950">{txt.title}</p>
      {party === "influencer" && canEditShippingAddress(shipping) ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["recipientName", txt.name],
              ["phone", txt.phone],
              ["street", txt.street],
              ["city", txt.city],
              ["postalCode", txt.postal],
              ["country", txt.country],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-xs">
              <span className="text-slate-600">{label}</span>
              <input
                className="mt-0.5 w-full rounded border border-amber-200 px-2 py-1"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="block text-xs sm:col-span-2">
            <span className="text-slate-600">{txt.notes}</span>
            <input
              className="mt-0.5 w-full rounded border border-amber-200 px-2 py-1"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              void post("submit_address", {
                recipientName: form.recipientName,
                phone: form.phone,
                street: form.street,
                city: form.city,
                postalCode: form.postalCode,
                country: form.country,
                notes: form.notes,
              })
            }
            className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-semibold text-white sm:col-span-2"
          >
            {txt.submit}
          </button>
        </div>
      ) : null}

      {party === "brand" && shipping?.status === "address_submitted" && canMarkShipped(shipping) ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-700 whitespace-pre-wrap">
            {[shipping.recipient_name, shipping.street, shipping.postal_code, shipping.city, shipping.country]
              .filter(Boolean)
              .join(", ")}
          </p>
          <input
            placeholder={txt.courier}
            value={form.courier}
            onChange={(e) => setForm({ ...form, courier: e.target.value })}
            className="w-full rounded border border-amber-200 px-2 py-1 text-xs"
          />
          <input
            placeholder={txt.tracking}
            value={form.trackingNumber}
            onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })}
            className="w-full rounded border border-amber-200 px-2 py-1 text-xs"
          />
          <input
            placeholder={txt.trackingUrl}
            value={form.trackingUrl}
            onChange={(e) => setForm({ ...form, trackingUrl: e.target.value })}
            className="w-full rounded border border-amber-200 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() =>
              void post("mark_shipped", {
                courier: form.courier,
                trackingNumber: form.trackingNumber,
                trackingUrl: form.trackingUrl,
              })
            }
            className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-semibold text-white"
          >
            {txt.markShipped}
          </button>
        </div>
      ) : null}

      {party === "influencer" && canConfirmReceipt(shipping) ? (
        <button
          type="button"
          onClick={() => void post("confirm_receipt")}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"
        >
          {txt.confirm}
        </button>
      ) : null}

      {shipping?.status === "shipped" && party === "influencer" ? (
        <p className="text-xs text-slate-700">
          {shipping.courier} · {shipping.tracking_number}
          {shipping.tracking_url ? (
            <>
              {" "}
              <a href={shipping.tracking_url} className="underline" target="_blank" rel="noreferrer">
                tracking
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      {err ? <p className="text-xs text-red-700">{err}</p> : null}
    </div>
  );
}