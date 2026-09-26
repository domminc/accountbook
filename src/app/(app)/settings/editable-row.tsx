import type { ReactNode } from "react";
import type { FormAction } from "@/lib/action-state";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { smallButtonClass, smallInputClass } from "@/components/ui";

type Props = {
  name: string;
  hidden?: boolean;
  badge?: string;
  rename?: FormAction;
  moveUp?: FormAction;
  moveDown?: FormAction;
  toggleHidden?: FormAction;
  remove?: FormAction;
  removeConfirm?: string;
  /** 펼쳤을 때 이름·버튼 아래에 보일 내용 */
  children?: ReactNode;
  /** 접었을 때도 이름 아래에 보일 내용 */
  preview?: ReactNode;
};

/** 설정 목록 한 줄. 누르면 펼쳐져서 이름 바꾸기·순서·숨김·삭제를 할 수 있다. */
export function EditableRow(p: Props) {
  const hasControls = p.rename || p.moveUp || p.moveDown || p.toggleHidden || p.remove || p.children;
  return (
    <details className="px-4 py-3">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span className={`font-medium ${p.hidden ? "text-muted line-through" : ""}`}>{p.name}</span>
          {p.badge ? <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted">{p.badge}</span> : null}
          {p.hidden ? <span className="text-xs text-muted">숨김</span> : null}
          {/* 이 줄(details)의 열림 상태만 본다. 바깥 줄이 열려 있어도 영향받지 않게 직계 선택자로 쓴다. */}
          {hasControls ? (
            <span className="ml-auto text-sm text-muted [details[open]>summary>span>&]:hidden">편집</span>
          ) : null}
          {hasControls ? (
            <span className="ml-auto hidden text-sm text-muted [details[open]>summary>span>&]:inline">닫기</span>
          ) : null}
        </span>
        {/* 닫힌 details는 summary 밖 내용을 그리지 않으므로 미리보기는 summary 안에 둔다 */}
        {p.preview ? <span className="mt-1 block [details[open]>summary>&]:hidden">{p.preview}</span> : null}
      </summary>

      {hasControls ? (
        <div className="mt-3 flex flex-col gap-3">
          {p.rename ? (
            <ActionForm action={p.rename} className="flex gap-2">
              <input name="name" defaultValue={p.name} required maxLength={30} aria-label="이름" className={smallInputClass} />
              <SubmitButton className={smallButtonClass}>이름 저장</SubmitButton>
            </ActionForm>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {p.moveUp ? (
              <ActionForm action={p.moveUp}>
                <SubmitButton className={smallButtonClass} aria-label="위로">
                  ↑ 위로
                </SubmitButton>
              </ActionForm>
            ) : null}
            {p.moveDown ? (
              <ActionForm action={p.moveDown}>
                <SubmitButton className={smallButtonClass} aria-label="아래로">
                  ↓ 아래로
                </SubmitButton>
              </ActionForm>
            ) : null}
            {p.toggleHidden ? (
              <ActionForm action={p.toggleHidden}>
                <SubmitButton className={smallButtonClass}>{p.hidden ? "다시 보이기" : "숨기기"}</SubmitButton>
              </ActionForm>
            ) : null}
            {p.remove ? (
              <ActionForm action={p.remove}>
                <SubmitButton className={`${smallButtonClass} text-danger`} confirmMessage={p.removeConfirm}>
                  삭제
                </SubmitButton>
              </ActionForm>
            ) : null}
          </div>
          {p.children}
        </div>
      ) : null}
    </details>
  );
}
