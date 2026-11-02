import { formatDisplayDateTime } from "@/lib/formatDate";
import type { SupportMessage } from "@/lib/supportThread";

const copy = {
  el: { you: "Εσείς", support: "Υποστήριξη", user: "Χρήστης", empty: "Δεν υπάρχουν μηνύματα ακόμα." },
  en: { you: "You", support: "Support", user: "User", empty: "No messages yet." },
} as const;

export default function SupportTicketThread({
  messages,
  lang,
  viewer,
}: {
  messages: SupportMessage[];
  lang: "el" | "en";
  viewer: "admin" | "user";
}) {
  const t = copy[lang];
  if (messages.length === 0) {
    return <p className="text-sm text-slate-500">{t.empty}</p>;
  }
  return (
    <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
      {messages.map((message) => {
        const mine = viewer === "admin" ? message.sender_role === "admin" : message.sender_role === "user";
        const label = message.sender_role === "admin" ? t.support : viewer === "admin" ? t.user : t.you;
        return (
          <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-900"}`}>
              <p className={`mb-1 text-[11px] font-semibold ${mine ? "text-blue-100" : "text-slate-500"}`}>{label}</p>
              <p className="whitespace-pre-wrap">{message.body}</p>
              {message.attachments?.length ? (
                <div className="mt-2 space-y-1">
                  {message.attachments.map((file, index) => (
                    <a
                      key={`${file.url}-${index}`}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block text-xs underline ${mine ? "text-blue-100" : "text-blue-700"}`}
                    >
                      {file.filename || file.url}
                    </a>
                  ))}
                </div>
              ) : null}
              <p className={`mt-1 text-[10px] tabular-nums ${mine ? "text-blue-100" : "text-slate-400"}`}>
                {formatDisplayDateTime(message.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
