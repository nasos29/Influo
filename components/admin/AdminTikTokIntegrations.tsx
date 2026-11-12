"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  abbreviateInfluencerId,
  abbreviateOpenId,
  assertSafeAdminDisplay,
  isSafeTikTokAuthorizeUrl,
} from "@/lib/social/tiktokAdminUi";

type TikTokSpike = {
  apiBase?: string | null;
  scopesRequested?: string | null;
  scopesGranted?: string | null;
  demographicsSupported?: false;
  profile?: {
    ok?: boolean;
    error?: string | null;
    openId?: string | null;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    followerCount?: number | null;
    followingCount?: number | null;
    likesCount?: number | null;
    videoCount?: number | null;
  } | null;
  videos?: {
    ok?: boolean;
    error?: string | null;
    count?: number;
    hasMore?: boolean | null;
    missingScope?: boolean;
    sample?: Array<{
      id?: string | null;
      title?: string | null;
      shareUrl?: string | null;
      embedLink?: string | null;
      coverImageUrl?: string | null;
      viewCount?: number | null;
      likeCount?: number | null;
      commentCount?: number | null;
      shareCount?: number | null;
      duration?: number | null;
    }>;
  } | null;
};

type StatusPayload = {
  ok?: boolean;
  configured?: boolean;
  error?: string;
  oauth?: { redirectUri?: string; scopes?: string; apiVersion?: string };
  testInfluencer?: { id: string; displayName: string | null };
  connection?: {
    connected: boolean;
    platformUserId?: string | null;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    followerCount?: number | null;
    followingCount?: number | null;
    likesCount?: number | null;
    videoCount?: number | null;
    scopesGranted?: string[];
    tokenExpiresAt?: string | null;
    refreshTokenExpiresAt?: string | null;
    lastSyncedAt?: string | null;
    lastError?: string | null;
    demographicsSupported?: boolean;
    spike?: TikTokSpike | null;
  };
};

async function bearerHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("el-GR");
  } catch {
    return iso;
  }
}

type Busy = "connect" | "spike" | "refresh" | "disconnect" | "status" | null;

