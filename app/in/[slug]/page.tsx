import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import InfluencerProfileClient from "@/components/InfluencerProfileClient";
import { supabaseService } from "@/lib/apiAuth";
import { loadSeoProfileById, loadSeoProfileBySlug, type SeoProfile } from "@/lib/loadSeoProfile";
import { profileJsonLd, profileMetadata } from "@/lib/profileSeo";
import { retiredSlugInfluencerId } from "@/lib/profileSlugAssign";
import { publicProfilePath } from "@/lib/profileSlug";

export const revalidate = 3600;
export const dynamicParams = true;

/** Empty at build — pages generated on demand and then ISR-cached. */
export function generateStaticParams(): { slug: string }[] {
  return [];
}

type Params = Promise<{ slug: string }>;

async function resolveSlug(slug: string): Promise<{ profile: SeoProfile; redirect: boolean } | null> {
  const profile = await loadSeoProfileBySlug(slug);
  if (profile) return { profile, redirect: false };

  const previousOwner = await retiredSlugInfluencerId(supabaseService(), slug);
  if (!previousOwner) return null;
  const retired = await loadSeoProfileById(previousOwner);
  if (!retired) return null;
  const current = (retired.profile_slug || "").toLowerCase();
  const requested = slug.trim().toLowerCase();
  return { profile: retired, redirect: current !== requested };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveSlug(slug);
  if (!resolved) {
    return {
      title: { absolute: "Προφίλ δεν βρέθηκε | Influo" },
      robots: { index: false, follow: false },
    };
  }
  return profileMetadata(resolved.profile.view);
}

export default async function InfluencerBySlugPage({ params }: { params: Params }) {
  const { slug } = await params;
  const resolved = await resolveSlug(slug);
  if (!resolved) notFound();

  const path = publicProfilePath(resolved.profile.profile_slug, resolved.profile.id);
  if (resolved.redirect) {
    // Drop query string here so the page stays ISR-static (client keeps deep-links).
    permanentRedirect(path);
  }

  const jsonLd = profileJsonLd(resolved.profile.view);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {/* useSearchParams() inside the client tree needs a Suspense boundary for ISR. */}
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        <InfluencerProfileClient
          params={Promise.resolve({ id: resolved.profile.id })}
          initialProfile={resolved.profile.view}
          publicPath={path}
        />
      </Suspense>
    </>
  );
}
