"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, withUser, type Tx } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { addMonths, isValidMonth } from "@/lib/month";
import { MAX_AMOUNT } from "@/lib/money";
import { moveInOrder } from "@/lib/data/settings";
import { firstError, nameSchema } from "@/lib/validation";
import type { AssetSection } from "@/lib/finance";
import type { ActionState } from "@/lib/action-state";

const SECTIONS: AssetSection[] = ["liability", "non_current", "current"];

async function run(fn: (tx: Tx, householdId: string) => Promise<string | void>): Promise<ActionState> {
  const m = await requireHousehold();
  try {
    const error = await withUser(m.userId, (tx) => fn(tx, m.householdId));
    if (error) return { error };
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/assets");
  return { savedAt: Date.now() };
}

export async function addAssetItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const section = String(formData.get("section") ?? "") as AssetSection;
  if (!SECTIONS.includes(section)) return { error: "자산 구분을 골라 주세요." };
  const group = nameSchema("종류").safeParse(formData.get("groupName") ?? "");
  if (!group.success) return { error: firstError(group.error) };
  const name = nameSchema("항목 이름", 50).safeParse(formData.get("name") ?? "");
  if (!name.success) return { error: firstError(name.error) };
  return run(async (tx, hid) => {
    const [{ next }] = await tx<{ next: number }[]>`
      select coalesce(max(sort_order), -1) + 1 as next from public.asset_items where household_id = ${hid}
    `;
    await tx`
      insert into public.asset_items (household_id, section, group_name, name, sort_order)
      values (${hid}, ${section}, ${group.data}, ${name.data}, ${next})
    `;
  });
}

// 참고 시트 자산관리 탭의 기본 항목
const DEFAULT_ITEMS: [AssetSection, string, string][] = [
  ["non_current", "부동산", "집 시세"],
  ["non_current", "부동산", "전세 보증금"],
  ["non_current", "노후대비", "IRP"],
  ["non_current", "노후대비", "연금저축펀드"],
  ["non_current", "노후대비", "국민연금"],
  ["non_current", "청약", "주택청약"],
  ["current", "저축", "예적금"],
  ["current", "저축", "비상금"],
  ["current", "투자", "주식"],
  ["current", "투자", "펀드"],
  ["liability", "대출", "주택담보대출"],
  ["liability", "대출", "전세자금대출"],
  ["liability", "대출", "신용대출"],
  ["liability", "대출", "마이너스 통장"],
];

export async function addDefaultAssetItems(): Promise<ActionState> {
  return run(async (tx, hid) => {
    const [{ count }] = await tx<{ count: number }[]>`select count(*) from public.asset_items where household_id = ${hid}`;
    if (count > 0) return "이미 항목이 있어요.";
    for (const [i, [section, group, name]] of DEFAULT_ITEMS.entries()) {
      await tx`
        insert into public.asset_items (household_id, section, group_name, name, sort_order)
        values (${hid}, ${section}, ${group}, ${name}, ${i})
      `;
    }
  });
}

export async function renameAssetItem(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = nameSchema("항목 이름", 50).safeParse(formData.get("name") ?? "");
  if (!name.success) return { error: firstError(name.error) };
  return run(async (tx, hid) => {
    await tx`update public.asset_items set name = ${name.data} where id = ${id} and household_id = ${hid}`;
  });
}

export async function moveAssetItem(id: string, dir: -1 | 1): Promise<ActionState> {
  return run(async (tx, hid) => {
    const rows = await tx<{ id: string }[]>`
      select id from public.asset_items where household_id = ${hid} order by sort_order, created_at
    `;
    for (const [i, rid] of moveInOrder(rows.map((r) => r.id), id, dir).entries()) {
      await tx`update public.asset_items set sort_order = ${i} where id = ${rid}`;
    }
  });
}

export async function setAssetItemHidden(id: string, hidden: boolean): Promise<ActionState> {
  return run(async (tx, hid) => {
    await tx`update public.asset_items set is_hidden = ${hidden} where id = ${id} and household_id = ${hid}`;
  });
}

export async function deleteAssetItem(id: string): Promise<ActionState> {
  return run(async (tx, hid) => {
    await tx`delete from public.asset_items where id = ${id} and household_id = ${hid}`;
  });
}

/** 한 달치 항목별 금액 저장. 빈 칸은 지운다. */
export async function saveSnapshots(month: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isValidMonth(month)) return { error: "월을 확인해 주세요." };
  const values: { id: string; amount: number | null }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("item_")) continue;
    const digits = String(raw).replace(/[^\d]/g, "");
    const amount = digits ? Number(digits) : null;
    if (amount !== null && amount > MAX_AMOUNT) return { error: "금액은 1조 원 이하로 입력해 주세요." };
    values.push({ id: key.slice(5), amount });
  }
  const period = `${month}-01`;
  const result = await run(async (tx, hid) => {
    for (const v of values) {
      if (v.amount === null) {
        await tx`delete from public.asset_snapshots where asset_item_id = ${v.id} and household_id = ${hid} and period = ${period}`;
      } else {
        await tx`
          insert into public.asset_snapshots (asset_item_id, household_id, period, amount)
          values (${v.id}, ${hid}, ${period}, ${v.amount})
          on conflict (asset_item_id, period) do update set amount = excluded.amount
        `;
      }
    }
  });
  return result.error ? result : { ...result, message: "저장했어요." };
}

/** 지난달 금액을 이번 달로 복사 (이번 달에 이미 있는 항목은 그대로) */
export async function copyPrevSnapshots(month: string): Promise<ActionState> {
  if (!isValidMonth(month)) return { error: "월을 확인해 주세요." };
  const from = `${addMonths(month, -1)}-01`;
  let copied = 0;
  const result = await run(async (tx, hid) => {
    const r = await tx`
      insert into public.asset_snapshots (asset_item_id, household_id, period, amount)
      select asset_item_id, household_id, ${`${month}-01`}, amount from public.asset_snapshots
      where household_id = ${hid} and period = ${from}
      on conflict do nothing
    `;
    copied = r.count;
    if (copied === 0) return "가져올 지난달 금액이 없어요.";
  });
  return result.error ? result : { ...result, message: `지난달 금액 ${copied}개를 가져왔어요.` };
}
