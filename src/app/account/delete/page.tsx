import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { BrandMark } from "@/components/brand-mark";
import { DeleteAccountForm } from "./delete-form";

export default async function DeleteAccountPage() {
  const userId = await requireUserId();
  const { me, household, others } = await withUser(userId, async (tx) => {
    const [me] = await tx<{ login_id: string | null }[]>`select login_id from public.users where id = ${userId}`;
    const [household] = await tx<{ id: string; name: string }[]>`
      select h.id, h.name from public.members m join public.households h on h.id = m.household_id where m.user_id = ${userId}
    `;
    const others = household
      ? await tx<{ display_name: string }[]>`
          select display_name from public.members where household_id = ${household.id} and user_id <> ${userId} order by created_at
        `
      : [];
    return { me, household, others };
  });

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-surface p-7 shadow-card sm:p-8">
        <BrandMark />
        <h1 className="text-2xl font-bold tracking-tight">회원 탈퇴</h1>
        {!me ? (
          <p className="mt-4 text-muted">이미 탈퇴한 계정이에요.</p>
        ) : (
          <>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
              <li>
                아이디 <b>{me.login_id}</b>와 이 계정의 Face ID·지문 로그인 등록, 문자 자동 입력 토큰을 지워요.
              </li>
              {!household ? null : others.length === 0 ? (
                <li>
                  <b>{household.name}</b>을(를) 혼자 쓰고 있어서, 가계부와 그 안의 거래·예산·자산·영수증 사진 등 <b>모든 데이터를 지워요</b>.
                </li>
              ) : (
                <li>
                  <b>{household.name}</b>은(는) {others.map((o) => o.display_name).join(", ")}님이 계속 써요. 내가 입력한 거래도 가계부에
                  남고, 입력자 표시만 사라져요.
                </li>
              )}
              <li>지운 데이터는 되돌릴 수 없어요.</li>
            </ul>
            {household ? (
              <p className="mt-4 rounded-lg bg-fill px-3 py-2 text-sm">
                필요하면 먼저{" "}
                <Link href="/settings/data" className="underline underline-offset-4">
                  설정 &gt; 데이터 가져오기·내보내기
                </Link>
                에서 CSV로 내려받아 두세요.
              </p>
            ) : null}
            <DeleteAccountForm userId={userId} loginId={me.login_id} />
          </>
        )}
      </div>
    </main>
  );
}
