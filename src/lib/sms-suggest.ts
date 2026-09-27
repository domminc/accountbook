// 문자에서 읽은 거래에 지출방법·소분류를 채우고, 이미 입력한 거래인지 표시한다.
import type { ParsedMessage } from "./sms";

export type SuggestContext = {
  /** 카드 관리에 등록한 카드 (지출방법을 연결한 것만 의미 있음) */
  cards: { name: string; issuer: string | null; paymentMethodId: string | null }[];
  paymentMethods: { id: string; name: string }[];
  /** 가맹점(내용) → 가장 최근에 쓴 소분류·지출방법·태그. 키는 normalizeMemo */
  history: Map<string, { categoryId: string | null; paymentMethodId: string | null; tagIds?: string[] }>;
  /** 이미 있는 거래 (같은 금액이 가까운 날·같은 달 고정지출에 있으면 중복 의심). fixed: 고정지출 소분류 */
  existing: { date: string; amount: number; memo: string | null; fixed?: boolean }[];
};

/**
 * 이미 입력한 것 같은 거래.
 * - same_day: 같은 날 같은 금액
 * - near: 3일 안에 같은 금액 (카드 승인일과 가계부에 적은 날이 다를 때)
 * - fixed_month: 같은 달 고정지출에 같은 금액 (고정지출은 정해 둔 날로 적는 일이 많다)
 */
export type Duplicate = { memo: string; date: string; kind: "same_day" | "near" | "fixed_month" };

export const NEAR_DAYS = 3;

export type PasteRow = ParsedMessage & {
  categoryId: string | null;
  paymentMethodId: string | null;
  tagIds: string[];
  duplicateOf: Duplicate | null;
};

export function normalizeMemo(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

// 카드·지출방법 이름에서 찾을 카드사 낱말
const ISSUER_WORDS: Record<string, string[]> = {
  KB국민: ["kb", "국민"],
  NH농협: ["nh", "농협"],
  IBK기업: ["ibk", "기업"],
  BC: ["bc", "비씨"],
  카카오뱅크: ["카카오뱅크", "카뱅"],
};

function matchesIssuer(name: string, issuer: string): boolean {
  const n = normalizeMemo(name);
  return (ISSUER_WORDS[issuer] ?? [issuer.toLowerCase()]).some((w) => n.includes(w));
}

/** 지출방법: 카드사가 같은 카드에 연결한 지출방법 → 이름에 카드사가 든 지출방법 → 그 가맹점에서 지난번에 쓴 것 */
export function suggestPaymentMethod(issuer: string | null, merchant: string, ctx: SuggestContext): string | null {
  if (issuer) {
    const linked = ctx.cards.filter((c) => c.paymentMethodId && matchesIssuer(`${c.issuer ?? ""} ${c.name}`, issuer));
    if (linked.length === 1) return linked[0].paymentMethodId;
    const methods = ctx.paymentMethods.filter((p) => matchesIssuer(p.name, issuer));
    if (methods.length === 1) return methods[0].id;
  }
  const past = ctx.history.get(normalizeMemo(merchant))?.paymentMethodId ?? null;
  return past && ctx.paymentMethods.some((p) => p.id === past) ? past : null;
}

const dayNumber = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000;

export function findDuplicate(date: string, amount: number, existing: SuggestContext["existing"]): Duplicate | null {
  const same = existing.filter((e) => e.amount === amount);
  const pick = (e: SuggestContext["existing"][number], kind: Duplicate["kind"]): Duplicate => ({ memo: e.memo ?? "내용 없음", date: e.date, kind });
  const sameDay = same.find((e) => e.date === date);
  if (sameDay) return pick(sameDay, "same_day");
  const near = same
    .map((e) => ({ e, d: Math.abs(dayNumber(e.date) - dayNumber(date)) }))
    .filter((x) => x.d <= NEAR_DAYS)
    .sort((a, b) => a.d - b.d)[0];
  if (near) return pick(near.e, "near");
  const fixed = same.find((e) => e.fixed && e.date.slice(0, 7) === date.slice(0, 7));
  return fixed ? pick(fixed, "fixed_month") : null;
}

export function suggestRows(messages: ParsedMessage[], ctx: SuggestContext): PasteRow[] {
  return messages.map((m) => {
    const past = m.merchant ? ctx.history.get(normalizeMemo(m.merchant)) : undefined;
    return {
      ...m,
      categoryId: past?.categoryId ?? null,
      paymentMethodId: suggestPaymentMethod(m.issuer, m.merchant, ctx),
      tagIds: past?.tagIds ?? [],
      duplicateOf: m.amount !== null ? findDuplicate(m.date, m.amount, ctx.existing) : null,
    };
  });
}
