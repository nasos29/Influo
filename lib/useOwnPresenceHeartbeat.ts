"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PRESENCE_HEARTBEAT_MS } from "@/lib/presenceStatus";
import { presenceTabOpened } from "@/lib/presenceTabs";
import { presenceLogoutEpoch, presenceStillCurrent, registerPresenceStop } from "@/lib/presenceControl";

export type OwnPresenceTarget =
  | { kind: "influencer"; influencerId: string }
  | { kind: "brand"; brandEmail: string }
  | null;

/**
 * Heartbeat for the signed-in user only. Never pass the other party's id or email.
 * beginPresenceLogout() clears the interval before sign-out.
 */
export function useOwnPresenceHeartbeat(target: OwnPresenceTarget) {
  const key =
    target?.kind === "influencer"
      ? `i:${target.influencerId}`
      : target?.kind === "brand"
        ? `b:${target.brandEmail.toLowerCase().trim()}`
        : "";

  useEffect(() => {
    if (!target || !key) return;
    const epoch = presenceLogoutEpoch();
    const influencerId = target.kind === "influencer" ? target.influencerId : "";
    const email = target.kind === "brand" ? target.brandEmail.toLowerCase().trim() : "";
    if (target.kind === "influencer" && !influencerId) return;
    if (target.kind === "brand" && !email) return;

    const write = async (online: boolean) => {
      if (!presenceStillCurrent(epoch)) return;
      const now = new Date().toISOString();
      const patch = { is_online: online, last_seen: now, updated_at: now };
      try {
        if (target.kind === "influencer") {
          if (online) {
            await supabase.from("influencer_presence").upsert(
              { influencer_id: influencerId, ...patch },
              { onConflict: "influencer_id" }
            );
          } else {
            await supabase.from("influencer_presence").update(patch).eq("influencer_id", influencerId);
          }
        } else if (online) {
          await supabase.from("brand_presence").upsert(
            { brand_email: email, ...patch },
            { onConflict: "brand_email" }
          );
        } else {
          await supabase.from("brand_presence").update(patch).eq("brand_email", email);
        }
      } catch {
        /* presence must not block the page */
      }
    };

    const releaseTab = presenceTabOpened();
    let released = false;
    let interval = 0;
    const releaseOnce = () => {
      if (released) return false;
      released = true;
      return releaseTab();
    };
    const stopInterval = () => window.clearInterval(interval);
    const unregister = registerPresenceStop(stopInterval);
    const start = () => {
      if (!presenceStillCurrent(epoch) || document.hidden) return;
      void write(true);
      stopInterval();
      interval = window.setInterval(() => {
        if (!document.hidden && presenceStillCurrent(epoch)) void write(true);
      }, PRESENCE_HEARTBEAT_MS);
    };
    const onVisibility = () => {
      if (document.hidden) stopInterval();
      else start();
    };
    const markIfLast = () => {
      const last = releaseOnce();
      if (!presenceStillCurrent(epoch)) return;
      if (last) void write(false);
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", markIfLast);
    return () => {
      unregister();
      stopInterval();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", markIfLast);
      markIfLast();
    };
    // key already encodes kind + id/email. Depending on the object would restart the heartbeat every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
