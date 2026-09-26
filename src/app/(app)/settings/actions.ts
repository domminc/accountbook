"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, withUser, type Tx } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { moveInOrder, type SimpleTable } from "@/lib/data/settings";
import { firstError, nameSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

type Dir = -1 | 1;

/** 가계부 구성원 권한으로 실행하고, 오류는 문구로 바꿔 돌려준다. */
async function run(fn: (tx: Tx, householdId: string) => Promise<string | void>): Promise<ActionState> {
  const m = await requireHousehold();
  try {
    const error = await withUser(m.userId, (tx) => fn(tx, m.householdId));
    if (error) return { error };
  } catch (e) {
    return { error: dbErrorMessage(e) };
  }
  revalidatePath("/", "layout");
  return {};
}

function readName(formData: FormData, field = "name", label = "이름") {
  return nameSchema(label).safeParse(formData.get(field) ?? "");
}

async function saveOrder(tx: Tx, table: string, ids: string[], offset = 0) {
  for (const [i, id] of ids.entries()) {
    await tx`update ${tx(table)} set sort_order = ${offset + i} where id = ${id}`;
  }
}

// ─── 대분류 ───────────────────────────────────

export async function addGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = readName(formData, "name", "대분류 이름");
  if (!name.success) return { error: firstError(name.error) };
  const sub = readName(formData, "firstCategory", "첫 소분류 이름");
  if (!sub.success) return { error: firstError(sub.error) };

  return run(async (tx, hid) => {
    const [{ next }] = await tx<{ next: number }[]>`
      select coalesce(max(sort_order), 0) + 1 as next from public.category_groups where household_id = ${hid}
    `;
    const [group] = await tx<{ id: string }[]>`
      insert into public.category_groups (household_id, kind, name, sort_order)
      values (${hid}, 'variable_expense', ${name.data}, ${next})
      returning id
    `;
    await tx`
      insert into public.categories (household_id, group_id, name, sort_order)
      values (${hid}, ${group.id}, ${sub.data}, 0)
    `;
  });
}

export async function renameGroup(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = readName(formData, "name", "대분류 이름");
  if (!name.success) return { error: firstError(name.error) };
  // 수입·저축·고정지출 이름 변경은 DB 트리거가 막는다
  return run(async (tx, hid) => {
    await tx`update public.category_groups set name = ${name.data} where id = ${id} and household_id = ${hid}`;
  });
}

export async function moveGroup(id: string, dir: Dir): Promise<ActionState> {
  return run(async (tx, hid) => {
    // 수입·저축·고정지출은 항상 맨 위. 비고정지출 대분류끼리만 순서를 바꾼다.
    const rows = await tx<{ id: string }[]>`
      select id from public.category_groups
      where household_id = ${hid} and kind = 'variable_expense'
      order by sort_order, created_at
    `;
    await saveOrder(tx, "category_groups", moveInOrder(rows.map((r) => r.id), id, dir), 3);
  });
}

export async function setGroupHidden(id: string, hidden: boolean): Promise<ActionState> {
  return run(async (tx, hid) => {
    const [row] = await tx<{ kind: string }[]>`
      select kind from public.category_groups where id = ${id} and household_id = ${hid}
    `;
    if (!row) return "대분류를 찾을 수 없어요.";
    if (row.kind !== "variable_expense") return "수입·저축·고정지출 대분류는 숨길 수 없어요.";
    await tx`update public.category_groups set is_hidden = ${hidden} where id = ${id}`;
  });
}

export async function deleteGroup(id: string): Promise<ActionState> {
  // 수입·저축·고정지출 삭제는 DB 트리거가, 거래에 쓰인 소분류가 있으면 FK가 막는다
  return run(async (tx, hid) => {
    await tx`delete from public.category_groups where id = ${id} and household_id = ${hid}`;
  });
}

// ─── 소분류 ───────────────────────────────────

export async function addCategory(groupId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = readName(formData, "name", "소분류 이름");
  if (!name.success) return { error: firstError(name.error) };
  return run(async (tx, hid) => {
    const [{ next }] = await tx<{ next: number }[]>`
      select coalesce(max(sort_order), -1) + 1 as next from public.categories where group_id = ${groupId}
    `;
    await tx`
      insert into public.categories (household_id, group_id, name, sort_order)
      values (${hid}, ${groupId}, ${name.data}, ${next})
    `;
  });
}

