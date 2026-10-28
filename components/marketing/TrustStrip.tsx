import { CheckCircle2 } from "lucide-react";

export default function TrustStrip({ items }: { items: string[] }) {
  if (!items.length) return null;

  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {items.map((text) => (
        <li
          key={text}
          className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm"
        >
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-blue-600"
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="text-sm font-semibold leading-snug text-slate-900 md:text-base">
            {text}
          </span>
        </li>
      ))}
    </ul>
  );
}
