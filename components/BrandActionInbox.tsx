"use client";

type BrandTab = "recommendations" | "campaigns" | "proposals" | "messages";

type Props = {
  lang: "el" | "en";
  pendingApplications: number;
  pendingCounters: number;
  pendingAgreements: number;
  unreadMessages: number;
  onOpenTab: (tab: BrandTab) => void;
};

function fmt(n: number): string {
  return n > 99 ? "99+" : String(n);
}

export default function BrandActionInbox({
  lang,
  pendingApplications,
  pendingCounters,
  pendingAgreements,
  unreadMessages,
  onOpenTab,
}: Props) {
  const el = lang === "el";
  const items = [
    {
      tab: "campaigns" as const,
      count: pendingApplications,
      title: el ? "Αιτήσεις καμπάνιας" : "Campaign applications",
      hint: el ? "Νέοι influencers σε ανοιχτές καμπάνιες" : "New influencers on open campaigns",
    },
    {
      tab: "proposals" as const,
      count: pendingCounters,
      title: el ? "Αντιπροτάσεις" : "Counter offers",
      hint: el ? "Περιμένουν την απάντησή σας" : "Waiting for your reply",
    },
    {
      tab: "proposals" as const,
      count: pendingAgreements,
      title: el ? "Συμφωνίες" : "Agreements",
      hint: el ? "Ο influencer αποδέχτηκε — σειρά σας" : "The influencer accepted — your turn",
    },
    {
      tab: "messages" as const,
      count: unreadMessages,
      title: el ? "Μηνύματα" : "Messages",
      hint: el ? "Αδιάβαστα από influencers" : "Unread from influencers",
    },
  ];
  const total = pendingApplications + pendingCounters + pendingAgreements + unreadMessages;

  return (
    <section className="mb-6">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
            {el ? "Χρειάζεται ενέργεια" : "Needs action"}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {total > 0
              ? el
                ? "Πατήστε μια κάρτα για να ανοίξει το αντίστοιχο σημείο."
                : "Tap a card to open the matching section."
              : el
                ? "Δεν εκκρεμεί κάτι αυτή τη στιγμή."
                : "Nothing is waiting for you right now."}
          </p>
        </div>
        {total > 0 ? (
          <span className="shrink-0 text-xs font-semibold text-white bg-blue-600 rounded-full px-2.5 py-1">
            {fmt(total)}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item, i) => {
          const active = item.count > 0;
          return (
            <button
              key={`${item.tab}-${i}`}
              type="button"
              onClick={() => onOpenTab(item.tab)}
              className={`text-left rounded-xl border p-3.5 sm:p-4 transition-colors ${
                active
                  ? "bg-white border-blue-200 hover:border-blue-400 hover:bg-blue-50"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className={`text-2xl font-bold tabular-nums ${active ? "text-blue-700" : "text-slate-400"}`}>
                {fmt(item.count)}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{item.title}</div>
              <div className="mt-0.5 text-xs text-slate-500 leading-snug">{item.hint}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
