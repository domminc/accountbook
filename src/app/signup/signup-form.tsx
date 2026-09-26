"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { inputClass, primaryButtonClass } from "@/components/ui";
import { signup } from "./actions";
import { BrandMark } from "@/components/brand-mark";

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(signup, {});

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-7 shadow-card sm:p-8">
        <BrandMark />
        <h1 className="text-2xl font-bold tracking-tight">아이디 만들기</h1>
        <form action={action} className="mt-8 flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="text-sm font-medium">아이디</span>
            <span className="block text-xs text-muted">영문 소문자·숫자·밑줄(_) 4~20자</span>
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
            <span className="block text-xs text-muted">8자 이상</span>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={`mt-1 ${inputClass}`} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">비밀번호 확인</span>
            <input name="passwordConfirm" type="password" required autoComplete="new-password" className={`mt-1 ${inputClass}`} />
          </label>

          {state.error ? (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          ) : null}

          <button type="submit" disabled={pending} className={`mt-2 ${primaryButtonClass}`}>
            {pending ? "만드는 중…" : "아이디 만들기"}
          </button>
          <Link
            href={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
            className="text-center text-sm text-muted underline underline-offset-4"
          >
            이미 아이디가 있어요
          </Link>
        </form>
      </div>
    </main>
  );
}
