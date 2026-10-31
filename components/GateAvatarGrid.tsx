"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getCachedImageUrl, getStorageCardUrl } from "@/lib/imageProxy";
import { GATE_AVATAR_FETCH } from "@/lib/gateAvatars";

const TILES = [
  "from-indigo-100 to-violet-100",
  "from-blue-100 to-indigo-100",
  "from-violet-100 to-fuchsia-100",
  "from-sky-100 to-blue-100",
  "from-purple-100 to-indigo-50",
  "from-blue-50 to-violet-100",
  "from-indigo-50 to-sky-100",
  "from-fuchsia-100 to-purple-100",
];

let rememberedAvatars: string[] | null = null;
let avatarsRequest: Promise<string[]> | null = null;

function fetchGateAvatars(): Promise<string[]> {
  if (rememberedAvatars) return Promise.resolve(rememberedAvatars);
  if (avatarsRequest) return avatarsRequest;
  const request = fetch("/api/influencers/gate-avatars", GATE_AVATAR_FETCH)
    .then(async (response) => {
      const body = await response.json().catch(() => ({}));
      const urls = Array.isArray(body.avatars)
        ? body.avatars
            .filter((url: unknown): url is string => typeof url === "string" && url.startsWith("http"))
            .slice(0, 8)
        : [];
      rememberedAvatars = urls;
      return urls;
    })
    .catch(() => [] as string[])
    .finally(() => {
      avatarsRequest = null;
    });
  avatarsRequest = request;
  return request;
}

function GateAvatarTile({ src, tone }: { src?: string; tone: string }) {
  const [failed, setFailed] = useState(false);
  const sized = src ? getStorageCardUrl(src, 128, 128) : null;
  const display = sized ? (getCachedImageUrl(sized) ?? sized) : null;
  const show = !!display && !failed;
  return (
    <div className={`relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br ${tone}`}>
      {show ? (
        <Image
          src={display}
          alt=""
          fill
          sizes="96px"
          quality={70}
          unoptimized
          loading="lazy"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}

/** Eight creator faces. Loads only while `active` (the popup is open). */
export default function GateAvatarGrid({ active }: { active: boolean }) {
  const [avatars, setAvatars] = useState<string[] | null>(rememberedAvatars);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void fetchGateAvatars().then((urls) => {
      if (!cancelled) setAvatars(urls);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return (
    <div className="mt-5 grid grid-cols-4 gap-2.5" aria-hidden>
      {TILES.map((tone, index) => (
        <GateAvatarTile key={tone} tone={tone} src={avatars?.[index]} />
      ))}
    </div>
  );
}
