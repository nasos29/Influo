import SectionHeading from "@/components/marketing/SectionHeading";

export type HowStep = Readonly<{
  title: string;
  desc: string;
}>;

type Props = Readonly<{
  title: string;
  description?: string;
  steps: readonly HowStep[];
}>;

function stepGridClass(count: number): string {
  if (count >= 4) return "sm:grid-cols-2 lg:grid-cols-4";
  if (count === 3) return "md:grid-cols-3";
  return "sm:grid-cols-2";
}

export default function HowSteps({ title, description, steps }: Props) {
  return (
    <>
      <SectionHeading title={title} description={description} />
      <ol className={`grid gap-6 md:gap-8 ${stepGridClass(steps.length)}`}>
        {steps.map((step, index) => (
          <li key={step.title}>
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {index + 1}
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">{step.title}</h3>
            <p className="text-sm leading-relaxed text-slate-600">{step.desc}</p>
          </li>
        ))}
      </ol>
    </>
  );
}
