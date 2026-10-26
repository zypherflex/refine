import { toggleReadinessAction } from "@/app/actions/opportunities";

/** Readiness questions as tickable items. Each tick is a small form, so it works without JavaScript. */
export function Readiness({ slug, questions, checked }: { slug: string; questions: string[]; checked: string[] }) {
  const done = questions.filter((q) => checked.includes(q)).length;
  const pct = questions.length ? Math.round((done / questions.length) * 100) : 0;
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Readiness">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
        </div>
        <span className="num text-xs font-medium text-ink-700">{done} of {questions.length} answered</span>
      </div>
      <ul className="mt-3 space-y-2">
        {questions.map((q) => {
          const on = checked.includes(q);
          return (
            <li key={q}>
              <form action={toggleReadinessAction} className="flex items-start gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="question" value={q} />
                <input type="hidden" name="done" value={on ? "0" : "1"} />
                <button aria-pressed={on} aria-label={`${on ? "Untick" : "Tick"}: ${q}`} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-xs ${on ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 bg-white text-transparent hover:border-brand-600"}`}>✓</button>
                <span className={`text-sm ${on ? "text-ink-500 line-through decoration-1" : "text-ink-900"}`}>{q}</span>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
