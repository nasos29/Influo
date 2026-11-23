"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Crawlable internal links on every blog post (Greek + English). */
export default function BlogPostResourceLinks() {
  const pathname = usePathname();
  const en = pathname?.startsWith("/en");

  return (
    <aside className="max-w-4xl mx-auto px-4 sm:px-6 pb-10">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-5 text-sm text-slate-700">
        <p className="font-semibold text-slate-900 mb-2">
          {en ? "Explore Influo" : "Εξερεύνησε το Influo"}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <Link href={en ? "/en/directory" : "/directory"} className="text-blue-600 hover:underline">
              {en ? "Influencer directory" : "Κατάλογος δημιουργών"}
            </Link>
          </li>
          <li>
            <Link href={en ? "/en/for-influencers" : "/for-influencers"} className="text-blue-600 hover:underline">
              {en ? "Sign up as a creator" : "Εγγραφή creator"}
            </Link>
          </li>
          <li>
            <Link href={en ? "/en/for-brands" : "/for-brands"} className="text-blue-600 hover:underline">
              {en ? "Brands: publish campaigns" : "Για brands: καμπάνιες"}
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  );
}