export const SHORTLIST_NOTE_MAX = 280;

export type BrandShortlistItem = {
  influencerId: string;
  note: string;
  createdAt: string;
  displayName: string;
  avatarUrl: string | null;
  category: string | null;
  minRate: string | null;
  approved: boolean;
};

async function authHeader(): Promise<HeadersInit> {
  const { supabase } = await import("@/lib/supabaseClient");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("unauthorized");
  return { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
}

export async function fetchBrandShortlist(): Promise<BrandShortlistItem[]> {
  const headers = await authHeader();
  const res = await fetch("/api/brand/shortlist", { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "shortlist_failed");
  return Array.isArray(data.items) ? data.items : [];
}

export async function addBrandShortlist(influencerId: string): Promise<void> {
  const headers = await authHeader();
  const res = await fetch("/api/brand/shortlist", {
    method: "POST",
    headers,
    body: JSON.stringify({ influencerId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "shortlist_add_failed");
}

export async function updateBrandShortlistNote(influencerId: string, note: string): Promise<void> {
  const headers = await authHeader();
  const res = await fetch("/api/brand/shortlist", {
    method: "PATCH",
    headers,
    body: JSON.stringify({ influencerId, note }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "shortlist_note_failed");
}

export async function removeBrandShortlist(influencerId: string): Promise<void> {
  const headers = await authHeader();
  const res = await fetch(`/api/brand/shortlist?influencerId=${encodeURIComponent(influencerId)}`, {
    method: "DELETE",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "shortlist_remove_failed");
}
