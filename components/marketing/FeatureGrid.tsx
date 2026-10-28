import type { LucideIcon } from "lucide-react";
import SectionHeading from "@/components/marketing/SectionHeading";

export type FeatureItem = {
  title: string;
  desc: string;
  icon: LucideIcon;
};

const COL_CLASS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

export default function FeatureGrid({
  title,
  description,
  items,
  columns = 3,
}: {
  title: string;
  description?: string;
  items: FeatureItem[];
  columns?: 2 | 3 | 4;
}) {
  return (
    <>
      <SectionHeading title={title} description={description} />
      <div className={`grid gap-4 md:gap-5 ${COL_CLASS[columns]}`}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="group flex h-full flex-col rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm transition-colors hover:border-slate-300 md:p-6"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </div>
              <h3 className="mb-2 text-base font-semibold tracking-tight text-slate-900">
                {item.title}
              </h3>
              <p className="flex-1 text-sm leading-relaxed text-slate-600">{item.desc}</p>
            </article>
          );
        })}
      </div>
    </>
  );
}
