import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { cardClass, smallButtonClass, smallInputClass } from "@/components/ui";
import { revokeInvite, updateDisplayName } from "./actions";
import { InviteButton } from "./invite-button";

const dateTime = (d: Date) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);

export default async function MembersPage() {
  const m = await requireHousehold();
  const { members, invites } = await withUser(m.userId, async (tx) => {
    const [members, invites] = await Promise.all([
      tx<{ user_id: string; display_name: string; role: "owner" | "member" }[]>`
        select user_id, display_name, role from public.members
        where household_id = ${m.householdId} order by created_at
      `,
      tx<{ id: string; created_at: Date; expires_at: Date }[]>`
        select id, created_at, expires_at from public.household_invites
        where household_id = ${m.householdId} and used_at is null and expires_at > now()
        order by created_at desc
      `,
    ]);
    return { members, invites };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="text-sm text-muted">
          ← 설정
        </Link>
        <h1 className="mt-2 text-xl font-bold">가계부 구성원</h1>
        <p className="mt-1 text-sm text-muted">{m.householdName}을(를) 함께 쓰는 사람이에요. 모두 같은 거래·예산을 보고 고칠 수 있어요.</p>
      </div>

      <ul className={`divide-y divide-border ${cardClass}`}>
        {members.map((mem) => (
          <li key={mem.user_id} className="flex items-center justify-between px-4 py-3">
            <span className="font-medium">
              {mem.display_name}
              {mem.user_id === m.userId ? <span className="ml-1.5 text-xs text-muted">나</span> : null}
            </span>
            <span className="text-xs text-muted">{mem.role === "owner" ? "만든 사람" : "구성원"}</span>
          </li>
        ))}
      </ul>

      <section className={`p-4 ${cardClass}`}>
        <h2 className="font-semibold">내 이름</h2>
        <p className="text-xs text-muted">거래 목록에 입력자로 보여요.</p>
        <ActionForm action={updateDisplayName} className="mt-2 flex gap-2">
          <input name="displayName" defaultValue={m.displayName} required maxLength={30} aria-label="내 이름" className={smallInputClass} />
          <SubmitButton className={smallButtonClass}>저장</SubmitButton>
        </ActionForm>
      </section>

      <section className={`p-4 ${cardClass}`}>
        <h2 className="font-semibold">초대하기</h2>
        <p className="mb-3 text-xs text-muted">받은 사람은 아이디를 만든 뒤 링크를 열면 이 가계부에 들어와요.</p>
        <InviteButton />
        {invites.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-medium">아직 쓰지 않은 초대</h3>
            <ul className="mt-1 divide-y divide-border">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted">
                    {dateTime(i.created_at)} 만듦 · {dateTime(i.expires_at)}까지
                  </span>
                  <ActionForm action={revokeInvite.bind(null, i.id)}>
                    <SubmitButton className="px-2 text-danger" confirmMessage="이 초대 링크를 취소할까요?">
                      취소
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
