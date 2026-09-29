"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect } from "react";
import { DELETING_KEY } from "@/lib/offline-queue";
import { dangerButtonClass, inputClass } from "@/components/ui";
import { deleteAccount, type DeleteAccountState } from "./actions";

export function DeleteAccountForm({ userId, loginId }: { userId: string; loginId: string | null }) {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(deleteAccount, {});

  // 탈퇴하면 로그인 화면(ForgetDeletedUser)이 이 기기에 남은 오프라인 입력 대기열을 지운다. 실패하면 표시를 거둔다.
  useEffect(() => {
    if (state.error) sessionStorageSafe((s) => s.removeItem(DELETING_KEY));
  }, [state]);

  return (
    <form
      // form action 대신 직접 보내서, 비밀번호가 틀려도 체크·입력이 초기화되지 않게 한다
      onSubmit={(e) => {
        e.preventDefault();
        if (!window.confirm("정말 탈퇴할까요? 되돌릴 수 없어요.")) return;
        sessionStorageSafe((s) => s.setItem(DELETING_KEY, userId));
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="mt-6 flex flex-col gap-4"
    >
      <input type="text" name="username" value={loginId ?? ""} autoComplete="username" readOnly hidden />
      <label className="block">
        <span className="text-sm font-medium">비밀번호 확인</span>
        <input name="password" type="password" required autoComplete="current-password" className={`mt-1 ${inputClass}`} />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" value="yes" required className="mt-0.5 size-4 accent-danger" />
        <span>위 내용을 확인했고, 지운 데이터는 되돌릴 수 없다는 것을 알아요.</span>
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={dangerButtonClass}>
        {pending ? "탈퇴하는 중…" : "탈퇴하기"}
      </button>
      <Link href="/settings/account" className="text-center text-sm text-muted underline underline-offset-4">
        취소
      </Link>
    </form>
  );
}

function sessionStorageSafe(fn: (s: Storage) => void) {
  try {
    fn(sessionStorage);
  } catch {}
}
