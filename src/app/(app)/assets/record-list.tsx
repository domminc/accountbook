import type { ReactNode } from "react";
import { RECORDS, type RecordKind } from "@/lib/records";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { cardClass, smallButtonClass } from "@/components/ui";
import { deleteRecord, saveRecord } from "./record-actions";
import { RecordFields, type Option, type OptionGroup } from "./record-fields";

export type RecordRow = { id: string } & Record<string, unknown>;

/** 대출·카드·통장·결제일 목록: 줄을 누르면 수정·삭제, 아래에 추가 폼 */
export function RecordList({
  kind,
  rows,
  title,
  summary,
  extra,
  categories,
  paymentMethods,
}: {
  kind: RecordKind;
  rows: RecordRow[];
  title: (row: RecordRow) => ReactNode;
  summary: (row: RecordRow) => ReactNode;
  /** 펼쳤을 때 수정 폼 아래에 더 보여줄 내용 (대출 상환 기록 등) */
  extra?: (row: RecordRow) => ReactNode;
  categories?: OptionGroup[];
  paymentMethods?: Option[];
}) {
  const def = RECORDS[kind];
  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 ? (
        <ul className={`divide-y divide-border ${cardClass}`}>
          {rows.map((row) => (
            <li key={row.id}>
              <details className="px-4 py-3">
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{title(row)}</span>
                    <span className="text-sm text-muted [details[open]>summary>span>&]:hidden">편집</span>
                    <span className="hidden text-sm text-muted [details[open]>summary>span>&]:inline">닫기</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{summary(row)}</span>
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  {extra ? extra(row) : null}
                  <ActionForm action={saveRecord.bind(null, kind, row.id)} className="flex flex-col gap-3">
                    <RecordFields fields={def.fields} values={row} categories={categories} paymentMethods={paymentMethods} idPrefix={row.id} />
                    <SubmitButton className={smallButtonClass}>저장</SubmitButton>
                  </ActionForm>
                  <ActionForm action={deleteRecord.bind(null, kind, row.id)}>
                    <SubmitButton className={`${smallButtonClass} text-danger`} confirmMessage="이 항목을 지울까요?">
                      삭제
                    </SubmitButton>
                  </ActionForm>
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">아직 등록한 {def.title} 항목이 없어요.</p>
      )}

      <details className={`px-4 py-3 ${cardClass}`} open={rows.length === 0}>
        <summary className="cursor-pointer font-medium">+ {def.unit} 추가</summary>
        <ActionForm action={saveRecord.bind(null, kind, null)} className="mt-3 flex flex-col gap-3" resetOnSuccess>
          <RecordFields fields={def.fields} categories={categories} paymentMethods={paymentMethods} idPrefix={`new-${kind}`} />
          <SubmitButton className={smallButtonClass}>추가</SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}
