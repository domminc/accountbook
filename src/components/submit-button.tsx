"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className,
  name,
  value,
  confirmMessage,
  "aria-label": ariaLabel,
  title,
}: {
  children: ReactNode;
  className?: string;
  name?: string;
  value?: string;
  /** 누르기 전에 확인 창을 띄운다 (삭제 등) */
  confirmMessage?: string;
  "aria-label"?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-label={ariaLabel}
      title={title}
      className={className}
      onClick={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
