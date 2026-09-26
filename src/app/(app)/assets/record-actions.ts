"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { MAX_AMOUNT } from "@/lib/money";
import { RECORDS, isRecordKind, type Field, type RecordKind } from "@/lib/records";
import { uuidSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

type Value = string | number | boolean | null;

/** 항목 정의대로 폼 값을 읽는다. 잘못되면 오류 문구. */
function readField(f: Field, formData: FormData): { value: Value } | { error: string } {
  const raw = String(formData.get(f.key) ?? "").trim();
  if (f.type === "bool") return { value: formData.get(f.key) === "on" };
  if (!raw) return f.required ? { error: `${f.label}을(를) 입력해 주세요.` } : { value: null };

  switch (f.type) {
    case "text":
      return raw.length > 100 ? { error: `${f.label}은(는) 100자 이하로 입력해 주세요.` } : { value: raw };
    case "longtext":
      return raw.length > 500 ? { error: `${f.label}은(는) 500자 이하로 입력해 주세요.` } : { value: raw };
    case "amount": {
      const n = Number(raw.replace(/[^\d]/g, ""));
      if (!Number.isFinite(n) || n > MAX_AMOUNT) return { error: `${f.label}을(를) 확인해 주세요.` };
      if (f.required && n <= 0) return { error: `${f.label}은(는) 1원 이상이어야 해요.` };
      return { value: n };
    }
    case "percent": {
      const n = Number(raw.replace(/[%\s]/g, ""));
      return Number.isFinite(n) && n >= 0 && n <= 100 ? { value: n } : { error: `${f.label}은(는) 0~100 사이 숫자로 입력해 주세요.` };
    }
    case "day": {
      const n = Number(raw.replace(/[^\d]/g, ""));
      return Number.isInteger(n) && n >= 1 && n <= 31 ? { value: n } : { error: `${f.label}은(는) 1~31 사이로 입력해 주세요.` };
    }
    case "last4":
      return /^\d{1,4}$/.test(raw) ? { value: raw } : { error: "계좌번호는 끝 4자리 숫자만 입력해 주세요." };
    case "category":
    case "payment_method":
      return uuidSchema.safeParse(raw).success ? { value: raw } : { error: `${f.label}을(를) 다시 골라 주세요.` };
  }
}

export async function saveRecord(kind: RecordKind, id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isRecordKind(kind)) return { error: "알 수 없는 항목이에요." };
  const m = await requireHousehold();
  const row: Record<string, Value> = {};
  for (const f of RECORDS[kind].fields) {
    const r = readField(f, formData);
    if ("error" in r) return { error: r.error };
    row[f.key] = r.value;
  }

  try {
    await withUser(m.userId, async (tx) => {
      if (id) {
        await tx`update ${tx(kind)} set ${tx(row)} where id = ${id} and household_id = ${m.householdId}`;
      } else {
        const [{ next }] = await tx<{ next: number }[]>`
          select coalesce(max(sort_order), -1) + 1 as next from ${tx(kind)} where household_id = ${m.householdId}
        `;
        await tx`insert into ${tx(kind)} ${tx({ ...row, household_id: m.householdId, sort_order: next })}`;
      }
    });
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  return { savedAt: Date.now(), message: "저장했어요." };
}

export async function deleteRecord(kind: RecordKind, id: string): Promise<ActionState> {
  if (!isRecordKind(kind)) return { error: "알 수 없는 항목이에요." };
  const m = await requireHousehold();
  try {
    await withUser(m.userId, (tx) => tx`delete from ${tx(kind)} where id = ${id} and household_id = ${m.householdId}`);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  return {};
}
