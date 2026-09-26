import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getMembership } from "@/lib/household";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const userId = await requireUserId();
  if (await getMembership(userId)) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">가계부 만들기</h1>
        <p className="mt-2 text-muted">
          기본 카테고리(수입·저축·고정지출·식비 등)와 지출방법이 함께 만들어져요. 나중에 설정에서 바꿀 수 있어요.
        </p>
        <OnboardingForm defaultDisplayName="" />
        <p className="mt-6 text-center text-sm text-muted">배우자에게 초대 링크를 받았다면, 새로 만들지 말고 그 링크를 열어 주세요.</p>
      </div>
    </main>
  );
}
