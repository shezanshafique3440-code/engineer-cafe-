export function TaskSteps({
  title,
  steps,
  current,
  tip,
  compact = false,
}: {
  title: string;
  steps: string[];
  current?: number;
  tip?: string;
  compact?: boolean;
}) {
  return (
    <section
      className={
        compact
          ? "rounded-2xl border border-chai-200 bg-chai-50 p-3"
          : "rounded-2xl border border-chai-200 bg-chai-50 p-4 sm:p-5"
      }
      aria-label="Kaam ka tareeqa"
    >
      <p className={compact ? "sr-only" : "font-bold text-charcoal-900"}>
        {title}
      </p>
      <ol
        className={
          compact ? "grid grid-cols-3 gap-2" : "mt-3 grid gap-3 sm:grid-cols-3"
        }
      >
        {steps.map((step, i) => (
          <li
            key={step}
            aria-current={current === i ? "step" : undefined}
            className={
              compact
                ? "flex items-center gap-1 text-xs sm:text-sm"
                : "flex items-start gap-2 text-sm"
            }
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold ${current === i ? "bg-chai-700 text-white" : "bg-white text-chai-800"}`}
            >
              {i + 1}
            </span>
            <span className="pt-1">{step}</span>
          </li>
        ))}
      </ol>
      {tip && (
        <details className="mt-3 text-sm text-charcoal-600">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            Madad / Zaroori baat
          </summary>
          <p className="pb-2">{tip}</p>
        </details>
      )}
    </section>
  );
}
