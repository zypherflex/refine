"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "@/server/auth";
import { addUserEvidence, createThesis, deleteThesis, reviewSuggestion, updateThesis, type ThesisInput } from "@/server/services/thesis";
import { AppError } from "@/lib/errors";

export type ActionState = { error?: string | null; ok?: string | null };

function message(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => `${i.path.join(".") || "Input"}: ${i.message}`).join(" ");
  if (e instanceof AppError) return e.message;
  throw e;
}

export async function saveThesisAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  let payload: ThesisInput;
  try {
    payload = JSON.parse(String(form.get("payload") ?? "{}"));
  } catch {
    return { error: "The form could not be read. Reload and try again." };
  }
  let targetId = id;
  try {
    if (id) await updateThesis(user, id, payload);
    else targetId = (await createThesis(user, payload)).id;
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/thesis");
  redirect(`/thesis/${targetId}?saved=1`);
}

export async function reviewSuggestionAction(form: FormData) {
  const user = await requireUser();
  const decision = String(form.get("decision")) as "SUPPORTS" | "CHALLENGES" | "UNCLEAR" | "DISMISS";
  if (!["SUPPORTS", "CHALLENGES", "UNCLEAR", "DISMISS"].includes(decision)) return;
  await reviewSuggestion(user, String(form.get("evidenceId")), decision, String(form.get("note") ?? "").slice(0, 1000));
  revalidatePath(`/thesis/${form.get("thesisId")}`);
}

export async function linkEvidenceAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const [thesisId, assumptionId] = String(form.get("target") ?? "").split(":");
  try {
    await addUserEvidence(user, thesisId, {
      assumptionId: assumptionId || null,
      announcementId: String(form.get("announcementId") ?? "") || null,
      stance: ["SUPPORTS", "CHALLENGES", "UNCLEAR"].includes(String(form.get("stance"))) ? String(form.get("stance")) : "UNCLEAR",
      note: String(form.get("note") ?? "").slice(0, 1000),
    });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/thesis/${thesisId}`);
  return { ok: "Added to your thesis as evidence. Your assumptions were not changed." };
}

export async function deleteThesisAction(form: FormData) {
  const user = await requireUser();
  await deleteThesis(user, String(form.get("id")));
  redirect("/thesis");
}
