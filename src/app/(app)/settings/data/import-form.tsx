"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { applyCutoff, parseWorkbook, previewByMonth, type ImportData, type SheetInput } from "@/lib/import/sheet";
import { formatWon } from "@/lib/money";
import { formatMonthLabel } from "@/lib/month";
import { cardClass, primaryButtonClass, secondaryButtonClass, smallInputClass } from "@/components/ui";
import { importSheet, type ImportResult } from "./actions";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportResult, FormData>(importSheet, {});
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ImportData | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [cutoff, setCutoff] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const { data, skipped } = useMemo(
    () => (parsed ? applyCutoff(parsed, cutoff || null) : { data: null, skipped: 0 }),
    [parsed, cutoff],
  );
  const preview = useMemo(() => (data ? previewByMonth(data) : []), [data]);

  async function onFile(file: File | undefined) {
    setParsed(null);
    setReadError(null);
    if (!file) return;
    setFileName(file.name);
    setReading(true);
    try {
      // 파일은 이 브라우저에서만 읽고, 서버에는 읽은 결과만 보낸다
      const { default: readXlsx } = await import("read-excel-file/browser");
      const sheets = (await readXlsx(file)) as unknown as SheetInput[];
      setParsed(parseWorkbook(sheets));
    } catch (e) {
      setReadError(e instanceof Error && e.message.includes("탭") ? e.message : "파일을 읽지 못했어요. 구글 시트에서 xlsx로 받은 파일인지 확인해 주세요.");
    } finally {
      setReading(false);
    }
  }

  // 화면이 준비되기 전에 파일을 골랐으면 change 이벤트를 놓치므로, 준비되면 한 번 확인한다
  useEffect(() => {
    const file = fileInput.current?.files?.[0];
    if (file) void onFile(file);
  }, []);

  const done = Boolean(state.savedAt);

  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="text-sm font-medium">시트 파일 (.xlsx)</span>
        <span className="block text-xs text-muted">구글 시트 → 파일 → 다운로드 → Microsoft Excel(.xlsx). 연도마다 한 파일씩 가져와요.</span>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="mt-2 block w-full text-sm"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">이 날짜부터 가져오기 (선택)</span>
        <span className="block text-xs text-muted">이전 날짜의 거래·예비비·목표·예산은 빼요. 비워 두면 전부 가져와요.</span>
        <input type="date" value={cutoff} onChange={(e) => setCutoff(e.target.value)} aria-label="가져오기 시작 날짜" className={`mt-1 ${smallInputClass}`} />
      </label>

      {reading ? <p className="text-sm text-muted">파일을 읽는 중…</p> : null}
      {readError ? (
        <p role="alert" className="text-sm text-danger">
          {readError}
        </p>
      ) : null}

      {data ? (
        <section className={`p-4 ${cardClass}`} aria-label="가져오기 미리보기">
          <h3 className="font-semibold">
            {data.year}년 시트{data.version ? ` (v${data.version})` : ""}
          </h3>
          <ul className="mt-2 text-sm text-muted">
            <li>
              거래 {data.transactions.length}건{skipped ? ` · 시작 날짜 이전 ${skipped}건 제외` : ""}
            </li>
            <li>
              예비비 입금 {data.reserve.ins.length}건 · 지출 {data.reserve.outs.length}건
            </li>
            <li>
              목표 {data.goals.length}개 · 예산 {data.budgets.length}개 · 이벤트 {data.events.length}개
            </li>
          </ul>
          {data.warnings.map((w) => (
            <p key={w} className="mt-2 text-sm text-warning">
              {w}
            </p>
          ))}
          {preview.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="text-xs text-muted">
                    <th className="py-1 text-left font-normal">월</th>
                    <th className="px-2 text-right font-normal">건수</th>
                    <th className="px-2 text-right font-normal">수입</th>
                    <th className="px-2 text-right font-normal">지출</th>
                    <th className="px-2 text-right font-normal">저축</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p) => (
                    <tr key={p.month} className="border-t border-border tabular-nums">
                      <td className="py-1">{formatMonthLabel(p.month)}</td>
                      <td className="px-2 text-right">
                        {p.count}
                        {p.uncategorized ? <span className="text-danger"> (분류 필요 {p.uncategorized})</span> : null}
                      </td>
                      <td className="px-2 text-right">{formatWon(p.income)}</td>
                      <td className="px-2 text-right">{formatWon(p.expense)}</td>
                      <td className="px-2 text-right">{formatWon(p.saving)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted">시트 월별시트의 총 수입·총 지출·총 저축과 같은지 확인해 보세요.</p>
            </div>
          ) : null}

          {!done ? (
            <form action={action} className="mt-4 flex flex-col gap-2">
              <input type="hidden" name="payload" value={JSON.stringify(data)} />
              <input type="hidden" name="fileName" value={fileName} />
              {state.needsReplace ? (
                <button type="submit" name="replace" value="1" disabled={pending} className={secondaryButtonClass}>
                  {pending ? "가져오는 중…" : "지우고 다시 가져오기"}
                </button>
              ) : (
                <button type="submit" disabled={pending} className={primaryButtonClass}>
                  {pending ? "가져오는 중…" : "가져오기"}
                </button>
              )}
            </form>
          ) : null}
        </section>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="text-sm text-accent">
          {state.message} {state.summary}
        </p>
      ) : null}
    </div>
  );
}
