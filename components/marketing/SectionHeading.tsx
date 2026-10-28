type Props = Readonly<{
  title: string;
  description?: string;
  align?: "center" | "left";
}>;

export default function SectionHeading({
  title,
  description,
  align = "center",
}: Props) {
  const alignClass = align === "center" ? "mx-auto text-center" : "text-left";
  return (
    <div className={`mb-10 max-w-2xl md:mb-14 ${alignClass}`}>
      <h2 className="mb-3 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="text-base leading-relaxed text-slate-600 md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}
