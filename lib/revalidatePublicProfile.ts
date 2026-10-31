import { revalidatePath, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

function addSlug(tags: Set<string>, paths: Set<string>, raw: string | null | undefined) {
  const slug = (raw || "").trim().toLowerCase();
  if (!slug) return;
  tags.add(`profile-${slug}`);
  paths.add(`/in/${slug}`);
}

/** Drop the cached public profile page and its SEO data cache. */
export function revalidatePublicProfile(input: {
  id?: string | null;
  slug?: string | null;
  previousSlug?: string | null;
}) {
  const tags = new Set<string>();
  const paths = new Set<string>();
  addSlug(tags, paths, input.slug);
  addSlug(tags, paths, input.previousSlug);
  const id = (input.id || "").trim();
  if (id) {
    tags.add(`profile-id-${id}`);
    paths.add(`/influencer/${id}`);
  }
  for (const tag of tags) revalidateTag(tag, "max");
  for (const path of paths) revalidatePath(path);
}

/** Read the current slug, then invalidate id and slug caches. */
export async function revalidatePublicProfileById(
  admin: SupabaseClient,
  id: string,
  previousSlug?: string | null
) {
  const clean = (id || "").trim();
  if (!clean) return;
  let slug: string | null = null;
  const row = await admin.from("influencers").select("profile_slug").eq("id", clean).maybeSingle();
  if (!row.error && typeof row.data?.profile_slug === "string") slug = row.data.profile_slug;
  revalidatePublicProfile({ id: clean, slug, previousSlug });
}
