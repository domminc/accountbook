"use client";

import { useActionState, useState } from "react";
import { primaryButtonClass, smallButtonClass, smallInputClass } from "@/components/ui";
import { createInvite, type InviteState } from "./actions";

export function InviteButton() {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvite, {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <button type="submit" disabled={pending} className={`w-full ${primaryButtonClass}`}>
          {pending ? "만드는 중…" : "초대 링크 만들기"}
        </button>
      </form>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.link ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">이 링크를 배우자에게 보내 주세요. 7일 동안 한 번 쓸 수 있어요. 이 화면을 벗어나면 다시 볼 수 없어요.</p>
          <div className="flex gap-2">
            <input readOnly value={state.link} aria-label="초대 링크" onFocus={(e) => e.target.select()} className={smallInputClass} />
            <button
              type="button"
              className={smallButtonClass}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(state.link!);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
