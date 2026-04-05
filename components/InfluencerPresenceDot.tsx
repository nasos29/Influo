"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

  useEffect(() => {
    if (!influencerId) return;

    const check = async () => {
      const { data, error } = await supabase
        .from("influencer_presence")
        .select("is_online, last_seen, updated_at")
        .eq("influencer_id", influencerId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        setOnline(false);
        return;
      }
      if (!data) {
        setOnline(false);
        return;
      }
      const lastSeen = new Date(data.last_seen);
      const updatedAt = new Date(data.updated_at || data.last_seen);
      const now = new Date();
      const secondsSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 1000;
      const secondsSinceUpdated = (now.getTime() - updatedAt.getTime()) / 1000;
      const isOnline =
        data.is_online && secondsSinceLastSeen < 60 && secondsSinceUpdated < 60;
      setOnline(!!isOnline);
    };

    check();
    const interval = setInterval(check, 10000);
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

  const title =
    lang === "el"
      ? online
        ? "Συνδεδεμένος/η τώρα"
        : "Offline"
      : online
        ? "Online now"
        : "Offline";

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
