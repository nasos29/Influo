"use client";

import { useState } from "react";
import Link from "next/link";
import ResponsiveDialog, { DialogClose } from "@/components/ResponsiveDialog";
import GateAvatarGrid from "@/components/GateAvatarGrid";
import { campaignChoiceLine } from "@/lib/campaignChoiceMeta";

const COPY = {
  el: {
    emptyTitle: "Δημιούργησε καμπάνια για να προσκαλέσεις creators",
    check1: "Οι creators στέλνουν αιτήσεις σε σένα",
    check2: "Εσύ διαλέγεις με ποιους θα συνεργαστείς",
    create: "Δημιουργία καμπάνιας",
    campaign: "Καμπάνια",
    message: "Μήνυμα (προαιρετικό)",
    placeholder: "Γεια σου, θα θέλαμε πολύ να συνεργαστούμε...",
    send: "Αποστολή πρόσκλησης",
    sending: "Αποστολή...",
    sent: "Η πρόσκληση στάλθηκε.",
    sentBody: "Ο creator την βλέπει στις προτάσεις και στα μηνύματα.",
    close: "Κλείσιμο",
    newCampaign: "+ Νέα καμπάνια",
    loadError: "Οι καμπάνιες δεν φορτώθηκαν. Δοκίμασε ξανά.",
    adminTitle: "Δεν έχεις καμπάνια",
    adminBody: "Ο admin λογαριασμός δεν έχει δικό του brand, οπότε δεν μπορεί να στείλει πρόσκληση από εδώ.",
  },
  en: {
    emptyTitle: "Create a campaign to invite creators",
    check1: "Creators send applications to you",
    check2: "You choose who you work with",
    create: "Create campaign",
    campaign: "Campaign",
    message: "Message (optional)",
    placeholder: "Hi, we would love to work together...",
    send: "Send invitation",
    sending: "Sending...",
    sent: "Invite sent.",
    sentBody: "The creator sees it in proposals and messages.",
    close: "Close",
    newCampaign: "+ New campaign",
    loadError: "Campaigns could not be loaded. Try again.",
    adminTitle: "No campaign",
    adminBody: "This admin account does not have its own brand, so it cannot send an invite from here.",
  },
} as const;

export const NEW_CAMPAIGN_HREF = "/brand/dashboard?tab=campaigns&new=1";

export type InviteCampaign = {
  id: string;
  title: string;
  budget?: number | string | null;
  status: string;
  deadline?: string | null;
};

export function NoCampaignModal({
  open,
  onClose,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  lang: "el" | "en";
}) {
  const copy = COPY[lang];
  return (
    <ResponsiveDialog open={open} onClose={onClose} labelledBy="no-campaign-title">
      <DialogClose onClose={onClose} />
      <div className="px-5 pb-6 pt-6 sm:px-6 sm:pb-7 sm:pt-7">
        <h2 id="no-campaign-title" className="pr-8 text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
          {copy.emptyTitle}
        </h2>
        <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-emerald-500" aria-hidden>✓</span>
            {copy.check1}
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-emerald-500" aria-hidden>✓</span>
            {copy.check2}
          </li>
        </ul>
        <GateAvatarGrid active={open} />
        <Link
          href={NEW_CAMPAIGN_HREF}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 text-sm font-semibold text-white hover:from-blue-700 hover:to-purple-700"
        >
          {copy.create}
        </Link>
      </div>
    </ResponsiveDialog>
  );
}

export function AdminNoBrandModal({
  open,
  onClose,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  lang: "el" | "en";
}) {
  const copy = COPY[lang];
  return (
    <ResponsiveDialog open={open} onClose={onClose} labelledBy="admin-no-brand-title">
      <DialogClose onClose={onClose} />
      <div className="px-5 pb-6 pt-6 sm:px-6 sm:pb-7 sm:pt-7">
        <h2 id="admin-no-brand-title" className="pr-8 text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
          {copy.adminTitle}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{copy.adminBody}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-sm font-semibold text-white hover:from-blue-700 hover:to-purple-700"
        >
          {copy.close}
        </button>
      </div>
    </ResponsiveDialog>
  );
}

export function CampaignPickModal({
  open,
  onClose,
  lang,
  heading,
  campaigns,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  lang: "el" | "en";
  heading: string;
  campaigns: InviteCampaign[];
  onSend: (input: { campaignId: string; message: string }) => Promise<void>;
}) {
  const copy = COPY[lang];
  const [selectedId, setSelectedId] = useState(campaigns[0]?.id || "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const activeId = campaigns.some((row) => row.id === selectedId) ? selectedId : campaigns[0]?.id || "";

  return (
    <ResponsiveDialog open={open} onClose={onClose} labelledBy="pick-campaign-title">
      <DialogClose onClose={onClose} />
      <div className="px-5 pb-6 pt-6 sm:px-6 sm:pb-7 sm:pt-7">
        <h2 id="pick-campaign-title" className="pr-8 text-xl font-bold leading-tight text-slate-900 sm:text-[1.35rem]">
          {heading}
        </h2>
        {sent ? (
          <div className="mt-6 text-center">
            <p className="text-lg font-bold text-slate-900">{copy.sent}</p>
            <p className="mt-2 text-sm text-slate-500">{copy.sentBody}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-blue-600"
            >
              {copy.close}
            </button>
          </div>
        ) : (
          <form
            className="mt-5 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!activeId || sending) return;
              setSending(true);
              setError("");
              try {
                await onSend({ campaignId: activeId, message: message.trim() });
                setSent(true);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Error");
              } finally {
                setSending(false);
              }
            }}
          >
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">{copy.campaign}</legend>
              <div className="mt-2 space-y-2">
                {campaigns.map((campaign) => {
                  const selected = campaign.id === activeId;
                  return (
                    <label
                      key={campaign.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                        selected
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-slate-800"
                      }`}
                    >
                      <input
                        type="radio"
                        name="campaign"
                        className="mt-1 h-4 w-4 accent-blue-600"
                        checked={selected}
                        onChange={() => setSelectedId(campaign.id)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{campaign.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {campaignChoiceLine({
                            status: campaign.status,
                            budget: campaign.budget,
                            deadline: campaign.deadline,
                            lang,
                          })}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{copy.message}</span>
              <textarea
                rows={3}
                maxLength={2000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={copy.placeholder}
                className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={sending || !activeId}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-sm font-semibold text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-60"
            >
              {sending ? copy.sending : copy.send}
            </button>
            <p className="text-center">
              <Link href={NEW_CAMPAIGN_HREF} className="text-sm text-slate-500 hover:text-slate-800">
                {copy.newCampaign}
              </Link>
            </p>
          </form>
        )}
      </div>
    </ResponsiveDialog>
  );
}

export function CampaignLoadError({
  open,
  onClose,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  lang: "el" | "en";
}) {
  const copy = COPY[lang];
  return (
    <ResponsiveDialog open={open} onClose={onClose} labelledBy="campaign-load-title">
      <DialogClose onClose={onClose} />
      <div className="px-5 py-8 sm:px-6">
        <h2 id="campaign-load-title" className="pr-8 text-lg font-bold text-slate-900">
          {copy.loadError}
        </h2>
      </div>
    </ResponsiveDialog>
  );
}
