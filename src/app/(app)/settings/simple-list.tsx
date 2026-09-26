import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { loadSimpleItems, type SimpleTable } from "@/lib/data/settings";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { cardClass, smallButtonClass, smallInputClass } from "@/components/ui";
import { EditableRow } from "./editable-row";
import { addItem, deleteItem, moveItem, renameItem, setItemHidden } from "./actions";

/** 지출방법·태그처럼 이름만 있는 목록 편집 화면 */
export async function SimpleListPage({
  table,
  title,
  description,
  placeholder,
}: {
  table: SimpleTable;
  title: string;
  description: string;
  placeholder: string;
}) {
  const m = await requireHousehold();
  const items = await withUser(m.userId, (tx) => loadSimpleItems(tx, m.householdId, table));

  return (
    <div>
      <Link href="/settings" className="text-sm text-muted">
        ← 설정
      </Link>
      <h1 className="mt-2 text-xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted">{description}</p>

      {items.length > 0 ? (
        <ul className={`mt-4 divide-y divide-border ${cardClass}`}>
          {items.map((item, i) => (
            <li key={item.id}>
              <EditableRow
                name={item.name}
                hidden={item.isHidden}
                rename={renameItem.bind(null, table, item.id)}
                moveUp={i > 0 ? moveItem.bind(null, table, item.id, -1) : undefined}
                moveDown={i < items.length - 1 ? moveItem.bind(null, table, item.id, 1) : undefined}
                toggleHidden={setItemHidden.bind(null, table, item.id, !item.isHidden)}
                remove={deleteItem.bind(null, table, item.id)}
                removeConfirm={`"${item.name}"을(를) 지울까요?`}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <ActionForm action={addItem.bind(null, table)} className={`mt-4 flex gap-2 p-4 ${cardClass}`}>
        <input name="name" required maxLength={30} placeholder={placeholder} aria-label={`${title} 추가`} className={smallInputClass} />
        <SubmitButton className={smallButtonClass}>추가</SubmitButton>
      </ActionForm>
    </div>
  );
}
