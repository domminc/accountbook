import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { formatMonthLabel, parseMonth } from "@/lib/month";
import { formatWon } from "@/lib/money";
import { formatCompact } from "@/lib/format";
import { SECTIONS, SECTION_LABEL, netWorthByMonth, type AssetItem, type AssetSection } from "@/lib/finance";
import { loadAssetItems, loadSnapshots } from "@/lib/data/finance";
import { ActionForm } from "@/components/action-form";
import { AmountInput } from "@/components/amount-input";
import { MonthNav } from "@/components/month-nav";
import { SubmitButton } from "@/components/submit-button";
import { cardClass, primaryButtonClass, smallButtonClass, smallInputClass } from "@/components/ui";
import { EditableRow } from "../settings/editable-row";
import {
  addAssetItem,
  addDefaultAssetItems,
  copyPrevSnapshots,
  deleteAssetItem,
  moveAssetItem,
  renameAssetItem,
  saveSnapshots,
  setAssetItemHidden,
} from "./actions";

/** 구분 > 종류 > 항목 순으로 묶기 */
function grouped(items: AssetItem[]) {
  return SECTIONS.map((section) => {
    const inSection = items.filter((i) => i.section === section);
    const groups = [...new Set(inSection.map((i) => i.groupName))].map((g) => ({ name: g, items: inSection.filter((i) => i.groupName === g) }));
    return { section, groups };
  }).filter((s) => s.groups.length > 0);
}

