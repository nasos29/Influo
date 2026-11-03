"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Messaging from "@/components/Messaging";
import { supabase } from "@/lib/supabaseClient";
import { getStoredLanguage } from "@/lib/language";
import { loadOwnProfiles } from "@/lib/ownProfile";
import { useOwnPresenceHeartbeat } from "@/lib/useOwnPresenceHeartbeat";

type Who = { mode: "brand"; brandEmail: string; brandName: string } | { mode: "influencer"; id: string; name: string } | null;

function Embed() {
  const conversationId = useSearchParams()?.get("conversation") || null;
  const [who, setWho] = useState<Who>(null);
  const [done, setDone] = useState(false);
  const [lang, setLang] = useState<"el" | "en">("el");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLang(getStoredLanguage());
    void (async () => {
      const p = await loadOwnProfiles(supabase);
      if (p.ok && p.brand) setWho({ mode: "brand", brandEmail: String(p.brand.contact_email || ""), brandName: String(p.brand.brand_name || "") });
      else if (p.ok && p.influencer) setWho({ mode: "influencer", id: String(p.influencer.id), name: String(p.influencer.display_name || "") });
      setDone(true);
    })();
  }, []);
  useOwnPresenceHeartbeat(who?.mode === "brand" ? { kind: "brand", brandEmail: who.brandEmail } : who?.mode === "influencer" ? { kind: "influencer", influencerId: who.id } : null);
  if (!done) return <div className="p-4 text-sm text-slate-500">…</div>;
  if (!who || !conversationId) return <div className="p-4 text-sm text-slate-600">Συνδεθείτε για να δείτε τη συνομιλία.</div>;
  return (
    <div className="h-screen">
      {who.mode === "brand" ? (
        <Messaging compact mode="brand" brandEmail={who.brandEmail} brandName={who.brandName} initialConversationId={conversationId} lang={lang} />
      ) : (
        <Messaging compact mode="influencer" influencerId={who.id} influencerName={who.name} initialConversationId={conversationId} lang={lang} />
      )}
    </div>
  );
}

export default function ChatEmbedPage() {
  return (
    <Suspense fallback={null}>
      <Embed />
    </Suspense>
  );
}
