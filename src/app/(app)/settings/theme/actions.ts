"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DESIGN_COOKIE, DESIGNS, THEME_COOKIE, THEMES, type Design, type Theme } from "@/lib/theme";

const YEAR = 60 * 60 * 24 * 365;

/** 화면 밝기·디자인을 이 기기에 기억한다 (1년) */
export async function setTheme(formData: FormData): Promise<void> {
  const jar = await cookies();
  const theme = String(formData.get("theme") ?? "");
  const design = String(formData.get("design") ?? "");
  if (THEMES.includes(theme as Theme)) jar.set(THEME_COOKIE, theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
  if (DESIGNS.includes(design as Design)) jar.set(DESIGN_COOKIE, design, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}
