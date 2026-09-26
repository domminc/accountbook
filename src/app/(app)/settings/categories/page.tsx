import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { KIND_LABEL, loadCategoryGroups, type CategoryGroup } from "@/lib/data/settings";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { cardClass, smallButtonClass, smallInputClass } from "@/components/ui";
import { EditableRow } from "../editable-row";
import {
  addCategory,
  addGroup,
  deleteCategory,
  deleteGroup,
  moveCategory,
  moveGroup,
  renameCategory,
  renameGroup,
  setCategoryHidden,
  setGroupHidden,
} from "../actions";

export default async function CategoriesPage() {
  const m = await requireHousehold();
  const groups = await withUser(m.userId, (tx) => loadCategoryGroups(tx, m.householdId));
  const variable = groups.filter((g) => g.kind === "variable_expense");

  return (
    <div>
      <Link href="/settings" className="text-sm text-muted">
        ← 설정
      </Link>
      <h1 className="mt-2 text-xl font-bold">카테고리</h1>
      <p className="mt-1 text-sm text-muted">
        수입·저축·고정지출 대분류는 시트와 같이 항상 있어야 해서 이름을 바꾸거나 지울 수 없어요. 소분류는 자유롭게 바꿀 수 있어요.
        거래에 쓴 항목은 지울 수 없으니 숨겨 주세요.
      </p>

      <ul className={`mt-4 divide-y divide-border ${cardClass}`}>
        {groups.map((g) => (
          <li key={g.id}>
            <GroupRow group={g} variableIndex={variable.findIndex((v) => v.id === g.id)} variableCount={variable.length} />
          </li>
        ))}
      </ul>

      <section className={`mt-6 p-4 ${cardClass}`}>
        <h2 className="font-semibold">비고정지출 대분류 추가</h2>
        <ActionForm action={addGroup} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input name="name" required maxLength={30} placeholder="대분류 이름 (예: 반려동물)" aria-label="대분류 이름" className={smallInputClass} />
          <input name="firstCategory" required maxLength={30} placeholder="첫 소분류 (예: 사료)" aria-label="첫 소분류 이름" className={smallInputClass} />
          <SubmitButton className={smallButtonClass}>추가</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}

function GroupRow({ group: g, variableIndex, variableCount }: { group: CategoryGroup; variableIndex: number; variableCount: number }) {
  const isVariable = g.kind === "variable_expense";
  const visibleCount = g.categories.filter((c) => !c.isHidden).length;

  return (
    <EditableRow
      name={g.name}
      hidden={g.isHidden}
      badge={KIND_LABEL[g.kind]}
      rename={isVariable ? renameGroup.bind(null, g.id) : undefined}
      moveUp={isVariable && variableIndex > 0 ? moveGroup.bind(null, g.id, -1) : undefined}
      moveDown={isVariable && variableIndex < variableCount - 1 ? moveGroup.bind(null, g.id, 1) : undefined}
      toggleHidden={isVariable ? setGroupHidden.bind(null, g.id, !g.isHidden) : undefined}
      remove={isVariable ? deleteGroup.bind(null, g.id) : undefined}
      removeConfirm={`"${g.name}" 대분류와 소분류를 모두 지울까요?`}
      preview={
        <p className="text-sm text-muted">
          {g.categories
            .filter((c) => !c.isHidden)
            .map((c) => c.name)
            .join(" · ")}
        </p>
      }
    >
      <div className="rounded-xl border border-border">
        <p className="border-b border-border px-4 py-2 text-sm font-medium">소분류</p>
        <ul className="divide-y divide-border">
          {g.categories.map((c, i) => (
            <li key={c.id}>
              <EditableRow
                name={c.name}
                hidden={c.isHidden}
                rename={renameCategory.bind(null, c.id)}
                moveUp={i > 0 ? moveCategory.bind(null, c.id, -1) : undefined}
                moveDown={i < g.categories.length - 1 ? moveCategory.bind(null, c.id, 1) : undefined}
                toggleHidden={c.isHidden || visibleCount > 1 ? setCategoryHidden.bind(null, c.id, !c.isHidden) : undefined}
                remove={g.categories.length > 1 ? deleteCategory.bind(null, c.id) : undefined}
                removeConfirm={`"${c.name}" 소분류를 지울까요?`}
              />
            </li>
          ))}
        </ul>
        <div className="border-t border-border p-3">
          <ActionForm action={addCategory.bind(null, g.id)} className="flex gap-2">
            <input name="name" required maxLength={30} placeholder="소분류 추가" aria-label={`${g.name} 소분류 추가`} className={smallInputClass} />
            <SubmitButton className={smallButtonClass}>추가</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </EditableRow>
  );
}
