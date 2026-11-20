import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import InfluencerProfileClient from "@/components/InfluencerProfileClient";
import { loadSeoProfileById } from "@/lib/loadSeoProfile";
import { creatorReviewsJsonLd } from "@/lib/loadPublicReviewsJsonLd";
import JsonLdScript from "@/components/JsonLdScript";
import RelatedCreatorsServer from "@/components/RelatedCreatorsServer";
import { breadcrumbJsonLd } from "@/lib/breadcrumbJsonLd";
import { profileJsonLd, profileMetadata, profileCanonical } from "@/lib/profileSeo";
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
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Αρχική", path: "/" },
    { name: "Κατάλογος Δημιουργών", path: "/directory" },
    { name: profile.view.name || "Creator", path },
  ]);
  const reviewsLd = await creatorReviewsJsonLd(
    profile.id,
    profile.view.name || "Creator",
    profileCanonical(profile.view)
  );
  return (
    <>
      <JsonLdScript data={breadcrumbLd} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {reviewsLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewsLd).replace(/</g, "\\u003c") }}
        />
      ) : null}
      <InfluencerProfileClient
        params={Promise.resolve({ id: profile.id })}
        initialProfile={profile.view}
        publicPath={path}
      />
      <RelatedCreatorsServer
        influencerId={profile.id}
        categories={profile.view.categories}
        accounts={profile.view.accounts}
      />
    </>
  );
}
