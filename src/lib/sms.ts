import { isValidDate } from "./month";

// 카드 승인 문자·알림 붙여넣기 → 거래 후보. 카드사마다 모양이 달라서 문구 위치 대신 패턴으로 찾는다.
// 금액(…원, 누적·잔액·한도 제외), 날짜·시각(MM/DD HH:mm), 가맹점(시각 뒤 첫 글자), 카드사, 할부, 취소 여부.

export type ParsedMessage = {
  raw: string;
  /** YYYY-MM-DD. 문자에 날짜가 없으면 오늘 */
  date: string;
  dateGuessed: boolean;
  time: string | null;
  /** 원. 원화 금액을 못 찾으면 null */
  amount: number | null;
  merchant: string;
  /** 카드사 이름 (예: "신한") */
  issuer: string | null;
  /** 문자에 보이는 카드 끝자리 (가려진 자리는 *) */
  cardHint: string | null;
  installment: string | null;
  cancelled: boolean;
};

// 긴 이름 먼저 (예: "KB국민" 이 "국민" 보다 먼저)
const ISSUERS: { name: string; pattern: RegExp }[] = [
  { name: "KB국민", pattern: /KB\s*국민|국민카드|KB카드|KB체크|KB\(/i },
  { name: "신한", pattern: /신한/ },
  { name: "삼성", pattern: /삼성/ },
  { name: "현대", pattern: /현대/ },
  { name: "롯데", pattern: /롯데/ },
  { name: "하나", pattern: /하나/ },
  { name: "우리", pattern: /우리/ },
  { name: "NH농협", pattern: /NH|농협/i },
  { name: "BC", pattern: /\bBC\b|BC카드|BC\(|비씨/i },
  { name: "IBK기업", pattern: /IBK|기업/i },
  { name: "씨티", pattern: /씨티|citi/i },
  { name: "카카오뱅크", pattern: /카카오뱅크|카뱅/ },
  { name: "토스", pattern: /토스/ },
  { name: "수협", pattern: /수협/ },
  { name: "광주", pattern: /광주카드|광주은행/ },
  { name: "전북", pattern: /전북/ },
];

/** 붙여넣은 글을 문자 하나씩으로 나눈다: [Web발신] 표시가 있으면 그것으로, 없으면 빈 줄로 */
export function splitMessages(text: string): string[] {
  const t = text.replace(/\r\n?/g, "\n").trim();
  if (!t) return [];
  const marker = /\[\s*web\s*발신\s*\]/gi;
  const parts = marker.test(t) ? t.split(/\[\s*web\s*발신\s*\]/i) : t.split(/\n\s*\n/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function parseMessages(text: string, today: string): ParsedMessage[] {
  return splitMessages(text)
    .map((m) => parseMessage(m, today))
    .filter((m): m is ParsedMessage => m !== null);
}

/** 문자 하나. 금액도 날짜도 없으면 거래 문자가 아니라고 보고 null */
export function parseMessage(raw: string, today: string): ParsedMessage | null {
  const text = raw.replace(/\r\n?/g, "\n").replace(/[ \t\u00a0]+/g, " ").trim();

  const amount = findAmount(text);
  // 날짜처럼 보이는 첫 덩어리 (해외 금액 "12.50" 같은 건 월·일 범위로 거른다)
  const dt =
    [...text.matchAll(/(?<![\d.,])(\d{1,2})\s*[/.\-월]\s*(\d{1,2})(?![\d,])\s*일?\s*(?:\([월화수목금토일]\)\s*)?(?:(\d{1,2}):(\d{2}))?/g)].find(
      (m) => Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1 && Number(m[2]) <= 31,
    ) ?? null;
  const validDate = dt !== null;
  if (amount === null && !validDate) return null;

  const inferred = dt ? inferYear(Number(dt[1]), Number(dt[2]), today) : null;
  const date = inferred && isValidDate(inferred) ? inferred : today;
  const time = dt && dt[3] ? `${dt[3].padStart(2, "0")}:${dt[4]}` : null;

  const issuer = findIssuer(text);
  const card = /\(([\d*]{4})\)|([\d*]{4})\s*승인|카드\s*([\d*]{4})\b/.exec(text);
  const installment = /일시불/.test(text) ? "일시불" : (/(\d{1,2})\s*개월/.exec(text)?.[1] ?? null);

  return {
    raw: raw.trim(),
    date,
    dateGuessed: date !== inferred,
    time,
    amount,
    merchant: dt ? findMerchant(text.slice(dt.index + dt[0].length)) : "",
    issuer,
    cardHint: card ? (card[1] ?? card[2] ?? card[3]) : null,
    installment: installment && installment !== "일시불" ? `${installment}개월` : installment,
    cancelled: /취소|승인거절|거절/.test(text),
  };
}

/** 카드사: 글 앞쪽에 먼저 나오는 이름 (가맹점 이름에 든 "하나로마트" 등에 속지 않게) */
function findIssuer(text: string): string | null {
  let best: { name: string; index: number } | null = null;
  for (const i of ISSUERS) {
    const m = i.pattern.exec(text);
    if (m && (!best || m.index < best.index)) best = { name: i.name, index: m.index };
  }
  return best?.name ?? null;
}

/** 원화 금액: 누적·잔액·한도·포인트 옆 금액은 뺀다 */
function findAmount(text: string): number | null {
  const re = /(\d{1,3}(?:,\d{3})+|\d+)\s*원/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const before = text.slice(Math.max(0, m.index - 6), m.index);
    if (/누적|잔액|한도|포인트|적립|총/.test(before)) continue;
    const n = Number(m[1].replace(/,/g, ""));
    if (n > 0 && n <= 1_000_000_000_000) return n;
  }
  return null;
}

/** 날짜·시각 뒤에 오는 첫 글자 덩어리를 가맹점으로 본다 */
function findMerchant(rest: string): string {
  const cleaned = rest
    .replace(/(총\s*)?누적\s*[\d,]+\s*원?/g, "\n")
    .replace(/(잔액|한도|잔여한도)\s*[\d,]+\s*원?/g, "\n")
    .replace(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/g, "\n")
    .replace(/일시불|\(?\d{1,2}\s*개월\)?|할부|승인취소|승인|사용/g, "\n");
  for (const line of cleaned.split("\n")) {
    const s = line.replace(/^[\s/|:·,-]+|[\s/|:·,-]+$/g, "").trim();
    if (s && !/^[\d\s:/.-]+$/.test(s)) return s.slice(0, 100);
  }
  return "";
}

/** 문자에는 연도가 없다: 오늘보다 뒤 날짜면 작년 문자로 본다 (1월에 받은 12월 문자) */
function inferYear(month: number, day: number, today: string): string {
  const y = Number(today.slice(0, 4));
  const mmdd = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const year = mmdd > today.slice(5) ? y - 1 : y;
  return `${year}-${mmdd}`;
}