export default function AdminTikTokIntegrations() {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveSpike, setLiveSpike] = useState<{
    report: TikTokSpike | null;
    scopeIssues?: {
      profileMissingScope?: boolean;
      videosMissingScope?: boolean;
      videosPermissionDenied?: boolean;
    };
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await bearerHeaders();
      const res = await fetch("/api/social/tiktok/status", { headers, cache: "no-store" });
      const body = (await res.json()) as StatusPayload & { error?: string; reason?: string };
      if (res.status === 401) {
        router.replace("/login?redirect=/admin/integrations/tiktok");
        return;
      }
      if (res.status === 403) {
        router.replace("/dashboard?error=unauthorized");
        return;
      }
      if (res.status === 503 && body.error === "schema_not_ready") {
        setError("Database schema not ready — Phase 2 TikTok migrations must be applied first.");
        setStatus(body);
        return;
      }
      if (!res.ok && res.status !== 503) {
        setError(assertSafeAdminDisplay(body.error || `Status HTTP ${res.status}`));
        setStatus(null);
        return;
      }
      setStatus(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const oauth = search.get("tt_oauth");
    if (!oauth) return;
    if (oauth === "ok") {
      setMessage(
        `Σύνδεση OK · ${search.get("username") || "—"} · profile=${search.get("profile") || "?"} · videos=${search.get("videos") || "?"}`
      );
    } else {
      setError(
        assertSafeAdminDisplay(
          `OAuth: ${oauth}${search.get("reason") ? ` (${search.get("reason")})` : ""}`
        )
      );
    }
    router.replace("/admin/integrations/tiktok");
  }, [search, router]);

  const connect = async () => {
    if (busy) return;
    setBusy("connect");
    setError(null);
    setMessage(null);
    try {
      const headers = await bearerHeaders();
      // Never send influencerId — server binds TIKTOK_TEST_INFLUENCER_ID only.
      const res = await fetch("/api/social/tiktok/connect", { headers, cache: "no-store" });
      const body = (await res.json()) as { authorizeUrl?: string; error?: string };
      if (res.status === 401) {
        router.replace("/login?redirect=/admin/integrations/tiktok");
        return;
      }
      if (res.status === 403) {
        setError("Forbidden — admin only");
        return;
      }
      if (!res.ok || !body.authorizeUrl) {
        setError(assertSafeAdminDisplay(body.error || `Connect HTTP ${res.status}`));
        return;
      }
      if (!isSafeTikTokAuthorizeUrl(body.authorizeUrl)) {
        setError("Unexpected authorize URL — aborting redirect");
        return;
      }
      window.location.href = body.authorizeUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed");
      setBusy(null);
    }
  };

  const runSpike = async () => {
    if (busy) return;
    setBusy("spike");
    setError(null);
    setMessage(null);
    setLiveSpike(null);
    try {
      const headers = await bearerHeaders();
      const res = await fetch("/api/social/tiktok/spike", { headers, cache: "no-store" });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        report?: TikTokSpike;
        scopeIssues?: {
          profileMissingScope?: boolean;
          videosMissingScope?: boolean;
          videosPermissionDenied?: boolean;
        };
      };
      if (res.status === 401) {
        router.replace("/login?redirect=/admin/integrations/tiktok");
        return;
      }
      if (res.status === 403) {
        setError("Forbidden — admin only");
        return;
      }
      if (!res.ok) {
        setError(assertSafeAdminDisplay(body.error || `Spike HTTP ${res.status}`));
        return;
      }
      setLiveSpike({ report: body.report || null, scopeIssues: body.scopeIssues });
      setMessage("API test completed — δείτε τα αποτελέσματα παρακάτω.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Spike failed");
    } finally {
      setBusy(null);
    }
  };

  const refreshToken = async () => {
    if (busy) return;
    setBusy("refresh");
    setError(null);
    setMessage(null);
    try {
      const headers = await bearerHeaders();
      const res = await fetch("/api/social/tiktok/refresh", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
        cache: "no-store",
      });
      const body = (await res.json()) as {
        ok?: boolean;
        refreshed?: boolean;
        reason?: string;
        error?: string;
        detail?: string;
        requiresReauth?: boolean;
        tokenExpiresAt?: string;
      };
      if (res.status === 401 && body.requiresReauth) {
        setError("Refresh failed — re-authorization required.");
        await load();
        return;
      }
      if (res.status === 401) {
        router.replace("/login?redirect=/admin/integrations/tiktok");
        return;
      }
      if (res.status === 403) {
        setError("Forbidden — admin only");
        return;
      }
      if (!res.ok || body.ok === false) {
        setError(
          assertSafeAdminDisplay(
            body.detail || body.error || body.reason || `Refresh HTTP ${res.status}`
          )
        );
        return;
      }
      if (body.refreshed === false && body.reason === "not_needed") {
        setMessage("Token still valid — refresh not needed.");
      } else {
        setMessage(
          `Token refreshed · access expires ${body.tokenExpiresAt ? fmt(body.tokenExpiresAt) : "—"}`
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (busy) return;
    const ok = window.confirm(
      "Disconnect TikTok for the designated test influencer?\n\nThis will revoke (if possible) and clear local encrypted tokens."
    );
    if (!ok) return;

    setBusy("disconnect");
    setError(null);
    setMessage(null);
    try {
      const headers = await bearerHeaders();
      const res = await fetch("/api/social/tiktok/disconnect", {
        method: "POST",
        headers,
        cache: "no-store",
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        disconnected?: boolean;
        reason?: string;
        revokeAttempted?: boolean;
        revokeOk?: boolean | null;
        localCleared?: boolean;
        note?: string;
      };
      if (res.status === 401) {
        router.replace("/login?redirect=/admin/integrations/tiktok");
        return;
      }
      if (res.status === 403) {
        setError("Forbidden — admin only");
        return;
      }
      if (!res.ok || body.ok === false) {
        setError(assertSafeAdminDisplay(body.error || `Disconnect HTTP ${res.status}`));
        return;
      }
      if (body.reason === "not_connected") {
        setMessage("No TikTok connection was active.");
      } else {
        const revokePart =
          body.revokeAttempted === false
            ? "Remote revoke not attempted"
            : body.revokeOk
              ? "Remote revoke OK"
              : "Remote revoke failed / incomplete";
        const localPart = body.localCleared ? "local tokens cleared" : "local clear failed";
        setMessage(
          assertSafeAdminDisplay(
            `${body.note || "Disconnected"} · ${revokePart} · ${localPart}`
          )
        );
      }
      setLiveSpike(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setBusy(null);
    }
  };

  const manualStatus = async () => {
    if (busy) return;
    setBusy("status");
    setMessage(null);
    await load();
    setBusy(null);
    setMessage("Status refreshed.");
  };

  const conn = status?.connection;
  const spike = liveSpike?.report || conn?.spike || null;
  const scopeIssues = liveSpike?.scopeIssues;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Admin · Internal testing
            </p>
            <h1 className="text-2xl font-bold">TikTok OAuth (Login Kit)</h1>
            <p className="mt-1 text-sm text-slate-600">
              Μόνο για admin. Δεν εμφανίζεται σε influencers / brands.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/integrations/instagram"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Instagram
            </Link>
            <Link
              href="/admin"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100"
            >
              ← Admin
            </Link>
          </div>
        </div>

        {message ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        ) : null}

        {loading && !status ? (
          <p className="text-slate-600">Loading…</p>
        ) : (
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Connection
              </h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-semibold">
                    {conn?.connected ? (
                      <span className="text-emerald-700">Connected</span>
                    ) : (
                      <span className="text-amber-700">Not connected</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Username</dt>
                  <dd className="font-medium">
                    {conn?.connected && conn.username ? `@${conn.username}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Display name</dt>
                  <dd className="font-medium">
                    {conn?.connected ? conn.displayName || "—" : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Open ID</dt>
                  <dd className="font-mono text-xs break-all">
                    {conn?.connected ? abbreviateOpenId(conn.platformUserId) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Test influencer</dt>
                  <dd>
                    {status?.testInfluencer?.displayName || "—"}
                    <span className="ml-1 font-mono text-xs text-slate-500">
                      ({abbreviateInfluencerId(status?.testInfluencer?.id)})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last sync</dt>
                  <dd>{conn?.connected ? fmt(conn.lastSyncedAt) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Access token expiry</dt>
                  <dd>{conn?.connected && conn.tokenExpiresAt ? fmt(conn.tokenExpiresAt) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Refresh token expiry</dt>
                  <dd>
                    {conn?.connected && conn.refreshTokenExpiresAt
                      ? fmt(conn.refreshTokenExpiresAt)
                      : "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Granted scopes</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {conn?.connected && (conn.scopesGranted || []).length ? (
                      conn.scopesGranted!.map((s) => (
                        <code
                          key={s}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800"
                        >
                          {s}
                        </code>
                      ))
                    ) : (
                      <span>—</span>
                    )}
                  </dd>
                </div>
              </dl>
              {conn?.connected && conn.lastError ? (
                <p className="mt-3 text-sm text-red-700">
                  Last error: {assertSafeAdminDisplay(conn.lastError)}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={busy !== null || status?.configured === false}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy === "connect" ? "Redirecting…" : "Connect TikTok"}
                </button>
                <button
                  type="button"
                  onClick={() => void runSpike()}
                  disabled={busy !== null || !conn?.connected}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  {busy === "spike" ? "Testing…" : "Run API test"}
                </button>
                <button
                  type="button"
                  onClick={() => void refreshToken()}
                  disabled={busy !== null || !conn?.connected}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  {busy === "refresh" ? "Refreshing…" : "Refresh token"}
                </button>
                <button
                  type="button"
                  onClick={() => void disconnect()}
                  disabled={busy !== null || !conn?.connected}
                  className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
                </button>
                <button
                  type="button"
                  onClick={() => void manualStatus()}
                  disabled={busy !== null}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busy === "status" ? "Loading…" : "Check status"}
                </button>
              </div>
              {status?.configured === false ? (
                <p className="mt-3 text-sm text-amber-800">
                  Set <code className="rounded bg-amber-100 px-1">TIKTOK_TEST_INFLUENCER_ID</code> in
                  production env before connecting.
                </p>
              ) : null}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                OAuth config (non-secret)
              </h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">API version</dt>
                  <dd>{status?.oauth?.apiVersion || "v2"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Requested scopes</dt>
                  <dd className="font-mono text-xs break-all">{status?.oauth?.scopes || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Redirect URI</dt>
                  <dd className="font-mono text-xs break-all">{status?.oauth?.redirectUri || "—"}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                API test / spike
              </h2>
              <p className="mt-2 text-xs text-slate-500">
                Audience demographics are <strong>not supported</strong> by the current TikTok scopes
                (`user.info.*` / `video.list`). No age, gender, location, or reach analytics are
                available.
              </p>

              {!conn?.connected ? (
                <p className="mt-3 text-sm text-slate-600">
                  Connect TikTok first. No demo metrics are shown while disconnected.
                </p>
              ) : !spike ? (
                <p className="mt-3 text-sm text-slate-600">Δεν υπάρχει spike report ακόμα.</p>
              ) : (
                <div className="mt-3 space-y-4 text-sm">
                  <p>
                    Profile:{" "}
                    <strong className={spike.profile?.ok ? "text-emerald-700" : "text-red-700"}>
                      {spike.profile?.ok ? "OK" : "FAIL"}
                    </strong>
                    {spike.profile?.error
                      ? ` · ${assertSafeAdminDisplay(spike.profile.error)}`
                      : ""}
                    {scopeIssues?.profileMissingScope ? (
                      <span className="ml-1 text-amber-700">(missing profile scope)</span>
                    ) : null}
                  </p>

                  {spike.profile?.ok ? (
                    <dl className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Followers</dt>
                        <dd className="font-semibold">
                          {spike.profile.followerCount != null
                            ? String(spike.profile.followerCount)
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Following</dt>
                        <dd className="font-semibold">
                          {spike.profile.followingCount != null
                            ? String(spike.profile.followingCount)
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Total likes</dt>
                        <dd className="font-semibold">
                          {spike.profile.likesCount != null ? String(spike.profile.likesCount) : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Video count</dt>
                        <dd className="font-semibold">
                          {spike.profile.videoCount != null ? String(spike.profile.videoCount) : "—"}
                        </dd>
                      </div>
                    </dl>
                  ) : null}

                  <div>
                    <p>
                      Videos:{" "}
                      <strong className={spike.videos?.ok ? "text-emerald-700" : "text-red-700"}>
                        {spike.videos?.ok ? "OK" : "FAIL"}
                      </strong>
                      {spike.videos?.count != null ? ` · ${spike.videos.count} listed` : ""}
                      {spike.videos?.hasMore ? " · more available" : ""}
                      {spike.videos?.error
                        ? ` · ${assertSafeAdminDisplay(spike.videos.error)}`
                        : ""}
                    </p>
                    {scopeIssues?.videosMissingScope || spike.videos?.missingScope ? (
                      <p className="mt-1 text-amber-800">
                        Missing <code>video.list</code> permission — video data unavailable.
                      </p>
                    ) : null}
                    {scopeIssues?.videosPermissionDenied && !spike.videos?.missingScope ? (
                      <p className="mt-1 text-amber-800">Video API permission denied.</p>
                    ) : null}
                    {(spike.videos?.sample || []).length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {spike.videos!.sample!.map((v, i) => (
                          <li
                            key={v.id || `v-${i}`}
                            className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                          >
                            <div className="font-medium text-slate-800">
                              {v.title || v.id || "Video"}
                            </div>
                            <div className="mt-1 text-slate-600">
                              views {v.viewCount ?? "—"} · likes {v.likeCount ?? "—"} · comments{" "}
                              {v.commentCount ?? "—"} · shares {v.shareCount ?? "—"}
                              {v.duration != null ? ` · ${v.duration}s` : ""}
                            </div>
                            {v.shareUrl ? (
                              <a
                                href={v.shareUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-block text-slate-700 underline"
                              >
                                Open on TikTok
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <p className="text-xs text-slate-500">
                    demographicsSupported:{" "}
                    <strong className="text-slate-700">false</strong>
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
