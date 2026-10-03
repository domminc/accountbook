"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { THEME_COOKIE, THEMES, type Theme } from "@/lib/theme";

/** 화면 테마를 이 기기에 기억한다 (1년) */
export async function setTheme(formData: FormData): Promise<void> {
  const value = String(formData.get("theme") ?? "");
  if (!THEMES.includes(value as Theme)) return;
  (await cookies()).set(THEME_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
