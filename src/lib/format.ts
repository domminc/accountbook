import { formatWon } from "./money";

/** 0.1621 → '16.2%' */
export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** 달력 칸처럼 좁은 곳: 12000 → '1.2만' */
export function formatCompact(amount: number): string {
  return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(amount);
}

/** 전월 대비: '+12,000' / '-3,000' / '0' */
export function formatDelta(delta: number): string {
  return delta > 0 ? `+${formatWon(delta)}` : delta < 0 ? `-${formatWon(-delta)}` : "0";
}
