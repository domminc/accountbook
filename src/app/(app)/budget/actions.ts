"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { addMonths, isValidDate, isValidMonth } from "@/lib/month";
import { MAX_AMOUNT } from "@/lib/money";
import { periodOf, type GoalKind } from "@/lib/data/plan";
import type { ActionState } from "@/lib/action-state";
import { uuidSchema } from "@/lib/validation";

const GOAL_KINDS: GoalKind[] = ["income", "saving", "expense"];

/** 빈 칸이면 null, 숫자가 아니거나 범위를 넘으면 undefined(오류) */
function readAmount(formData: FormData, field: string): number | null | undefined {
  const raw = String(formData.get(field) ?? "").replace(/[^\d]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return n > MAX_AMOUNT ? undefined : n;
}

/** 목표·세부 목표·대분류별 예산을 한 번에 저장. 빈 칸은 지운다. */
export async function savePlan(month: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const m = await requireHousehold();
  if (!isValidMonth(month)) return { error: "월을 확인해 주세요." };
  const period = periodOf(month);

  const goals: { kind: GoalKind; amount: number | null; note: string | null }[] = [];
  for (const kind of GOAL_KINDS) {
    const amount = readAmount(formData, `goal_${kind}`);
    if (amount === undefined) return { error: "금액은 1조 원 이하로 입력해 주세요." };
    const note = String(formData.get(`note_${kind}`) ?? "").trim();
    if (note.length > 500) return { error: "세부 목표는 500자 이하로 입력해 주세요." };
    goals.push({ kind, amount, note: note || null });
  }

  const budgets: { groupId: string; amount: number | null }[] = [];
  for (const [key] of formData.entries()) {
    if (!key.startsWith("budget_")) continue;
    const amount = readAmount(formData, key);
    if (amount === undefined) return { error: "금액은 1조 원 이하로 입력해 주세요." };
    budgets.push({ groupId: key.slice("budget_".length), amount });
  }

  try {
    await withUser(m.userId, async (tx) => {
      for (const g of goals) {
        if (g.amount === null && g.note === null) {
          await tx`delete from public.goals where household_id = ${m.householdId} and period = ${period} and kind = ${g.kind}`;
        } else {
          await tx`
            insert into public.goals (household_id, period, kind, amount, note)
            values (${m.householdId}, ${period}, ${g.kind}, ${g.amount ?? 0}, ${g.note})
            on conflict (household_id, period, kind) do update set amount = excluded.amount, note = excluded.note
          `;
        }
      }
      for (const b of budgets) {
        if (b.amount === null) {
          await tx`delete from public.budgets where household_id = ${m.householdId} and period = ${period} and group_id = ${b.groupId}`;
        } else {
          await tx`
            insert into public.budgets (household_id, period, group_id, amount)
            values (${m.householdId}, ${period}, ${b.groupId}, ${b.amount})
            on conflict (household_id, period, group_id) do update set amount = excluded.amount
          `;
        }
      }
    });
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  return { savedAt: Date.now(), message: "저장했어요." };
}

/** 지난달 목표·예산을 이번 달로 복사 (이번 달에 이미 있는 항목은 그대로) */
export async function copyPrevPlan(month: string): Promise<ActionState> {
  const m = await requireHousehold();
  if (!isValidMonth(month)) return { error: "월을 확인해 주세요." };
  const from = periodOf(addMonths(month, -1));
  const to = periodOf(month);
  try {
    const copied = await withUser(m.userId, async (tx) => {
      const g = await tx`
        insert into public.goals (household_id, period, kind, amount, note)
        select household_id, ${to}, kind, amount, note from public.goals
        where household_id = ${m.householdId} and period = ${from}
        on conflict do nothing
      `;
      const b = await tx`
        insert into public.budgets (household_id, period, group_id, amount)
        select household_id, ${to}, group_id, amount from public.budgets
        where household_id = ${m.householdId} and period = ${from}
        on conflict do nothing
      `;
      return g.count + b.count;
    });
    revalidatePath("/", "layout");
    return copied > 0 ? { savedAt: Date.now(), message: `지난달 항목 ${copied}개를 가져왔어요.` } : { error: "가져올 지난달 목표·예산이 없어요." };
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
}

export async function addEvent(month: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const m = await requireHousehold();
  const date = String(formData.get("occurredOn") ?? "");
  if (!isValidDate(date) || !date.startsWith(month)) return { error: "이번 달 날짜를 골라 주세요." };
  const content = String(formData.get("content") ?? "").trim();
  if (!content || content.length > 200) return { error: "내용을 1~200자로 입력해 주세요." };
  const budget = readAmount(formData, "budget");
  if (budget === undefined) return { error: "금액은 1조 원 이하로 입력해 주세요." };

  try {
    await withUser(m.userId, (tx) => tx`
      insert into public.month_events (household_id, occurred_on, budget, content)
      values (${m.householdId}, ${date}, ${budget}, ${content})
    `);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  return {};
}

export async function deleteEvent(id: string): Promise<ActionState> {
  const m = await requireHousehold();
  try {
    await withUser(m.userId, (tx) => tx`delete from public.month_events where id = ${id} and household_id = ${m.householdId}`);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  return {};
}

/** 과소비 알림 한도 추가: target 은 "category:<id>" 또는 "tag:<id>" */
export async function addSpendingLimit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const m = await requireHousehold();
  const [type, id] = String(formData.get("target") ?? "").split(":");
  if ((type !== "category" && type !== "tag") || !uuidSchema.safeParse(id).success) return { error: "항목을 골라 주세요." };
  const amount = readAmount(formData, "amount");
  if (amount === undefined || amount === null || amount <= 0) return { error: "한도를 1원 ~ 1조 원 사이로 입력해 주세요." };
  try {
    await withUser(m.userId, (tx) =>
      tx`insert into public.spending_limits ${tx({
        household_id: m.householdId,
        category_id: type === "category" ? id : null,
        tag_id: type === "tag" ? id : null,
        amount,
      })}`,
    );
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  return { savedAt: Date.now() };
}

export async function deleteSpendingLimit(id: string): Promise<ActionState> {
  const m = await requireHousehold();
  try {
    await withUser(m.userId, (tx) => tx`delete from public.spending_limits where id = ${id} and household_id = ${m.householdId}`);
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  return {};
}
