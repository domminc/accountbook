"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { inputClass, primaryButtonClass } from "@/components/ui";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(login, {});

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm font-medium">아이디</span>
        <input
          name="loginId"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">비밀번호</span>
        <input name="password" type="password" required autoComplete="current-password" className={`mt-1 ${inputClass}`} />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={`mt-2 ${primaryButtonClass}`}>
        {pending ? "로그인 중…" : "로그인"}
      </button>
      <Link href="/signup" className="text-center text-sm text-muted underline underline-offset-4">
        처음이신가요? 아이디 만들기
      </Link>
    </form>
  );
}
