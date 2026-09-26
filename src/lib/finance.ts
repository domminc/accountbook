// 자산관리 · 대출 · 결제일 계산 (docs/PLANNING.md 7장)
import { daysInMonth } from "./month";

export type AssetSection = "liability" | "non_current" | "current";
export const SECTION_LABEL: Record<AssetSection, string> = { liability: "부채", non_current: "비유동자산", current: "유동자산" };
export const SECTIONS: AssetSection[] = ["non_current", "current", "liability"];

export type AssetItem = { id: string; section: AssetSection; groupName: string; name: string; sortOrder: number; isHidden: boolean };
export type Snapshot = { itemId: string; month: string; amount: number };

/** 월별 자산·부채·순자산. 순자산 = (비유동자산 + 유동자산) − 부채. 입력이 하나도 없는 달은 null. */
export function netWorthByMonth(items: AssetItem[], snapshots: Snapshot[], months: string[]) {
  const sectionOf = new Map(items.map((i) => [i.id, i.section]));
  return months.map((month) => {
    const rows = snapshots.filter((s) => s.month === month && sectionOf.has(s.itemId));
    if (rows.length === 0) return { month, assets: null, liabilities: null, netWorth: null };
    let assets = 0;
    let liabilities = 0;
    for (const s of rows) {
      if (sectionOf.get(s.itemId) === "liability") liabilities += s.amount;
      else assets += s.amount;
    }
    return { month, assets, liabilities, netWorth: assets - liabilities };
  });
}

export type Repayment = { principal: number; interest: number };

/** 대출: 원금잔액 = 원금 − 상환원금 합, 누적이자 = 이자 합 (시트 대출 관리 H·I열) */
export function loanStatus(principal: number, repayments: Repayment[]) {
  const repaid = repayments.reduce((s, r) => s + r.principal, 0);
  const interest = repayments.reduce((s, r) => s + r.interest, 0);
  return { repaid, balance: principal - repaid, interest, progress: principal > 0 ? Math.min(repaid / principal, 1) : 0 };
}

export type DueStatus = "entered" | "upcoming" | "today" | "overdue";

/** 이번 달 결제일: 그 달에 없는 날(31일 등)은 말일 */
export function dueDate(payDay: number, month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(Math.min(payDay, daysInMonth(y, m))).padStart(2, "0")}`;
}

export function dueStatus(payDay: number, month: string, today: string, entered: boolean): { date: string; status: DueStatus; daysLeft: number } {
  const date = dueDate(payDay, month);
  const daysLeft = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400_000);
  const status: DueStatus = entered ? "entered" : daysLeft > 0 ? "upcoming" : daysLeft === 0 ? "today" : "overdue";
  return { date, status, daysLeft };
}
