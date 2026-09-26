"use client";

import { useState } from "react";
import { formatWon } from "@/lib/money";

/** 천 단위 쉼표가 붙는 금액 입력 */
export function AmountInput({
  name,
  defaultValue,
  className,
  required,
  "aria-label": ariaLabel,
  placeholder = "0",
}: {
  name: string;
  defaultValue?: number | null;
  className?: string;
  required?: boolean;
  "aria-label"?: string;
  placeholder?: string;
}) {
  const initial = defaultValue ? formatWon(defaultValue) : "";
  const [value, setValue] = useState(initial);
  // 저장된 값이 바뀌면(지난달 가져오기 등) 입력 칸도 따라간다
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setValue(initial);
  }
  return (
    <div className="relative">
      <input
        name={name}
        required={required}
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 13);
          setValue(digits ? formatWon(Number(digits)) : "");
        }}
        className={`${className ?? ""} pr-8 text-right tabular-nums`}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">원</span>
    </div>
  );
}
