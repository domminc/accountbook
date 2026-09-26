import { redirect } from "next/navigation";
import { createClient, getClaims } from "@/lib/supabase/server";
import { getMembership } from "@/lib/household";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");

  const supabase = await createClient();
  if (await getMembership(supabase, claims.sub)) redirect("/");

  // 구글은 name/full_name, 카카오는 nickname 등으로 이름을 준다
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const suggested = [meta.name, meta.full_name, meta.nickname, meta.preferred_username].find(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">가계부 만들기</h1>
        <p className="mt-2 text-muted">
          기본 카테고리(수입·저축·고정지출·식비 등)와 지출방법이 함께 만들어져요. 나중에 설정에서 바꿀 수 있어요.
        </p>
        <OnboardingForm defaultDisplayName={suggested?.trim().slice(0, 30) ?? ""} />
      </div>
    </main>
  );
}
