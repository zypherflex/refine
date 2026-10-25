import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { readDocumentFile } from "@/server/services/documents";

/** Every download is authorised server-side; private files are only ever returned to their owner. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Not found", { status: 404 });
  try {
    const { doc, data } = await readDocumentFile(user, id);
    const filename = (doc.originalName || "document").replace(/[^\w.\- ]/g, "_");
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
