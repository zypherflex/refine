import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { selectedCompany } from "@/server/services/companies";
import { assistantSidebar } from "@/server/assistant/page-data";
import type { StructuredAnswer } from "@/server/assistant/types";
import { AskForm } from "@/components/AskForm";
import { AnswerView } from "@/components/AnswerView";
import { ConversationList } from "@/components/AssistantLayout";
import { PageHeader } from "@/components/ui";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const convo = await db.conversation.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  // Conversations are private: someone else's conversation is simply not found.
  if (!convo || convo.userId !== user.id) notFound();
  const company = (convo.companyId && (await db.company.findUnique({ where: { id: convo.companyId } }))) || (await selectedCompany());
  const { conversations, documents } = await assistantSidebar(user, company!.id);
  return (
    <>
      <PageHeader eyebrow="Your work" title="Research assistant" subtitle={`Conversation about ${company!.name}`} />
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="space-y-4 lg:col-span-3">
          {convo.messages.map((m, i) => (
            <div key={m.id} id={i === convo.messages.length - 1 ? "latest" : undefined} className={m.role === "user" ? "rounded-lg bg-ink-900 px-4 py-3 text-white" : "card"}>
              {m.role === "user" ? <p><span className="sr-only">You asked: </span>{m.content}</p> : m.structured ? <AnswerView a={m.structured as unknown as StructuredAnswer} /> : <p>{m.content}</p>}
            </div>
          ))}
          <AskForm companyId={company!.id} conversationId={convo.id} documents={documents} />
        </div>
        <ConversationList conversations={conversations} current={convo.id} />
      </div>
    </>
  );
}
