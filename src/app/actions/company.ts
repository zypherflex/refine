"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { COMPANY_COOKIE } from "@/server/services/companies";

export async function selectCompanyAction(form: FormData) {
  const slug = String(form.get("company") ?? "");
  const back = String(form.get("back") ?? "/dashboard");
  const company = await db.company.findUnique({ where: { slug } });
  if (company) (await cookies()).set(COMPANY_COOKIE, company.slug, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(back.startsWith("/") && !back.startsWith("//") ? back.split("?")[0] : "/dashboard");
}
