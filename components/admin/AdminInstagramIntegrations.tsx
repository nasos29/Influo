"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type StatusPayload = {
  ok?: boolean;
  configured?: boolean;
  error?: string;
  oauth?: { configId?: string; redirectUri?: string; graphVersion?: string };
  testInfluencer?: { id: string; displayName: string | null; profileSlug: string | null };
  connection?: {
    connected: boolean;
    igUserId: string | null;
    username: string | null;
    clientBusinessId?: string | null;
    lastSyncedAt: string | null;
    lastError?: string | null;
    tokenExpiresAt?: string | null;
    spike?: {
      graphVersion?: string | null;
      profile?: {
        ok?: boolean;
        error?: string | null;
        followers?: unknown;
        username?: unknown;
        name?: unknown;
        mediaCount?: unknown;
      } | null;
      insightsDay?: {
        ok?: boolean;
        status?: string | null;
        error?: string | null;
        metricTried?: string | null;
        hasData?: boolean;
        groups?: Array<{
          kind: string;
          metrics: string;
          representation?: string;
          ok: boolean;
          error?: string | null;
        }>;
      } | null;
      demographics?: Array<{
        breakdown: string;
        ok: boolean;
        error?: string | null;
        hasData?: boolean;
      }>;
    } | null;
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

export default function AdminInstagramIntegrations() {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"connect" | "spike" | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await bearerHeaders();
      const res = await fetch("/api/social/instagram/status", { headers, cache: "no-store" });
      const body = (await res.json()) as StatusPayload & { error?: string };
      if (res.status === 401) {
        router.replace("/login?redirect=/admin/integrations/instagram");
        return;
      }
      if (res.status === 403) {
        router.replace("/dashboard?error=unauthorized");
        return;
      }
      if (!res.ok && res.status !== 503) {
        setError(body.error || `Status HTTP ${res.status}`);
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
    const oauth = search.get("ig_oauth");
    if (!oauth) return;
    if (oauth === "ok") {
      setMessage(
        `Σύνδεση OK · @${search.get("username") || "—"} · insights=${search.get("insights") || "?"} · demographics=${search.get("demo") || "?"}`
      );
    } else {
      setError(`OAuth: ${oauth}${search.get("reason") ? ` (${search.get("reason")})` : ""}`);
    }
    router.replace("/admin/integrations/instagram");
  }, [search, router]);

  const connect = async () => {
    setBusy("connect");
    setError(null);
    setMessage(null);
    try {
      const headers = await bearerHeaders();
      const res = await fetch("/api/social/instagram/connect", { headers, cache: "no-store" });
      const body = (await res.json()) as { authorizeUrl?: string; error?: string };
      if (res.status === 401) {
        router.replace("/login?redirect=/admin/integrations/instagram");
        return;
      }
      if (res.status === 403) {
        setError("Forbidden — admin only");
        return;
      }
      if (!res.ok || !body.authorizeUrl) {
        setError(body.error || `Connect HTTP ${res.status}`);
        return;
      }
      window.location.href = body.authorizeUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed");
      setBusy(null);
    }
  };

  const testInsights = async () => {
    setBusy("spike");
    setError(null);
    setMessage(null);
    try {
      const headers = await bearerHeaders();
      const res = await fetch("/api/social/instagram/spike", { headers, cache: "no-store" });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        report?: StatusPayload["connection"] extends { spike?: infer S } ? S : unknown;
      };
      if (res.status === 401) {
        router.replace("/login?redirect=/admin/integrations/instagram");
        return;
      }
      if (res.status === 403) {
        setError("Forbidden — admin only");
        return;
      }
      if (!res.ok) {
        setError(body.error || `Spike HTTP ${res.status}`);
        return;
      }
      setMessage("Insights test completed — δείτε τα αποτελέσματα παρακάτω.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Spike failed");
    } finally {
      setBusy(null);
    }
  };

  const conn = status?.connection;
  const spike = conn?.spike;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Admin · Internal testing
            </p>
            <h1 className="text-2xl font-bold">Instagram OAuth (Unified Login)</h1>
            <p className="mt-1 text-sm text-slate-600">
              Μόνο για admin. Δεν εμφανίζεται σε influencers / brands.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100"
          >
            ← Admin
          </Link>
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

        {loading ? (
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
                  <dd className="font-medium">{conn?.username ? `@${conn.username}` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Instagram account ID</dt>
                  <dd className="font-mono text-xs break-all">{conn?.igUserId || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last sync</dt>
                  <dd>{fmt(conn?.lastSyncedAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Test influencer</dt>
                  <dd>
                    {status?.testInfluencer?.displayName || "—"}
                    {status?.testInfluencer?.profileSlug
                      ? ` · /in/${status.testInfluencer.profileSlug}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Token expiry</dt>
                  <dd>{conn?.tokenExpiresAt ? fmt(conn.tokenExpiresAt) : "Never / unset"}</dd>
                </div>
              </dl>
              {conn?.lastError ? (
                <p className="mt-3 text-sm text-red-700">Last error: {conn.lastError}</p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={busy !== null || !status?.configured}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy === "connect" ? "Redirecting…" : "Connect Instagram"}
                </button>
                <button
                  type="button"
                  onClick={() => void testInsights()}
                  disabled={busy !== null || !conn?.connected}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  {busy === "spike" ? "Testing…" : "Test Insights"}
                </button>
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={busy !== null}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>
              {!status?.configured ? (
                <p className="mt-3 text-sm text-amber-800">
                  Set <code className="rounded bg-amber-100 px-1">META_IG_TEST_INFLUENCER_ID</code> in
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
                  <dt className="text-slate-500">Config ID</dt>
                  <dd className="font-mono text-xs">{status?.oauth?.configId || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Graph version</dt>
                  <dd>{status?.oauth?.graphVersion || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Redirect URI</dt>
                  <dd className="font-mono text-xs break-all">{status?.oauth?.redirectUri || "—"}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Last insights probe
              </h2>
              {!spike ? (
                <p className="mt-3 text-sm text-slate-600">Δεν υπάρχει spike report ακόμα.</p>
              ) : (
                <div className="mt-3 space-y-3 text-sm">
                  <p>
                    Profile:{" "}
                    <strong className={spike.profile?.ok ? "text-emerald-700" : "text-red-700"}>
                      {spike.profile?.ok ? "OK" : "FAIL"}
                    </strong>
                    {spike.profile?.followers != null ? ` · followers ${String(spike.profile.followers)}` : ""}
                    {spike.profile?.error ? ` · ${spike.profile.error}` : ""}
                  </p>
                  <p>
                    Day insights:{" "}
                    <strong
                      className={
                        spike.insightsDay?.status === "complete" || spike.insightsDay?.ok
                          ? "text-emerald-700"
                          : spike.insightsDay?.status === "partial"
                            ? "text-amber-700"
                            : "text-red-700"
                      }
                    >
                      {spike.insightsDay?.status === "complete" || spike.insightsDay?.ok
                        ? "OK"
                        : spike.insightsDay?.status === "partial"
                          ? "PARTIAL"
                          : "FAIL"}
                    </strong>
                    {spike.insightsDay?.status ? ` · status=${spike.insightsDay.status}` : ""}
                    {spike.insightsDay?.metricTried ? ` · ${spike.insightsDay.metricTried}` : ""}
                    {spike.insightsDay?.error ? ` · ${spike.insightsDay.error}` : ""}
                  </p>
                  {(spike.insightsDay?.groups || []).length > 0 ? (
                    <ul className="space-y-1 text-xs text-slate-600">
                      {spike.insightsDay!.groups!.map((g) => (
                        <li key={g.kind}>
                          <code>{g.kind}</code> ({g.metrics}
                          {g.representation ? `, ${g.representation}` : ""}):{" "}
                          <strong className={g.ok ? "text-emerald-700" : "text-red-700"}>
                            {g.ok ? "OK" : "FAIL"}
                          </strong>
                          {g.error ? ` · ${g.error}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <ul className="space-y-1">
                    {(spike.demographics || []).map((d) => (
                      <li key={d.breakdown}>
                        Demographics <code>{d.breakdown}</code>:{" "}
                        <strong className={d.ok ? "text-emerald-700" : "text-red-700"}>
                          {d.ok ? "OK" : "FAIL"}
                        </strong>
                        {d.error ? ` · ${d.error}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
