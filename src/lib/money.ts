export const MAX_AMOUNT = 1_000_000_000_000; // 1조

/** 12000 → '12,000' */
export function formatWon(amount: number): string {
  return amount.toLocaleString("ko-KR");
}

/** '12,000원' 같은 입력에서 숫자만 뽑는다. 1 ~ 1조 사이 정수가 아니면 null. */
export function parseAmount(input: string): number | null {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits || digits.length > 13) return null;
  const n = Number(digits);
  return n >= 1 && n <= MAX_AMOUNT ? n : null;
}
