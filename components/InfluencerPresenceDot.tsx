"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatActiveLabel, presenceOnline } from "@/lib/presenceStatus";
import { counterpartyInfluencerPresence } from "@/lib/presenceIdentity";

/** Μικρή ένδειξη online/offline (ίδια λογική με Messaging.checkInfluencerStatus). */
export default function InfluencerPresenceDot({
  influencerId,
  lang = "el",
  className = "",
}: {
  influencerId: string;
  lang?: "el" | "en";
  className?: string;
}) {
  const [online, setOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    if (!influencerId) return;

    const check = async () => {
      const { data, error } = await supabase
        .from("influencer_presence")
        .select("influencer_id, is_online, last_seen")
        .eq("influencer_id", influencerId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        setOnline(false);
        return;
      }
      const row = counterpartyInfluencerPresence(influencerId, data);
      if (!row) {
        setOnline(false);
        setLastSeen(null);
        return;
      }
      setLastSeen(row.last_seen || null);
      setOnline(presenceOnline(row));
    };

    check();
    const interval = setInterval(check, 30000);
    const channel = supabase
      .channel(`influencer_presence_dot:${influencerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "influencer_presence",
          filter: `influencer_id=eq.${influencerId}`,
        },
        () => {
          check();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [influencerId]);

  const title = formatActiveLabel(lastSeen, online, lang);

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={title}
      aria-label={title}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
          online ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
        }`}
      />
    </span>
  );
}
