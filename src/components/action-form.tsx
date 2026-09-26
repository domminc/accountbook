"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState, FormAction } from "@/lib/action-state";

/**
 * React는 폼 액션이 끝나면 비제어 입력 칸을 초기값으로 되돌린다. 오류가 났을 때 입력한 값이
 * 사라지지 않도록, 제출할 때 값을 기억해 두었다가 오류면 다시 채운다.
 */
function restoreForm(form: HTMLFormElement, data: FormData) {
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) continue;
    if (!el.name || el.type === "file" || el.type === "hidden") continue;
    const values = data.getAll(el.name).map(String);
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      el.checked = values.includes(el.value);
    } else if (values.length > 0) {
      el.value = values[0];
    }
  }
}

/** 서버 액션 폼. 오류·완료 문구를 폼 아래에 보여준다. */
export function ActionForm({
  action,
  children,
  className,
  errorClassName = "mt-1 text-sm text-danger",
  resetOnSuccess = false,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  errorClassName?: string;
  /** 성공하면 입력 칸을 모두 처음 상태로 (추가 폼) */
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<FormData | null>(null);

  useEffect(() => {
    if (state.error && formRef.current && submitted.current) restoreForm(formRef.current, submitted.current);
  }, [state]);

  return (
    <>
      <form
        ref={formRef}
        key={resetOnSuccess ? (state.savedAt ?? 0) : undefined}
        action={formAction}
        onSubmit={(e) => {
          submitted.current = new FormData(e.currentTarget);
        }}
        className={className}
      >
        {children}
      </form>
      {state.error ? (
        <p role="alert" className={errorClassName}>
          {state.error}
        </p>
      ) : state.message ? (
        <p role="status" className="mt-1 text-sm text-accent">
          {state.message}
        </p>
      ) : null}
    </>
  );
}
