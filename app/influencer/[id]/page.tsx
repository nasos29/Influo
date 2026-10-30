import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import InfluencerProfileClient from "@/components/InfluencerProfileClient";
import { loadSeoProfileById } from "@/lib/loadSeoProfile";
import { profileJsonLd, profileMetadata } from "@/lib/profileSeo";
import { publicProfilePath } from "@/lib/profileSlug";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams(): { id: string }[] {
  return [];
}

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const profile = await loadSeoProfileById(id);
  if (!profile) {
    return {
      title: { absolute: "Προφίλ δεν βρέθηκε | Influo" },
      robots: { index: false, follow: false },
    };
  }
  return profileMetadata(profile.view);
}

export default async function InfluencerByIdPage({ params }: { params: Params }) {
  const { id } = await params;
  const profile = await loadSeoProfileById(id);
  if (!profile) notFound();

  const path = publicProfilePath(profile.profile_slug, profile.id);
  if (profile.profile_slug) {
    permanentRedirect(path);
  }

  const jsonLd = profileJsonLd(profile.view);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        <InfluencerProfileClient
          params={Promise.resolve({ id: profile.id })}
          initialProfile={profile.view}
          publicPath={path}
        />
      </Suspense>
    </>
  );
}
