import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { getMembership } from "@/lib/household";
import { OnboardingForm } from "./onboarding-form";
import { BrandMark } from "@/components/brand-mark";

export default async function OnboardingPage() {
  const userId = await requireUserId();
  if (await getMembership(userId)) redirect("/");
  // 다른 기기에서 탈퇴한 계정의 로그인이 남아 있는 경우
  const [me] = await withUser(userId, (tx) => tx`select 1 from public.users where id = ${userId}`);
  if (!me) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-3xl bg-surface p-7 shadow-card sm:p-8">
          <BrandMark />
          <h1 className="text-2xl font-bold tracking-tight">탈퇴한 계정이에요</h1>
          <p className="mt-2 text-muted">이 계정은 지워졌어요. 로그아웃한 뒤 다른 아이디로 로그인하거나 새로 만들어 주세요.</p>
          <form action="/logout" method="post" className="mt-6">
            <button type="submit" className="text-sm text-muted underline underline-offset-4">
              로그아웃
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-7 shadow-card sm:p-8">
        <BrandMark />
        <h1 className="text-2xl font-bold tracking-tight">가계부 만들기</h1>
        <p className="mt-2 text-muted">
          기본 카테고리(수입·저축·고정지출·식비 등)와 지출방법이 함께 만들어져요. 나중에 설정에서 바꿀 수 있어요.
        </p>
        <OnboardingForm defaultDisplayName="" />
        <p className="mt-6 text-center text-sm text-muted">배우자에게 초대 링크를 받았다면, 새로 만들지 말고 그 링크를 열어 주세요.</p>
        <p className="mt-4 text-center text-xs text-muted">
          <Link href="/account/delete" className="underline underline-offset-4">
            회원 탈퇴
          </Link>
          {" · "}
          <Link href="/privacy" className="underline underline-offset-4">
            개인정보처리방침
          </Link>
        </p>
      </div>
    </main>
  );
}
