import { requireUser } from "@/server/auth";
import { selectedCompany } from "@/server/services/companies";
import { thesisFormOptions } from "@/server/thesis-form";
import { ThesisEditor } from "@/components/ThesisForms";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "New thesis" };

export default async function NewThesis() {
  await requireUser();
  const [company, opts] = await Promise.all([selectedCompany(), thesisFormOptions()]);
  return (
    <>
      <PageHeader eyebrow="Your work" title="New investment thesis" subtitle="Private to you. You can revise it at any time; every save keeps the previous version." />
      <ThesisEditor
        companies={opts.companies}
        topics={opts.topics}
        metricOptions={opts.metricOptions}
        initial={{ companyId: company?.id ?? opts.companies[0]?.id ?? "", title: "", rationale: "", reassessmentConditions: "", reviewDate: "", assumptions: [{ statement: "", topics: [] }], indicators: [] }}
      />
    </>
  );
}
