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
  autoplayOnMount = true,
}: {
  media: HostedMedia;
  lang?: "el" | "en";
  posterFallback?: string | null;
  onError?: () => void;
  /** When false, video stays on poster until the user taps play (profile portfolio). */
  autoplayOnMount?: boolean;
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
      autoplayOnMount={autoplayOnMount}
    />
  );
}