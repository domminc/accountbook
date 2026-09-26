"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string };

export async function createHousehold(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const householdName = String(formData.get("householdName") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (householdName.length < 1 || householdName.length > 50) {
    return { error: "가계부 이름은 1~50자로 입력해 주세요." };
  }
  if (displayName.length < 1 || displayName.length > 30) {
    return { error: "내 이름은 1~30자로 입력해 주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", {
    household_name: householdName,
    member_name: displayName,
  });

  // 이미 가계부가 있으면(다른 탭에서 먼저 만든 경우 등) 그대로 홈으로 보낸다
  if (error && error.code !== "23505") {
    return { error: "가계부를 만들지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  redirect("/");
}
