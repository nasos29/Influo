"use client";

import { displayServiceType } from "@/lib/campaignServiceLabel";
import { formatDate } from "@/lib/formatDateTime";
import { formatEuroAmount } from "@/lib/formatEuro";
import { formatProposalExtrasLine } from "@/lib/proposalFloor";

type Lang = "el" | "en";

/** Final fee: accepted counter-offer when there is one, otherwise the original budget. */
export function agreedProposalFee(input: {
  budget: unknown;
  counter_proposal_budget?: unknown;
  counter_proposal_status?: string | null;
}): unknown {
  if (input.counter_proposal_status === "accepted" && input.counter_proposal_budget) {
    return input.counter_proposal_budget;
  }
  return input.budget;
}

const TERMS: Record<Lang, readonly string[]> = {
  el: [
    "Αντικείμενο. Ο Δημιουργός θα δημιουργήσει και θα δημοσιεύσει τα παραδοτέα της σύνοψης, σύμφωνα με τις οδηγίες της Επιχείρησης όπως συμφωνήθηκαν στην πλατφόρμα Influo.",
    "Έγκριση περιεχομένου. Πριν από τη δημοσίευση, ο Δημιουργός στέλνει το περιεχόμενο στην Επιχείρηση για έγκριση. Περιλαμβάνεται έως ένας γύρος διορθώσεων, εκτός αν συμφωνηθεί διαφορετικά.",
    "Αμοιβή. Η Επιχείρηση καταβάλλει απευθείας στον Δημιουργό τη συνολική αμοιβή της σύνοψης, μετά τη δημοσίευση του εγκεκριμένου περιεχομένου, εκτός αν συμφωνηθεί γραπτώς διαφορετικά. Το Influo δεν μεσολαβεί στην πληρωμή και δεν ευθύνεται για αυτήν.",
    "Χρήση περιεχομένου. Τα πνευματικά δικαιώματα ανήκουν στον Δημιουργό. Η Επιχείρηση μπορεί να κοινοποιεί (repost) το περιεχόμενο στα δικά της κανάλια με αναφορά στον Δημιουργό. Χρήση σε πληρωμένες διαφημίσεις ή αποκλειστικότητα ισχύει μόνο αν περιλαμβάνεται στα extras και για τη διάρκεια που ορίζουν. Κάθε extra της σύνοψης αποτελεί μέρος της συμφωνίας.",
    "Σήμανση διαφήμισης. Ο Δημιουργός σημαίνει κάθε δημοσίευση ως εμπορική συνεργασία, με την ένδειξη «Συνεργασία επί πληρωμή» ή #διαφήμιση, σύμφωνα με την ισχύουσα νομοθεσία και τους κανόνες κάθε πλατφόρμας.",
    "Ακύρωση. Οποιαδήποτε πλευρά μπορεί να ακυρώσει τη συνεργασία πριν από την έγκριση του περιεχομένου, ενημερώνοντας την άλλη μέσω της πλατφόρμας. Αν το περιεχόμενο έχει ήδη εγκριθεί ή δημοσιευτεί, οφείλεται η συμφωνημένη αμοιβή.",
    "Εμπιστευτικότητα και επικοινωνία. Οι δύο πλευρές κρατούν εμπιστευτικές τις μη δημόσιες πληροφορίες της συνεργασίας και επικοινωνούν επαγγελματικά, κατά προτίμηση μέσω της πλατφόρμας.",
    "Ρόλος του Influo. Το Influo φέρνει σε επαφή τις δύο πλευρές και καταγράφει τη συμφωνία. Δεν είναι συμβαλλόμενο μέρος και δεν εγγυάται την εκτέλεσή της. Μετά την ολοκλήρωση, η συνεργασία μπορεί να εμφανίζεται στο προφίλ του Δημιουργού και οι δύο πλευρές μπορούν να αξιολογήσουν η μία την άλλη. Τυχόν παρουσία σε χώρο, μετακινήσεις, έξοδα ή άλλες λεπτομέρειες εκτέλεσης συμφωνούνται απευθείας μεταξύ των μερών. Το Influo δεν φέρει καμία ευθύνη για τη συμπεριφορά, τις ενέργειες ή τις υποχρεώσεις των μερών, εντός ή εκτός πλατφόρμας.",
  ],
  en: [
    "Scope. The Creator will create and publish the deliverables in the summary, in accordance with the Brand's instructions as agreed on the Influo platform.",
    "Content approval. Before publication, the Creator submits the content to the Brand for approval. Up to one round of revisions is included, unless otherwise agreed.",
    "Fee. The Brand pays the total fee in the summary directly to the Creator after the approved content is published, unless otherwise agreed in writing. Influo does not process the payment and is not liable for it.",
    "Use of content. Copyright remains with the Creator. The Brand may repost the content on its own channels with credit to the Creator. Use in paid advertising or exclusivity applies only if it is included in the extras and for the duration they specify. Each extra in the summary forms part of the agreement.",
    "Advertising disclosure. The Creator marks every publication as a commercial collaboration, with the label “Paid partnership” or #ad, in accordance with applicable law and the rules of each platform.",
    "Cancellation. Either party may cancel the collaboration before the content is approved, by notifying the other party through the platform. If the content has already been approved or published, the agreed fee is due.",
    "Confidentiality and communication. Both parties keep non-public information about the collaboration confidential and communicate professionally, preferably through the platform.",
    "Role of Influo. Influo brings the two parties together and records the agreement. It is not a contracting party and does not guarantee its performance. After completion, the collaboration may appear on the Creator's profile and both parties may review each other. Any attendance at a location, travel, expenses, or other details of performance are agreed directly between the parties. Influo bears no liability for the conduct, actions, or obligations of the parties, on or off the platform.",
  ],
};

