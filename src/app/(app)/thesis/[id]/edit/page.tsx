import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getThesis } from "@/server/services/thesis";
import { thesisFormOptions } from "@/server/thesis-form";
import { ThesisEditor } from "@/components/ThesisForms";
import { PageHeader } from "@/components/ui";

export default async function EditThesis({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const t = await getThesis(user, id).catch(() => null);
  if (!t) notFound();
  const opts = await thesisFormOptions();
  return (
    <>
      <PageHeader eyebrow="Your work" title={`Edit: ${t.title}`} subtitle={`Saving creates version ${t.version + 1}. Earlier versions stay in your history.`} />
      <ThesisEditor
        companies={opts.companies}
        topics={opts.topics}
        metricOptions={opts.metricOptions}
        initial={{
          id: t.id,
          companyId: t.companyId,
          title: t.title,
          rationale: t.rationale,
          reassessmentConditions: t.reassessmentConditions,
          reviewDate: t.reviewDate ? t.reviewDate.toISOString().slice(0, 10) : "",
          assumptions: t.assumptions.map((a) => ({ statement: a.statement, topics: a.topics })),
          indicators: t.indicators.map((i) => ({ metricKey: i.metricKey, label: i.label, operator: i.operator as "BELOW" | "ABOVE", threshold: i.threshold === null ? null : Number(i.threshold), unit: i.unit })),
        }}
      />
    </>
  );
}