export async function renameCategory(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = readName(formData, "name", "소분류 이름");
  if (!name.success) return { error: firstError(name.error) };
  return run(async (tx, hid) => {
    await tx`update public.categories set name = ${name.data} where id = ${id} and household_id = ${hid}`;
  });
}

export async function moveCategory(id: string, dir: Dir): Promise<ActionState> {
  return run(async (tx, hid) => {
    const rows = await tx<{ id: string }[]>`
      select c.id from public.categories c
      where c.household_id = ${hid}
        and c.group_id = (select group_id from public.categories where id = ${id})
      order by c.sort_order, c.created_at
    `;
    await saveOrder(tx, "categories", moveInOrder(rows.map((r) => r.id), id, dir));
  });
}

async function siblingCounts(tx: Tx, id: string, hid: string) {
  const [row] = await tx<{ total: number; visible: number; is_hidden: boolean }[]>`
    select count(*) as total, count(*) filter (where not s.is_hidden) as visible, c.is_hidden
    from public.categories c
    join public.categories s on s.group_id = c.group_id
    where c.id = ${id} and c.household_id = ${hid}
    group by c.is_hidden
  `;
  return row;
}

export async function setCategoryHidden(id: string, hidden: boolean): Promise<ActionState> {
  return run(async (tx, hid) => {
    const counts = await siblingCounts(tx, id, hid);
    if (!counts) return "소분류를 찾을 수 없어요.";
    if (hidden && !counts.is_hidden && counts.visible <= 1) return "대분류마다 보이는 소분류가 하나는 있어야 해요.";
    await tx`update public.categories set is_hidden = ${hidden} where id = ${id}`;
  });
}

export async function deleteCategory(id: string): Promise<ActionState> {
  return run(async (tx, hid) => {
    const counts = await siblingCounts(tx, id, hid);
    if (!counts) return "소분류를 찾을 수 없어요.";
    if (counts.total <= 1) return "대분류마다 소분류가 하나는 있어야 해요.";
    if (!counts.is_hidden && counts.visible <= 1) return "대분류마다 보이는 소분류가 하나는 있어야 해요.";
    await tx`delete from public.categories where id = ${id}`;
  });
}

// ─── 지출방법 · 태그 ───────────────────────────

const SIMPLE_LABEL: Record<SimpleTable, string> = { payment_methods: "지출방법", tags: "태그" };

function assertTable(table: string): asserts table is SimpleTable {
  if (table !== "payment_methods" && table !== "tags") throw new Error(`unknown table ${table}`);
}

export async function addItem(table: SimpleTable, _prev: ActionState, formData: FormData): Promise<ActionState> {
  assertTable(table);
  const name = readName(formData, "name", `${SIMPLE_LABEL[table]} 이름`);
  if (!name.success) return { error: firstError(name.error) };
  return run(async (tx, hid) => {
    const [{ next }] = await tx<{ next: number }[]>`
      select coalesce(max(sort_order), -1) + 1 as next from ${tx(table)} where household_id = ${hid}
    `;
    await tx`insert into ${tx(table)} (household_id, name, sort_order) values (${hid}, ${name.data}, ${next})`;
  });
}

export async function renameItem(table: SimpleTable, id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  assertTable(table);
  const name = readName(formData, "name", `${SIMPLE_LABEL[table]} 이름`);
  if (!name.success) return { error: firstError(name.error) };
  return run(async (tx, hid) => {
    await tx`update ${tx(table)} set name = ${name.data} where id = ${id} and household_id = ${hid}`;
  });
}

export async function moveItem(table: SimpleTable, id: string, dir: Dir): Promise<ActionState> {
  assertTable(table);
  return run(async (tx, hid) => {
    const rows = await tx<{ id: string }[]>`
      select id from ${tx(table)} where household_id = ${hid} order by sort_order, created_at
    `;
    await saveOrder(tx, table, moveInOrder(rows.map((r) => r.id), id, dir));
  });
}

export async function setItemHidden(table: SimpleTable, id: string, hidden: boolean): Promise<ActionState> {
  assertTable(table);
  return run(async (tx, hid) => {
    await tx`update ${tx(table)} set is_hidden = ${hidden} where id = ${id} and household_id = ${hid}`;
  });
}

export async function deleteItem(table: SimpleTable, id: string): Promise<ActionState> {
  assertTable(table);
  return run(async (tx, hid) => {
    // 거래에 쓰인 지출방법은 FK가 막는다. 태그는 거래에서 떼어지고 지워진다.
    await tx`delete from ${tx(table)} where id = ${id} and household_id = ${hid}`;
  });
}
