import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { getMembership } from "@/lib/household";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { inputClass, primaryButtonClass } from "@/components/ui";
import { acceptInvite } from "./actions";

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const userId = await requireUserId();
  const [membership, [info]] = await Promise.all([
    getMembership(userId),
    withUser(userId, (tx) => tx<{ household_name: string; status: "valid" | "used" | "expired" }[]>`
      select household_name, status from public.invite_info(${token})
    `),
  ]);

  let body: React.ReactNode;
  if (!info) {
    body = <p className="mt-2 text-muted">초대 링크가 올바르지 않아요. 링크를 다시 받아 주세요.</p>;
  } else if (membership) {
    body = (
      <p className="mt-2 text-muted">
        이미 <b>{membership.householdName}</b>에 참여하고 있어요. 한 아이디는 가계부 하나만 쓸 수 있어요.
      </p>
    );
  } else if (info.status !== "valid") {
    body = <p className="mt-2 text-muted">{info.status === "used" ? "이미 사용한 초대 링크예요." : "기간이 지난 초대 링크예요."} 새 링크를 받아 주세요.</p>;
  } else {
    body = (
      <>
        <p className="mt-2 text-muted">
          <b className="text-foreground">{info.household_name}</b>에 초대받았어요. 참여하면 거래·예산을 함께 보고 입력할 수 있어요.
        </p>
        <ActionForm action={acceptInvite.bind(null, token)} className="mt-8 flex flex-col gap-4">
          <label className="block">
            <span className="text-sm font-medium">내 이름</span>
            <span className="block text-xs text-muted">거래를 누가 입력했는지 표시할 때 써요.</span>
            <input name="displayName" required maxLength={30} className={`mt-1 ${inputClass}`} />
          </label>
          <SubmitButton className={primaryButtonClass}>가계부 참여하기</SubmitButton>
        </ActionForm>
      </>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">가계부 초대</h1>
        {body}
        <Link href="/" className="mt-6 block text-center text-sm text-muted underline underline-offset-4">
          홈으로
        </Link>
      </div>
    </main>
  );
}