const COPY = {
  el: {
    title: (id: string) => `Συμφωνία Συνεργασίας #${id}`,
    summary: "Σύνοψη",
    brand: "Επιχείρηση",
    creator: "Δημιουργός",
    deliverables: "Παραδοτέα",
    extras: "Extras",
    fee: "Συνολική αμοιβή",
    deadline: "Προθεσμία δημοσίευσης",
    deadlineValue: "κατόπιν συνεννόησης",
    terms: "Όροι",
    checkbox: (id: string) => `Διάβασα και αποδέχομαι τους παραπάνω όρους της Συμφωνίας Συνεργασίας #${id}.`,
    cancel: "Ακύρωση",
    accept: "Αποδοχή συμφωνίας",
    saving: "Αποθήκευση...",
    close: "Κλείσιμο",
    statusWaiting: "Αναμονή του δημιουργού",
    statusCompleted: "Ολοκληρώθηκε",
  },
  en: {
    title: (id: string) => `Collaboration Agreement #${id}`,
    summary: "Summary",
    brand: "Brand",
    creator: "Creator",
    deliverables: "Deliverables",
    extras: "Extras",
    fee: "Total fee",
    deadline: "Publication deadline",
    deadlineValue: "to be agreed",
    terms: "Terms",
    checkbox: (id: string) => `I have read and accept the above terms of Collaboration Agreement #${id}.`,
    cancel: "Cancel",
    accept: "Accept agreement",
    saving: "Saving...",
    close: "Close",
    statusWaiting: "Waiting for the creator",
    statusCompleted: "Completed",
  },
} as const;

function shown(value: string): string {
  const text = value.trim();
  return text || "—";
}

type AgreementTermsProps = {
  lang: Lang;
  proposalId: string | number;
  brandName: string;
  creatorName: string;
  serviceType: string | null | undefined;
  budget: unknown;
  counterProposalBudget?: unknown;
  counterProposalStatus?: string | null;
  selectedExtras?: unknown;
  publishDeadline?: string | null;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onCancel: () => void;
  onAccept: () => void;
  saving?: boolean;
  /** Brand already accepted: terms stay visible, without the accept controls. */
  readOnly?: boolean;
  /** Shown only in read-only mode. */
  status?: "waiting" | "completed";
};

export default function AgreementTerms({
  lang,
  proposalId,
  brandName,
  creatorName,
  serviceType,
  budget,
  counterProposalBudget,
  counterProposalStatus,
  selectedExtras,
  publishDeadline,
  accepted,
  onAcceptedChange,
  onCancel,
  onAccept,
  saving = false,
  readOnly = false,
  status,
}: AgreementTermsProps) {
  const copy = COPY[lang];
  const id = String(proposalId);
  const extrasLine = formatProposalExtrasLine(selectedExtras, lang);
  const extras = extrasLine ? extrasLine.replace(/^Extras:\s*/, "") : "";
  const fee = formatEuroAmount(
    agreedProposalFee({
      budget,
      counter_proposal_budget: counterProposalBudget,
      counter_proposal_status: counterProposalStatus,
    }),
    lang
  );
  const rows: Array<{ label: string; value: string }> = [
    { label: copy.brand, value: shown(brandName) },
    { label: copy.creator, value: shown(creatorName) },
    { label: copy.deliverables, value: shown(displayServiceType(serviceType, lang)) },
  ];
  if (extras) rows.push({ label: copy.extras, value: extras });
  rows.push(
    { label: copy.fee, value: shown(fee) },
    { label: copy.deadline, value: formatDate(publishDeadline, lang) || copy.deadlineValue }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agreement-terms-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h2 id="agreement-terms-title" className="text-xl font-bold text-slate-900">
            {copy.title(id)}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={copy.close}
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-2xl text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-6 py-5">
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{copy.summary}</h3>
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {rows.map((row) => (
                <div key={row.label} className="grid grid-cols-[minmax(8rem,38%)_1fr] gap-3 px-4 py-3 text-sm">
                  <dt className="text-slate-500">{row.label}</dt>
                  <dd className="font-medium text-slate-900">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{copy.terms}</h3>
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-700">
              {TERMS[lang].map((term) => {
                const split = term.indexOf(". ");
                const heading = split === -1 ? term : term.slice(0, split);
                const body = split === -1 ? "" : term.slice(split + 2);
                return (
                  <li key={heading}>
                    <strong className="text-slate-900">{heading}.</strong> {body}
                  </li>
                );
              })}
            </ol>
          </section>

          {readOnly ? (
            <p
              className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                status === "completed"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              {status === "completed" ? copy.statusCompleted : copy.statusWaiting}
            </p>
          ) : (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => onAcceptedChange(event.target.checked)}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-slate-900/10"
              />
              <span className="text-sm text-slate-700">{copy.checkbox(id)}</span>
            </label>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-200 px-6 py-4">
          {readOnly ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-900 px-4 font-medium text-white hover:bg-slate-800"
            >
              {copy.close}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 font-medium text-slate-700 hover:bg-slate-100"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={onAccept}
                disabled={!accepted || saving}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {saving ? copy.saving : copy.accept}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
