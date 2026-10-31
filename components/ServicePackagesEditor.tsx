"use client";

import {
  PACKAGE_PLATFORMS,
  PACKAGE_TYPES,
  USAGE_RIGHTS,
  USAGE_RIGHTS_LABEL,
  defaultPackages,
  newPackageId,
  isPositivePriceInput,
  normalizeServicePackages,
  packageTitle,
  type PackagePlatform,
  type PackageType,
  type ServicePackage,
  type UsageRights,
} from "@/lib/servicePackages";

type Lang = "el" | "en";

const PLATFORM_CHIP: Record<PackagePlatform, { el: string; en: string }> = {
  instagram: { el: "Instagram", en: "Instagram" },
  tiktok: { el: "TikTok", en: "TikTok" },
  youtube: { el: "YouTube", en: "YouTube" },
  facebook: { el: "Facebook", en: "Facebook" },
};

const TYPE_CHIP: Record<PackageType, { el: string; en: string }> = {
  reel: { el: "Reel", en: "Reel" },
  story: { el: "Story", en: "Story" },
  post: { el: "Post", en: "Post" },
  video: { el: "Video", en: "Video" },
  short: { el: "Short", en: "Short" },
};

function emptyPackage(): ServicePackage {
  return {
    id: newPackageId(),
    platform: "instagram",
    type: "reel",
    quantity: 1,
    price: "",
    delivery_days: 7,
    usage_rights: "none",
    description: "",
  };
}

export function initialPackagesFromUser(
  servicePackages: unknown,
  rateCard?: { story?: string; post?: string; reel?: string; youtube?: string; facebook?: string } | null
): ServicePackage[] {
  const fromDb = normalizeServicePackages(servicePackages);
  if (fromDb.length) return fromDb;
  // Seed editor from rate_card so existing creators see their prices, without writing until save.
  if (rateCard) {
    const seeded: ServicePackage[] = [];
    if (rateCard.reel) {
      seeded.push({
        id: newPackageId(),
        platform: "instagram",
        type: "reel",
        quantity: 1,
        price: String(rateCard.reel),
        delivery_days: 7,
        usage_rights: "none",
        description: "",
      });
    }
    if (rateCard.story) {
      seeded.push({
        id: newPackageId(),
        platform: "instagram",
        type: "story",
        quantity: 1,
        price: String(rateCard.story),
        delivery_days: 3,
        usage_rights: "none",
        description: "",
      });
    }
    if (rateCard.post) {
      seeded.push({
        id: newPackageId(),
        platform: "instagram",
        type: "post",
        quantity: 1,
        price: String(rateCard.post),
        delivery_days: 5,
        usage_rights: "none",
        description: "",
      });
    }
    if (rateCard.youtube) {
      seeded.push({
        id: newPackageId(),
        platform: "youtube",
        type: "video",
        quantity: 1,
        price: String(rateCard.youtube),
        delivery_days: 14,
        usage_rights: "none",
        description: "",
      });
    }
    if (seeded.length) return seeded.slice(0, 6);
  }
  return defaultPackages();
}

type Props = {
  lang: Lang;
  packages: ServicePackage[];
  onChange: (next: ServicePackage[]) => void;
  className?: string;
};

export default function ServicePackagesEditor({ lang, packages, onChange, className }: Props) {
  const L = (el: string, en: string) => (lang === "en" ? en : el);
  const list = packages.length ? packages : defaultPackages();

  const update = (id: string, patch: Partial<ServicePackage>) => {
    onChange(list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const remove = (id: string) => {
    if (list.length <= 1) return;
    onChange(list.filter((p) => p.id !== id));
  };

  const add = () => {
    if (list.length >= 6) return;
    onChange([...list, emptyPackage()]);
  };

  const chipBtn = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
      active
        ? "bg-slate-900 text-white"
        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            {L("Πακέτα", "Packages")}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {L(
              "1–6 πακέτα. Ο τίτλος φτιάχνεται αυτόματα (π.χ. 1 Instagram Reel).",
              "1–6 packages. Titles are generated (e.g. 1 Instagram Reel)."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={list.length >= 6}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + {L("Προσθήκη", "Add")}
        </button>
      </div>

      <div className="space-y-3">
        {list.map((pkg) => (
          <div
            key={pkg.id}
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-slate-900">
                {packageTitle(pkg.platform, pkg.type, pkg.quantity, lang)}
              </p>
              <button
                type="button"
                onClick={() => remove(pkg.id)}
                disabled={list.length <= 1}
                className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {L("Αφαίρεση", "Remove")}
              </button>
            </div>

            <div className="mb-2">
              <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">
                {L("Πλατφόρμα", "Platform")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PACKAGE_PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={chipBtn(pkg.platform === p)}
                    onClick={() => update(pkg.id, { platform: p })}
                  >
                    {PLATFORM_CHIP[p][lang]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-2">
              <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">
                {L("Τύπος", "Type")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PACKAGE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={chipBtn(pkg.type === t)}
                    onClick={() => update(pkg.id, { type: t })}
                  >
                    {TYPE_CHIP[t][lang]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
                  {L("Ποσότητα", "Qty")}
                </label>
                <select
                  value={pkg.quantity}
                  onChange={(e) => update(pkg.id, { quantity: parseInt(e.target.value, 10) || 1 })}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
                  {L("Τιμή (€)", "Price (€)")}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={pkg.price}
                  onChange={(e) => update(pkg.id, { price: e.target.value.replace(/,/g, ".") })}
                  placeholder="150"
                  className={`w-full rounded-lg border px-2 py-1.5 text-sm text-slate-900 ${
                    pkg.price.trim() && !isPositivePriceInput(pkg.price)
                      ? "border-red-400"
                      : "border-slate-300"
                  }`}
                />
                {pkg.price.trim() && !isPositivePriceInput(pkg.price) ? (
                  <p className="mt-1 text-[10px] text-red-600">
                    {L("Πάνω από 0, ή κενό.", "Greater than 0, or empty.")}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
                  {L("Ημέρες", "Days")}
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={pkg.delivery_days ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    update(pkg.id, {
                      delivery_days: v === "" ? null : Math.min(365, Math.max(0, parseInt(v, 10) || 0)),
                    });
                  }}
                  placeholder="7"
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
                  {L("Δικαιώματα", "Usage")}
                </label>
                <select
                  value={pkg.usage_rights || "none"}
                  onChange={(e) => update(pkg.id, { usage_rights: e.target.value as UsageRights })}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                >
                  {USAGE_RIGHTS.map((u) => (
                    <option key={u} value={u}>
                      {USAGE_RIGHTS_LABEL[u][lang]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
                {L("Περιγραφή", "Description")}
              </label>
              <textarea
                value={pkg.description || ""}
                onChange={(e) => update(pkg.id, { description: e.target.value })}
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                placeholder={L("Προαιρετικά…", "Optional…")}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
