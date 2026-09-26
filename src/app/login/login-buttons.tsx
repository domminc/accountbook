"use client";

import { useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const PROVIDERS: { id: Provider; label: string; className: string }[] = [
  {
    id: "kakao",
    label: "카카오로 계속하기",
    // 카카오 로그인 버튼 가이드: 배경 #FEE500, 글자 검정 85%
    className: "bg-[#FEE500] text-black/85 hover:brightness-95",
  },
  {
    id: "google",
    label: "구글로 계속하기",
    className: "border border-border bg-surface text-foreground hover:bg-background",
  },
];

export function LoginButtons({ next }: { next: string }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState(false);

  async function signIn(provider: Provider) {
    setPending(provider);
    setError(false);
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);

    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo.toString() },
    });
    // 성공하면 브라우저가 제공자 로그인 화면으로 이동한다
    if (error) {
      setPending(null);
      setError(true);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => signIn(p.id)}
          disabled={pending !== null}
          className={`h-12 rounded-xl text-base font-semibold transition disabled:opacity-60 ${p.className}`}
        >
          {pending === p.id ? "이동 중…" : p.label}
        </button>
      ))}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          로그인 화면을 열지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}
    </div>
  );
}
