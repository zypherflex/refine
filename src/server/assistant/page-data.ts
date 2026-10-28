import { db } from "@/lib/db";
import type { Actor } from "@/lib/permissions";

export async function assistantSidebar(actor: Actor, companyId: string) {
  const [conversations, docs] = await Promise.all([
    db.conversation.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.document.findMany({
      where: { OR: [{ visibility: "PRIVATE", ownerId: actor.id, pageCount: { gt: 0 } }, { visibility: "PUBLIC", status: "APPROVED", companyId }] },
      select: { id: true, title: true, visibility: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { conversations, documents: docs.map((d) => ({ id: d.id, title: d.title, private: d.visibility === "PRIVATE" })) };
}
