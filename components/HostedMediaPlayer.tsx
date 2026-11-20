"use client";

import HostedPhotoPlayer from "@/components/HostedPhotoPlayer";
import HostedVideoPlayer from "@/components/HostedVideoPlayer";
import type { HostedMedia } from "@/lib/creatorMedia";
import { isHostedPhotoMedia } from "@/lib/hostedMediaRender";

export default function HostedMediaPlayer({
  media,
  lang = "el",
  posterFallback,
  onError,
}: {
  media: HostedMedia;
  lang?: "el" | "en";
  posterFallback?: string | null;
  onError?: () => void;
}) {
  if (isHostedPhotoMedia(media)) {
    return <HostedPhotoPlayer media={media} lang={lang} />;
  }
  return (
    <HostedVideoPlayer
      media={media}
      lang={lang}
      posterFallback={posterFallback}
      onError={onError}
    />
  );
}