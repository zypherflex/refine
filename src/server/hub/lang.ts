import { cookies } from "next/headers";
import { isLang, translator, type Lang } from "@/lib/i18n/hub";

export const LANG_COOKIE = "rl_lang";

/** The trade hub language chosen by this browser (English by default). */
export async function hubLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "en";
}

export async function hubT() {
  const lang = await hubLang();
  return { lang, t: translator(lang) };
}
