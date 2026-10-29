"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireUser } from "@/server/auth";
import { redirect } from "next/navigation";
import { deleteScenario, removeBoardItem, saveBoardItem, saveProfile, saveScenario, setReadiness } from "@/server/opportunities/board";
import { AppError } from "@/lib/errors";

export type ActionState = { error?: string | null; ok?: string | null };

function message(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => `${i.path.join(".") || "Input"}: ${i.message}`).join(" ");
  if (e instanceof AppError) return e.message;
  throw e;
}

export async function saveBoardAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const slug = String(form.get("slug") ?? "");
  try {
    await saveBoardItem(user, { slug, stage: String(form.get("stage") ?? "EXPLORING") as never, notes: String(form.get("notes") ?? ""), nextStep: String(form.get("nextStep") ?? "") });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/opportunities", "layout");
  return { ok: "Saved to your opportunity board." };
}

export async function removeBoardAction(form: FormData) {
  const user = await requireUser();
  await removeBoardItem(user, String(form.get("slug") ?? ""));
  revalidatePath("/opportunities", "layout");
}

export async function saveScenarioAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let inputs: unknown;
  try {
    inputs = JSON.parse(String(form.get("inputs") ?? "{}"));
  } catch {
    return { error: "The values could not be read. Reload and try again." };
  }
  try {
    await saveScenario(user, {
      calculatorId: String(form.get("calculatorId") ?? ""),
      opportunitySlug: String(form.get("opportunitySlug") ?? "") || null,
      name: String(form.get("name") ?? ""),
      inputs: inputs as Record<string, number | null>,
    });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/opportunities", "layout");
  return { ok: "Scenario saved. It is private to you." };
}

export async function deleteScenarioAction(form: FormData) {
  const user = await requireUser();
  try {
    await deleteScenario(user, String(form.get("id") ?? ""));
  } catch (e) {
    message(e);
  }
  revalidatePath("/opportunities", "layout");
}

export async function toggleReadinessAction(form: FormData) {
  const user = await requireUser();
  try {
    await setReadiness(user, String(form.get("slug") ?? ""), String(form.get("question") ?? ""), form.get("done") === "1");
  } catch (e) {
    message(e);
  }
  revalidatePath("/opportunities", "layout");
}

export async function saveProfileAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await saveProfile(user, { scale: String(form.get("scale") ?? ""), segments: form.getAll("segments").map(String), assets: form.getAll("assets").map(String) });
  } catch (e) {
    if (e instanceof ZodError) return { error: "Choose the size of your business." };
    return { error: message(e) };
  }
  revalidatePath("/opportunities", "layout");
  redirect("/opportunities?fit=1#for-you");
}
