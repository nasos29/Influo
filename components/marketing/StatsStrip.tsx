export type StatItem = Readonly<{
  key: string;
  value: number;
  label: string;
}>;

type Props = Readonly<{ items: readonly StatItem[] }>;

export default function StatsStrip({ items }: Props) {
  if (!items.length) return null;

  return (
    <section className="border-b border-slate-100 bg-white px-4 py-10 sm:px-6 md:py-12">
      <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-6 md:gap-x-16">
        {items.map((item) => (
          <li key={item.key} className="min-w-0 text-center">
            <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums md:text-3xl">
              {item.value.toLocaleString("en-US")}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-600 md:text-base">{item.label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