export default async function AssetsPage({ searchParams }: PageProps<"/assets">) {
  const m = await requireHousehold();
  const params = await searchParams;
  const month = parseMonth(Array.isArray(params.month) ? params.month[0] : params.month);
  const year = month.slice(0, 4);
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

  const { items, snapshots } = await withUser(m.userId, async (tx) => {
    const [items, snapshots] = await Promise.all([
      loadAssetItems(tx, m.householdId),
      loadSnapshots(tx, m.householdId, { start: `${year}-01-01`, end: `${year}-12-01` }),
    ]);
    return { items, snapshots };
  });
  const visible = items.filter((i) => !i.isHidden || snapshots.some((s) => s.itemId === i.id));
  const worth = netWorthByMonth(visible, snapshots, months);
  const current = worth.find((w) => w.month === month)!;
  const valueOf = (itemId: string, mm: string) => snapshots.find((s) => s.itemId === itemId && s.month === mm)?.amount ?? null;
  const maxAbs = Math.max(...worth.map((w) => Math.abs(w.netWorth ?? 0)), 1);

  return (
    <>
      <MonthNav month={month} basePath="/assets" title="자산관리" />

      <section className={`p-5 ${cardClass}`} aria-label="순자산">
        <p className="text-sm text-muted">{formatMonthLabel(month)} 순자산 (자산 − 부채)</p>
        {current.netWorth === null ? (
          <p className="mt-1 text-sm text-muted">이 달 금액을 아직 입력하지 않았어요.</p>
        ) : (
          <>
            <p className={`text-3xl font-bold break-keep sm:text-4xl ${current.netWorth < 0 ? "text-danger" : ""}`}>{formatWon(current.netWorth)}원</p>
            <p className="mt-2 text-sm text-muted">
              자산 {formatWon(current.assets ?? 0)} · 부채 {formatWon(current.liabilities ?? 0)}
            </p>
          </>
        )}
      </section>

      <section className={`p-4 ${cardClass}`}>
        <h2 className="font-semibold">{year}년 월별 순자산</h2>
        <div
          role="img"
          aria-label={`월별 순자산: ${worth.map((w, i) => `${i + 1}월 ${w.netWorth === null ? "입력 없음" : `${formatWon(w.netWorth)}원`}`).join(", ")}`}
          className="mt-3 grid h-32 grid-cols-12 items-end gap-1"
        >
          {worth.map((w) => (
            <div key={w.month} className="flex h-full flex-col justify-end" title={w.netWorth === null ? "입력 없음" : `${formatWon(w.netWorth)}원`}>
              {w.netWorth !== null ? (
                <div
                  className={`rounded-t ${w.netWorth < 0 ? "bg-danger" : "bg-accent"} ${w.month === month ? "" : "opacity-60"}`}
                  style={{ height: `${Math.max((Math.abs(w.netWorth) / maxAbs) * 100, 2)}%` }}
                />
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-12 gap-1 text-center text-[10px] text-muted">
          {worth.map((w, i) => (
            <span key={w.month}>
              {i + 1}
              <span className="block text-foreground tabular-nums">{w.netWorth === null ? "" : formatCompact(w.netWorth, 0)}</span>
            </span>
          ))}
        </div>
      </section>

      {visible.length === 0 ? (
        <section className={`p-4 ${cardClass}`}>
          <h2 className="font-semibold">자산 항목 만들기</h2>
          <p className="mt-1 text-sm text-muted">시트 자산관리 탭처럼 부동산·노후대비·청약·저축·투자·대출 항목으로 시작하거나, 아래에서 직접 추가하세요.</p>
          <ActionForm action={addDefaultAssetItems} className="mt-3">
            <SubmitButton className={`w-full ${primaryButtonClass}`}>기본 항목으로 시작하기</SubmitButton>
          </ActionForm>
        </section>
      ) : (
        <>
          <section className={`p-4 ${cardClass}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">{formatMonthLabel(month)} 금액 입력</h2>
              <ActionForm action={copyPrevSnapshots.bind(null, month)}>
                <SubmitButton className="text-sm text-muted underline underline-offset-4">지난달 금액 가져오기</SubmitButton>
              </ActionForm>
            </div>
            <p className="text-xs text-muted">월말 기준 금액을 적어 주세요. 비워 두면 입력하지 않은 것으로 봐요.</p>
            <ActionForm action={saveSnapshots.bind(null, month)} className="mt-3 flex flex-col gap-4">
              {grouped(visible.filter((i) => !i.isHidden)).map((s) => (
                <fieldset key={s.section}>
                  <legend className="text-sm font-semibold">{SECTION_LABEL[s.section]}</legend>
                  {s.groups.map((g) => (
                    <div key={g.name} className="mt-2">
                      <p className="text-xs text-muted">{g.name}</p>
                      {g.items.map((i) => (
                        <label key={i.id} className="mt-1 grid grid-cols-[1fr_9.5rem] items-center gap-3">
                          <span className="truncate text-sm">{i.name}</span>
                          <AmountInput name={`item_${i.id}`} defaultValue={valueOf(i.id, month)} aria-label={`${i.name} 금액`} className={smallInputClass} />
                        </label>
                      ))}
                    </div>
                  ))}
                </fieldset>
              ))}
              <SubmitButton className={primaryButtonClass}>저장</SubmitButton>
            </ActionForm>
          </section>

          <AnnualAssetTable items={visible} months={months} valueOf={valueOf} worth={worth} />
        </>
      )}

      <details className={`px-4 py-3 ${cardClass}`}>
        <summary className="cursor-pointer font-semibold">항목 관리</summary>
        <ul className="mt-2 divide-y divide-border">
          {items.map((i, idx) => (
            <li key={i.id}>
              <EditableRow
                name={i.name}
                badge={`${SECTION_LABEL[i.section]} · ${i.groupName}`}
                hidden={i.isHidden}
                rename={renameAssetItem.bind(null, i.id)}
                moveUp={idx > 0 ? moveAssetItem.bind(null, i.id, -1) : undefined}
                moveDown={idx < items.length - 1 ? moveAssetItem.bind(null, i.id, 1) : undefined}
                toggleHidden={setAssetItemHidden.bind(null, i.id, !i.isHidden)}
                remove={deleteAssetItem.bind(null, i.id)}
                removeConfirm={`"${i.name}" 항목과 입력한 금액을 모두 지울까요?`}
              />
            </li>
          ))}
        </ul>
        <ActionForm action={addAssetItem} className="mt-3 grid grid-cols-2 gap-2" resetOnSuccess>
          <select name="section" required defaultValue="current" aria-label="자산 구분" className={smallInputClass}>
            {(["non_current", "current", "liability"] as AssetSection[]).map((s) => (
              <option key={s} value={s}>
                {SECTION_LABEL[s]}
              </option>
            ))}
          </select>
          <input name="groupName" required maxLength={30} list="asset-groups" placeholder="종류 (예: 저축)" aria-label="종류" className={smallInputClass} />
          <datalist id="asset-groups">
            {[...new Set(items.map((i) => i.groupName))].map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <input name="name" required maxLength={50} placeholder="항목 이름 (예: OO은행 적금)" aria-label="항목 이름" className={`col-span-2 ${smallInputClass}`} />
          <SubmitButton className={`col-span-2 ${smallButtonClass}`}>항목 추가</SubmitButton>
        </ActionForm>
      </details>
    </>
  );
}

function AnnualAssetTable({
  items,
  months,
  valueOf,
  worth,
}: {
  items: AssetItem[];
  months: string[];
  valueOf: (itemId: string, month: string) => number | null;
  worth: ReturnType<typeof netWorthByMonth>;
}) {
  const sticky = "sticky left-0 z-[1] bg-surface";
  const cell = (key: string, v: number | null, bold = false) => (
    <td key={key} className={`px-2 py-1.5 text-right tabular-nums ${bold ? "font-semibold" : ""}`}>
      {v === null ? "-" : formatWon(v)}
    </td>
  );
  const sectionTotal = (section: AssetSection, mm: string) => {
    const vals = items.filter((i) => i.section === section).map((i) => valueOf(i.id, mm));
    return vals.every((v) => v === null) ? null : vals.reduce<number>((s, v) => s + (v ?? 0), 0);
  };

  return (
    <section className={`p-4 ${cardClass}`}>
      <h2 className="font-semibold">월별 상세</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className={`${sticky} py-1 pr-3 text-left font-normal`}>항목</th>
              {months.map((mm) => (
                <th key={mm} className="px-2 text-right font-normal">
                  {Number(mm.slice(5))}월
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped(items).map((s) => (
              <SectionRows key={s.section} section={s.section} groups={s.groups} months={months} valueOf={valueOf} sticky={sticky} cell={cell} total={sectionTotal} />
            ))}
            <tr className="border-t-2 border-border">
              <td className={`${sticky} py-1.5 pr-3 font-semibold`}>순자산</td>
              {worth.map((w) => (
                <td key={w.month} className={`px-2 py-1.5 text-right font-semibold tabular-nums ${w.netWorth !== null && w.netWorth < 0 ? "text-danger" : ""}`}>
                  {w.netWorth === null ? "-" : formatWon(w.netWorth)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SectionRows({
  section,
  groups,
  months,
  valueOf,
  sticky,
  cell,
  total,
}: {
  section: AssetSection;
  groups: { name: string; items: AssetItem[] }[];
  months: string[];
  valueOf: (itemId: string, month: string) => number | null;
  sticky: string;
  cell: (key: string, v: number | null, bold?: boolean) => React.ReactNode;
  total: (section: AssetSection, month: string) => number | null;
}) {
  return (
    <>
      {groups.flatMap((g) =>
        g.items.map((i) => (
          <tr key={i.id} className="border-t border-border">
            <td className={`${sticky} py-1.5 pr-3`}>
              <span className="text-xs text-muted">{g.name} · </span>
              {i.name}
            </td>
            {months.map((mm) => cell(mm, valueOf(i.id, mm)))}
          </tr>
        )),
      )}
      <tr className="border-t border-border bg-background/60">
        <td className={`${sticky} py-1.5 pr-3 font-medium`}>{SECTION_LABEL[section]} 합계</td>
        {months.map((mm) => cell(mm, total(section, mm), true))}
      </tr>
    </>
  );
}
