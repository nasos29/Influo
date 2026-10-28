export default function SectionHeading({
  title,
  description,
  align = "center",
}: {
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <div className={`mb-10 md:mb-14 max-w-2xl ${alignClass}`}>
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mb-3">
        {title}
      </h2>
      {description ? (
        <p className="text-slate-600 leading-relaxed text-base md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}
