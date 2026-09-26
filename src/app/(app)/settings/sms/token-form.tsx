"use client";

import { useActionState, useSyncExternalStore } from "react";
import { primaryButtonClass, smallInputClass } from "@/components/ui";
import { createInboundToken, type TokenState } from "./actions";

const noop = () => () => {};

/** 기기 등록: 토큰은 만든 직후 한 번만 보여준다 */
export function TokenForm() {
  const [state, action, pending] = useActionState<TokenState, FormData>(createInboundToken, {});
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex gap-2">
        <input name="name" required maxLength={30} placeholder="예: 민수 아이폰" aria-label="기기 이름" className={smallInputClass} />
        <button type="submit" disabled={pending} className={`h-10 shrink-0 px-4 text-sm ${primaryButtonClass}`}>
          토큰 만들기
        </button>
      </form>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.token ? (
        <div role="status" className="rounded-xl border border-accent bg-background p-3 text-sm">
          <p className="font-medium">{state.name} 토큰을 만들었어요. 이 화면을 나가면 다시 볼 수 없으니 지금 자동화에 넣으세요.</p>
          <label className="mt-2 block text-xs text-muted" htmlFor="sms-url">
            주소 (POST)
          </label>
          <input id="sms-url" readOnly value={`${origin}/api/sms`} className={`mt-0.5 font-mono ${smallInputClass}`} onFocus={(e) => e.target.select()} />
          <label className="mt-2 block text-xs text-muted" htmlFor="sms-auth">
            헤더 Authorization 값
          </label>
          <input
            id="sms-auth"
            readOnly
            value={`Bearer ${state.token}`}
            className={`mt-0.5 font-mono ${smallInputClass}`}
            onFocus={(e) => e.target.select()}
          />
        </div>
      ) : null}
    </div>
  );
}
