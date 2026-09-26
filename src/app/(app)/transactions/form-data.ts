import type { Tx } from "@/lib/db";
import { loadCategoryGroups, loadSimpleItems } from "@/lib/data/settings";
import type { FormGroup, FormOption } from "./transaction-form";

/**
 * 입력 폼 선택지. 숨긴 항목은 빼되, 수정 중인 거래가 쓰는 항목은 남긴다.
 */
export async function loadFormOptions(
  tx: Tx,
  householdId: string,
  keep: { categoryId?: string | null; paymentMethodId?: string | null; tagIds?: string[] } = {},
): Promise<{ groups: FormGroup[]; paymentMethods: FormOption[]; tags: FormOption[] }> {
  const [groups, methods, tags] = await Promise.all([
    loadCategoryGroups(tx, householdId),
    loadSimpleItems(tx, householdId, "payment_methods"),
    loadSimpleItems(tx, householdId, "tags"),
  ]);
  const keepTags = new Set(keep.tagIds ?? []);

  return {
    groups: groups
      .filter((g) => !g.isHidden || g.categories.some((c) => c.id === keep.categoryId))
      .map((g) => ({
        id: g.id,
        name: g.name,
        kind: g.kind,
        categories: g.categories
          .filter((c) => !c.isHidden || c.id === keep.categoryId)
          .map((c) => ({ id: c.id, name: c.name })),
      }))
      .filter((g) => g.categories.length > 0),
    paymentMethods: methods.filter((p) => !p.isHidden || p.id === keep.paymentMethodId).map(({ id, name }) => ({ id, name })),
    tags: tags.filter((t) => !t.isHidden || keepTags.has(t.id)).map(({ id, name }) => ({ id, name })),
  };
}
