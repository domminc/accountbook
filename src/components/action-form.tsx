"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState, FormAction } from "@/lib/action-state";

/** 서버 액션 폼. 오류 문구를 폼 아래에 보여준다. */
export function ActionForm({
  action,
  children,
  className,
  errorClassName = "mt-1 text-sm text-danger",
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  errorClassName?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <>
      <form action={formAction} className={className}>
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
