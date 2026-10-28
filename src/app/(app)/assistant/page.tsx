import { requireUser } from "@/server/auth";
import { selectedCompany } from "@/server/services/companies";
import { assistantSidebar } from "@/server/assistant/page-data";
import { AskForm } from "@/components/AskForm";
import { ConversationList } from "@/components/AssistantLayout";
import { EmptyState, Explainer, PageHeader } from "@/components/ui";

export const metadata = { title: "Research assistant" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string; document?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const company = await selectedCompany();
  if (!company) return <EmptyState title="No company selected" />;
  const { conversations, documents } = await assistantSidebar(user, company.id);
  return (
    <>
      <PageHeader eyebrow="Your work" title="Research assistant" subtitle={`Ask about ${company.name}. The assistant retrieves reviewed evidence first and cites the exact document, page or announcement behind every claim. It says so when the evidence is insufficient.`} />
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="space-y-4 lg:col-span-3">
          <AskForm companyId={company.id} documents={documents} initialQuestion={sp.q} initialDocument={sp.document} />
          <Explainer title="How the assistant works and what it will not do">
            <p>It searches only published announcements, reviewed figures, approved documents, and your own private files and theses. Other users' files and theses are never searched.</p>
            <p>Text inside documents and web pages is treated as data, never as instructions. Calculations are done by RefineryLens and show their formula and inputs.</p>
            <p>It will not invent figures or citations, guess private operating data, promise returns or tell you to buy or sell.</p>
          </Explainer>
        </div>
        <ConversationList conversations={conversations} />
      </div>
    </>
  );
}
