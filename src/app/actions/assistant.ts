"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { askInConversation } from "@/server/assistant/engine";
import { rateLimit } from "@/server/rate-limit";
import { db } from "@/lib/db";
import { canAccessDocument } from "@/lib/permissions";

export type AskState = { error?: string | null };

export async function askAction(_: AskState, form: FormData): Promise<AskState> {
  const user = await requireUser();
  const question = String(form.get("question") ?? "").trim();
  const companyId = String(form.get("companyId") ?? "");
  const conversationId = String(form.get("conversationId") ?? "") || undefined;
  const documentId = String(form.get("documentId") ?? "") || undefined;
  if (question.length < 3) return { error: "Type a question." };
  if (question.length > 1000) return { error: "Keep questions under 1,000 characters." };
  if (!rateLimit(`ask:${user.id}`, 30, 60 * 60_000)) return { error: "You have reached the hourly question limit. Try again later." };
  if (!(await db.company.findUnique({ where: { id: companyId } }))) return { error: "Choose a company." };
  if (documentId) {
    const doc = await db.document.findUnique({ where: { id: documentId } });
    if (!doc || !canAccessDocument(user, doc)) return { error: "That document is not available." };
  }
  let id: string;
  try {
    id = (await askInConversation(user, { conversationId, companyId, question, documentId })).conversationId;
  } catch {
    return { error: "The assistant could not answer just now. Please try again." };
  }
  redirect(`/assistant/${id}#latest`);
}
