"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { inputClass as baseInputClass, primaryButtonClass } from "@/components/ui";
import { createHousehold } from "./actions";

const inputClass = `mt-1 ${baseInputClass}`;

export function OnboardingForm({ defaultDisplayName }: { defaultDisplayName: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createHousehold, {});

  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <label className="block">
        <span className="text-sm font-medium">가계부 이름</span>
        <input name="householdName" required maxLength={50} defaultValue="우리집 가계부" className={inputClass} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">내 이름</span>
        <span className="block text-xs text-muted">거래를 누가 입력했는지 표시할 때 써요.</span>
        <input name="displayName" required maxLength={30} defaultValue={defaultDisplayName} className={inputClass} />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={primaryButtonClass}
      >
        {pending ? "만드는 중…" : "가계부 만들기"}
      </button>
    </form>
  );
}
