import type { ReactNode } from "react";

type Tone = "white" | "slate";

type Props = Readonly<{
  tone?: Tone;
  children: ReactNode;
  className?: string;
}>;

export default function MarketingSection({
  tone = "white",
  children,
  className = "",
}: Props) {
  const bg = tone === "slate" ? "bg-slate-50" : "bg-white";
  return (
    <section
      className={`border-b border-slate-100 px-4 py-16 sm:px-6 md:py-24 ${bg} ${className}`}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}
