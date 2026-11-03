"use client";
import { useEffect, useState } from "react";
import { sessionFetch } from "@/lib/sessionFetch";

type Preview = { url: string; host: string; title?: string; description?: string; image?: string };
const mem = new Map<string, Promise<Preview | null>>();

function load(url: string) {
  let p = mem.get(url);
  if (!p) {
    p = sessionFetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Preview>) : null))
      .catch(() => null);
    mem.set(url, p);
  }
  return p;
}

export default function LinkPreview({ url, own }: { url: string; own: boolean }) {
  const [data, setData] = useState<Preview | null>(null);
  useEffect(() => {
    let alive = true;
    void load(url).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [url]);
  if (!data?.title) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`mt-1.5 block overflow-hidden rounded-xl border ${own ? "border-white/25 bg-white/10" : "border-slate-200 bg-slate-50"}`}>
      {data.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.image} alt="" loading="lazy" className="max-h-36 w-full object-cover" onError={(e) => ((e.currentTarget.style.display = "none"))} />
      ) : null}
      <span className="block px-2.5 py-1.5">
        <span className={`block text-[10px] uppercase tracking-wide ${own ? "text-blue-100" : "text-slate-400"}`}>{data.host}</span>
        <span className="block text-xs font-semibold line-clamp-2">{data.title}</span>
        {data.description ? <span className={`block text-[11px] line-clamp-2 ${own ? "text-blue-50" : "text-slate-500"}`}>{data.description}</span> : null}
      </span>
    </a>
  );
}
