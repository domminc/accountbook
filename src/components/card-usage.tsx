import { formatWon } from "@/lib/money";
import type { CardUsage } from "@/lib/summary";
import { Meter, meterState } from "./meter";

/** 카드별 이번 달 사용액과 매월 카드값 예산 */
export function CardUsageList({ items }: { items: CardUsage[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((c) => {
        const state = c.budget ? meterState(c.spent, c.budget) : "ok";
        return (
          <li key={c.id}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>
                {c.name}
                {state === "over" ? <span className="ml-1.5 text-xs font-semibold text-danger">▲ 초과</span> : null}
                {state === "near" ? <span className="ml-1.5 text-xs font-semibold text-warning">● 80% 넘음</span> : null}
              </span>
              <span className="tabular-nums">
                <span className="font-semibold">{formatWon(c.spent)}</span>
                <span className="text-muted"> / {c.budget ? formatWon(c.budget) : "예산 없음"}</span>
              </span>
            </div>
            {c.budget ? (
              <>
                <div className="mt-1">
                  <Meter value={c.spent} max={c.budget} kind="limit" label={`${c.name} 카드 예산 사용`} />
                </div>
                <p className="mt-0.5 text-right text-xs text-muted">
                  {c.budget - c.spent >= 0 ? `남은 예산 ${formatWon(c.budget - c.spent)}` : `${formatWon(c.spent - c.budget)} 초과`}
                </p>
              </>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
