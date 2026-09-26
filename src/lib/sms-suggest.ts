// 문자에서 읽은 거래에 지출방법·소분류를 채우고, 이미 입력한 거래인지 표시한다.
import type { ParsedMessage } from "./sms";

export type SuggestContext = {
  /** 카드 관리에 등록한 카드 (지출방법을 연결한 것만 의미 있음) */
  cards: { name: string; issuer: string | null; paymentMethodId: string | null }[];
  paymentMethods: { id: string; name: string }[];
  /** 가맹점(내용) → 가장 최근에 쓴 소분류·지출방법. 키는 normalizeMemo */
  history: Map<string, { categoryId: string | null; paymentMethodId: string | null }>;
  /** 이미 있는 거래 (날짜·금액이 같으면 중복 의심) */
  existing: { date: string; amount: number; memo: string | null }[];
};

export type PasteRow = ParsedMessage & {
  categoryId: string | null;
  paymentMethodId: string | null;
  /** 같은 날 같은 금액 거래의 내용 */
  duplicateOf: string | null;
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

export function suggestRows(messages: ParsedMessage[], ctx: SuggestContext): PasteRow[] {
  return messages.map((m) => {
    const past = m.merchant ? ctx.history.get(normalizeMemo(m.merchant)) : undefined;
    const dup =
      m.amount !== null ? ctx.existing.find((e) => e.date === m.date && e.amount === m.amount) : undefined;
    return {
      ...m,
      categoryId: past?.categoryId ?? null,
      paymentMethodId: suggestPaymentMethod(m.issuer, m.merchant, ctx),
      duplicateOf: dup ? (dup.memo ?? "내용 없음") : null,
    };
  });
}
