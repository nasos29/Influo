"use client";

import { useMemo, useState } from "react";
import { FaFacebookF, FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa";
import { ChevronRight } from "lucide-react";
import ResponsiveDialog, { DialogClose } from "@/components/ResponsiveDialog";
import { sessionFetch } from "@/lib/sessionFetch";
import { formatEuroAmount, parseEuroNumber } from "@/lib/formatEuro";
import { listedPriceMin } from "@/lib/parsePrice";
import { averageRateNote, negotiateLead } from "@/lib/creatorAddress";
import { offerPriceLabel } from "@/lib/offerPriceLabel";
import {
  EXTRA_HINT,
  EXTRA_LABEL,
  extraPriceSuffix,
  packageBlurb,
  packagePriceSuffix,
  packageTitle,
  type PackagePlatform,
  type PackageType,
  type PublicExtraView,
  type PublicPackageView,
  type RateCardExtraKey,
} from "@/lib/servicePackages";

const COPY = {
  el: {
    more: "Δες περισσότερα",
    less: "Λιγότερα",
    negotiate: "Διαπραγμάτευση πακέτου",
    negotiateHint: "Πρότεινε δικό σου πακέτο και τιμή",
    continue: "Συνέχεια",
    empty: "Δεν υπάρχουν δημοσιευμένα πακέτα ακόμα.",
    type: "Τύπος περιεχομένου",
    qty: "Ποσότητα",
    price: "Προσφερόμενη τιμή (€)",
    note: "Σημείωση (προαιρετικό)",
    notePlaceholder: "Περιγράψτε την ιδέα σας...",
    send: "Αποστολή προσφοράς",
    sending: "Αποστολή...",
    sent: "Η προσφορά στάλθηκε.",
    sentBody: "Ο creator την βλέπει στις προτάσεις και μπορεί να απαντήσει ή να στείλει αντιπρόταση.",
    close: "Κλείσιμο",
    how: "Πώς λειτουργεί",
    step1: "Στέλνεις προσφορά",
    step1b: "Περιεχόμενο, ποσότητα και τιμή που σε ενδιαφέρουν.",
    step2: "Ο creator απαντά",
    step2b: "Αποδέχεται ή σου στέλνει αντιπρόταση μέσα από το Influo.",
    step3: "Ξεκινά η συνεργασία",
    step3b: "Συνεννοείστε στα μηνύματα και πληρώνεις το περιεχόμενό σου.",
    fee: "Το Influo δεν παίρνει προμήθεια · Η πληρωμή γίνεται απευθείας μεταξύ brand και creator",
    priceInvalid: "Συμπλήρωσε ποσότητα και προσφερόμενη τιμή.",
    sendError: "Η προσφορά δεν στάλθηκε. Δοκίμασε ξανά.",
  },
  en: {
    more: "See more",
    less: "Less",
    negotiate: "Negotiate a package",
    negotiateHint: "Propose your own package and price",
    continue: "Continue",
    empty: "No published packages yet.",
    type: "Content type",
    qty: "Quantity",
    price: "Offered price (€)",
    note: "Note (optional)",
    notePlaceholder: "Describe your idea...",
    send: "Send offer",
    sending: "Sending...",
    sent: "Offer sent.",
    sentBody: "The creator sees it in proposals and can accept or counter.",
    close: "Close",
    how: "How it works",
    step1: "You send an offer",
    step1b: "The content, quantity, and price you have in mind.",
    step2: "The creator replies",
    step2b: "They accept or send a counter offer inside Influo.",
    step3: "The collaboration starts",
    step3b: "You sort the details in messages and pay for the content.",
    fee: "Influo takes no commission · Payment happens directly between brand and creator",
    priceInvalid: "Add a quantity and an offered price.",
    sendError: "The offer was not sent. Try again.",
  },
} as const;

type OfferRow = {
  id: string;
  title: string;
  description: string;
  priceLabel: string | null;
  /** Exact package price. Present only when the viewer may see prices. */
  budget?: string;
  quantity?: number;
  platform?: PackagePlatform;
  type?: PackageType;
  extraKey?: RateCardExtraKey;
};

function unitPrice(row: OfferRow): number | null {
  if (!row.budget) return null;
  const total = parseEuroNumber(row.budget);
  if (total == null || total <= 0) return null;
  if (row.type === "ugc_photo") return total;
  const qty = row.quantity && row.quantity > 0 ? row.quantity : 1;
  return total / qty;
}

function PlatformMark({ platform }: { platform?: PackagePlatform }) {
  const box = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white";
  if (platform === "instagram") {
    return (
      <span className={`${box} bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400`}>
        <FaInstagram aria-hidden className="h-5 w-5" />
      </span>
    );
  }
  if (platform === "tiktok") {
    return (
      <span className={`${box} bg-black`}>
        <FaTiktok aria-hidden className="h-4 w-4" />
      </span>
    );
  }
  if (platform === "youtube") {
    return (
      <span className={`${box} bg-red-600`}>
        <FaYoutube aria-hidden className="h-5 w-5" />
      </span>
    );
  }
  if (platform === "facebook") {
    return (
      <span className={`${box} bg-blue-600`}>
        <FaFacebookF aria-hidden className="h-4 w-4" />
      </span>
    );
  }
  if (platform === "ugc") {
    return <span className={`${box} bg-blue-600 text-[10px] font-bold tracking-wide`}>UGC</span>;
  }
  return <span className={`${box} bg-slate-200 text-lg text-slate-600`}>+</span>;
}

function RadioMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
        selected ? "border-blue-600" : "border-slate-300"
      }`}
      aria-hidden
    >
      {selected ? <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> : null}
    </span>
  );
}

function HowItWorks({ lang }: { lang: "el" | "en" }) {
  const copy = COPY[lang];
  const steps = [
    { n: "1", title: copy.step1, body: copy.step1b },
    { n: "2", title: copy.step2, body: copy.step2b },
    { n: "3", title: copy.step3, body: copy.step3b },
  ];
  return (
    <div className="h-full w-full flex-1 bg-gradient-to-br from-blue-600 to-purple-600 p-6 text-white sm:p-8">
      <h3 className="pr-10 text-lg font-bold">{copy.how}</h3>
      <ol className="mt-5 space-y-4">
        {steps.map((step) => (
          <li key={step.n} className="flex gap-3">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
              {step.n}
            </span>
            <span>
              <span className="block text-sm font-semibold">{step.title}</span>
              <span className="mt-0.5 block text-sm leading-snug text-white/85">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-6 border-t border-white/25 pt-4 text-xs leading-relaxed text-white/95">
        <span aria-hidden>💛 </span>
        {copy.fee}
      </p>
    </div>
  );
}

export function NegotiateDialog({
  open,
  onClose,
  lang,
  creatorName,
  gender,
  options,
  influencerId,
}: {
  open: boolean;
  onClose: () => void;
  lang: "el" | "en";
  creatorName: string;
  gender?: string | null;
  options: OfferRow[];
  influencerId: string;
}) {
  const copy = COPY[lang];
  const [optionId, setOptionId] = useState(options[0]?.id || "");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const active = options.find((row) => row.id === optionId) || options[0];

  const rateNote = useMemo(() => {
    if (!active) return null;
    const matches = options.filter((row) =>
      active.extraKey
        ? row.extraKey === active.extraKey
        : row.platform === active.platform && row.type === active.type
    );
    const units = matches.map(unitPrice).filter((value): value is number => value != null && value > 0);
    if (!units.length) return null;
    const average = units.reduce((sum, value) => sum + value, 0) / units.length;
    const amount = formatEuroAmount(average, lang);
    if (!amount) return null;
    const unit =
      active.type && active.platform
        ? packageTitle(active.platform, active.type, 1, lang)
        : active.title;
    return averageRateNote(creatorName, gender, amount, unit, lang);
  }, [active, options, creatorName, gender, lang]);

  return (
    <ResponsiveDialog open={open} onClose={onClose} labelledBy="negotiate-title" wide>
      <div className="sm:grid sm:grid-cols-2 sm:items-stretch">
        <div className="relative px-5 pb-6 pt-6 sm:px-7 sm:pb-7 sm:pt-7">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-2xl text-slate-400 hover:bg-slate-100 sm:hidden"
          >
            ×
          </button>
          <h2 id="negotiate-title" className="pr-10 text-xl font-bold text-slate-900">
            {copy.negotiate}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{negotiateLead(creatorName, gender, lang)}</p>
          {sent ? (
            <div className="mt-6">
              <p className="text-lg font-bold text-slate-900">{copy.sent}</p>
              <p className="mt-2 text-sm text-slate-500">{copy.sentBody}</p>
              <button type="button" onClick={onClose} className="mt-4 text-sm font-semibold text-blue-600">
                {copy.close}
              </button>
            </div>
          ) : (
            <form
              className="mt-5 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const qty = Math.round(Number(quantity));
                const amount = parseEuroNumber(price);
                if (!active || !Number.isFinite(qty) || qty < 1 || amount == null || amount <= 0) {
                  setError(copy.priceInvalid);
                  return;
                }
                setSending(true);
                setError("");
                try {
                  const response = await sessionFetch("/api/proposals", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      influencerId,
                      serviceType: `${qty} × ${active.title}`.slice(0, 120),
                      budget: String(amount),
                      message: note.trim(),
                    }),
                  });
                  const body = await response.json().catch(() => ({}));
                  if (!response.ok || !body.success) {
                    throw new Error(typeof body.error === "string" ? body.error : copy.sendError);
                  }
                  setSent(true);
                } catch (err) {
                  setError(err instanceof Error ? err.message : copy.sendError);
                } finally {
                  setSending(false);
                }
              }}
            >
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{copy.type}</span>
                <select
                  value={active?.id || ""}
                  onChange={(event) => setOptionId(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                >
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{copy.qty}</span>
                <input
                  inputMode="numeric"
                  min={1}
                  max={99}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{copy.price}</span>
                <span className="relative mt-1.5 block">
                  <input
                    inputMode="decimal"
                    value={price}
                    onChange={(event) => setPrice(event.target.value.replace(/[^\d.,]/g, "").slice(0, 12))}
                    className="w-full rounded-xl border border-slate-200 py-3 pl-3 pr-10 text-sm text-slate-900 outline-none focus:border-blue-500"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    €
                  </span>
                </span>
              </label>
              {rateNote ? (
                <p className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-sm leading-snug text-blue-800">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                    i
                  </span>
                  <span>{rateNote}</span>
                </p>
              ) : null}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{copy.note}</span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={copy.notePlaceholder}
                  className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500"
                />
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={sending || !active}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-sm font-semibold text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-60"
              >
                {sending ? copy.sending : copy.send}
              </button>
            </form>
          )}
        </div>
        <div className="relative mx-4 mb-5 overflow-hidden rounded-2xl sm:mx-0 sm:mb-0 sm:flex sm:h-full sm:flex-col sm:rounded-none">
          <div className="hidden sm:block">
            <DialogClose onClose={onClose} light />
          </div>
          <HowItWorks lang={lang} />
        </div>
      </div>
    </ResponsiveDialog>
  );
}

function rowPrice(
  price: string | undefined,
  fromPrice: number | null | undefined,
  priceMax: number | null | undefined,
  suffix: string | null,
  lang: "el" | "en"
): { label: string | null; budget?: string } {
  const label = offerPriceLabel({ price, fromPrice, priceMax, suffix, lang });
  if (price && formatEuroAmount(price, lang)) return { label, budget: price };
  const floor = price ? listedPriceMin(price) : fromPrice != null && fromPrice > 0 ? fromPrice : null;
  if (floor != null && label) return { label, budget: String(floor) };
  return { label };
}

export default function ProfileOffersPanel({
  packages,
  extras,
  lang,
  creatorName,
  gender,
  isBrand,
  influencerId,
  onContinue,
  onNeedBrand,
  initialSelectedId = null,
}: {
  packages: PublicPackageView[];
  extras: PublicExtraView[];
  lang: "el" | "en";
  creatorName: string;
  gender?: string | null;
  isBrand: boolean;
  influencerId: string;
  onContinue: (choice: { label: string; budget?: string }) => void;
  onNeedBrand: () => void;
  initialSelectedId?: string | null;
}) {
  const copy = COPY[lang];
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [negotiateOpen, setNegotiateOpen] = useState(false);

  const rows = useMemo<OfferRow[]>(() => {
    const fromPackages = packages.map((pkg) => {
      const title =
        pkg.platform && pkg.type
          ? packageTitle(pkg.platform, pkg.type, pkg.quantity || 1, lang)
          : pkg.title;
      const priced = rowPrice(
        pkg.price,
        pkg.from_price,
        pkg.price_max,
        pkg.type ? packagePriceSuffix(pkg.type, lang) : null,
        lang
      );
      return {
        id: pkg.id,
        title,
        description:
          pkg.description ||
          (pkg.platform && pkg.type ? packageBlurb(pkg.platform, pkg.type, lang) : ""),
        priceLabel: priced.label,
        budget: priced.budget,
        quantity: pkg.quantity || 1,
        platform: pkg.platform,
        type: pkg.type,
      };
    });
    const fromExtras = extras
      .filter((extra) => extra.has_price)
      .map((extra) => {
        const priced = rowPrice(
          extra.price,
          extra.from_price,
          extra.price_max,
          extraPriceSuffix(extra.key, lang),
          lang
        );
        return {
          id: `extra:${extra.key}`,
          title: EXTRA_LABEL[extra.key][lang],
          description: EXTRA_HINT[extra.key][lang],
          priceLabel: priced.label,
          budget: priced.budget,
          extraKey: extra.key,
        };
      });
    return [...fromPackages, ...fromExtras];
  }, [packages, extras, lang]);

  const negotiateOptions = rows.length
    ? rows
    : [
        {
          id: "custom",
          title: lang === "el" ? "Προσαρμοσμένο πακέτο" : "Custom package",
          description: "",
          priceLabel: null,
        },
      ];
  const selected = rows.find((row) => row.id === selectedId) || null;

  const openNegotiate = () => {
    if (!isBrand) {
      onNeedBrand();
      return;
    }
    setNegotiateOpen(true);
  };

  const gridClass =
    rows.length <= 1
      ? "grid grid-cols-1 gap-3"
      : rows.length === 2
        ? "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2"
        : "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3";

  return (
    <div>
      {!rows.length ? <p className="mb-4 text-sm text-slate-500">{copy.empty}</p> : null}
      <div className={gridClass} role="radiogroup" aria-label={lang === "el" ? "Πακέτα" : "Packages"}>
        {rows.map((row) => {
          const selectedRow = row.id === selectedId;
          return (
            <div
              key={row.id}
              role="radio"
              aria-checked={selectedRow}
              tabIndex={0}
              onClick={() => setSelectedId(row.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedId(row.id);
                }
              }}
              className={`flex h-full cursor-pointer flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors ${
                selectedRow
                  ? "border-blue-500 ring-2 ring-blue-500"
                  : "border-slate-200 hover:border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <PlatformMark platform={row.platform} />
                <RadioMark selected={selectedRow} />
              </div>
              <p className="mt-3 text-base font-semibold text-slate-900">{row.title}</p>
              {row.description ? (
                <p className="mt-1 line-clamp-3 text-sm leading-snug text-slate-500">{row.description}</p>
              ) : null}
              {row.priceLabel ? (
                <p className="mt-auto pt-4 text-lg font-bold tabular-nums text-slate-900">{row.priceLabel}</p>
              ) : (
                <span className="mt-auto" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={openNegotiate}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-slate-800 sm:px-4"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-500">
            +
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900 sm:text-base">{copy.negotiate}</span>
            <span className="mt-0.5 block text-sm text-slate-500">{copy.negotiateHint}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        </button>
      </div>

      {selected ? (
        <button
          type="button"
          onClick={() => onContinue({ label: selected.title, budget: selected.budget })}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 text-sm font-semibold text-white hover:from-blue-700 hover:to-purple-700"
        >
          {selected.priceLabel ? `${copy.continue} – ${selected.priceLabel}` : copy.continue}
        </button>
      ) : null}

      {negotiateOpen ? (
        <NegotiateDialog
          open
          onClose={() => setNegotiateOpen(false)}
          lang={lang}
          creatorName={creatorName}
          gender={gender}
          options={negotiateOptions}
          influencerId={influencerId}
        />
      ) : null}
    </div>
  );
}
