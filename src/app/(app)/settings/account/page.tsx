import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { cardClass, smallButtonClass, smallInputClass } from "@/components/ui";
import { changePassword, deletePasskey } from "./actions";
import { PasskeyRegister } from "./passkey-register";

const date = (d: Date) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(d);

export default async function AccountPage() {
  const m = await requireHousehold();
  const { loginId, passkeys } = await withUser(m.userId, async (tx) => {
    const [me] = await tx<{ login_id: string | null }[]>`select login_id from public.users where id = ${m.userId}`;
    const passkeys = await tx<{ id: string; name: string; created_at: Date; last_used_at: Date | null }[]>`
      select id, name, created_at, last_used_at from public.passkeys where user_id = ${m.userId} order by created_at
    `;
    return { loginId: me?.login_id ?? null, passkeys };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="text-sm text-muted">
          ← 설정
        </Link>
        <h1 className="mt-2 text-xl font-bold">계정·보안</h1>
        {loginId ? <p className="mt-1 text-sm text-muted">아이디 {loginId}</p> : null}
      </div>

      <section className={`p-4 ${cardClass}`}>
        <h2 className="font-semibold">Face ID·지문 로그인</h2>
        <p className="mb-3 text-xs text-muted">
          기기에 등록하면 아이디·비밀번호 없이 Face ID·지문(또는 화면 잠금)으로 로그인해요. 생체 정보는 기기 밖으로 나오지 않고, 가계부에는
          기기가 만든 공개 키만 저장해요.
        </p>
        <PasskeyRegister />
        {passkeys.length > 0 ? (
          <ul className="mt-4 divide-y divide-border">
            {passkeys.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{p.name}</span>
                  <span className="block text-xs text-muted">
                    {date(p.created_at)} 등록{p.last_used_at ? ` · ${date(p.last_used_at)} 마지막 사용` : ""}
                  </span>
                </span>
                <ActionForm action={deletePasskey.bind(null, p.id)}>
                  <SubmitButton className="px-2 text-danger" confirmMessage={`${p.name} 등록을 지울까요? 그 기기에서는 다시 아이디로 로그인해야 해요.`}>
                    삭제
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={`p-4 ${cardClass}`}>
        <h2 className="font-semibold">비밀번호 바꾸기</h2>
        <ActionForm action={changePassword} resetOnSuccess className="mt-2 flex flex-col gap-2">
          <input type="text" name="username" value={loginId ?? ""} autoComplete="username" readOnly hidden />
          <input name="current" type="password" required autoComplete="current-password" placeholder="지금 비밀번호" aria-label="지금 비밀번호" className={smallInputClass} />
          <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="새 비밀번호 (8자 이상)" aria-label="새 비밀번호" className={smallInputClass} />
          <input name="passwordConfirm" type="password" required autoComplete="new-password" placeholder="새 비밀번호 확인" aria-label="새 비밀번호 확인" className={smallInputClass} />
          <SubmitButton className={`self-start ${smallButtonClass}`}>비밀번호 바꾸기</SubmitButton>
        </ActionForm>
      </section>

      <section className={`p-4 ${cardClass}`}>
        <h2 className="font-semibold">회원 탈퇴</h2>
        <p className="mt-1 text-sm text-muted">계정을 지워요. 혼자 쓰는 가계부면 가계부 데이터도 모두 지워져요.</p>
        <Link href="/account/delete" className="mt-2 inline-block text-sm text-danger underline underline-offset-4">
          탈퇴하기
        </Link>
      </section>
    </div>
  );
}
