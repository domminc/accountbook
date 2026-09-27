import { isValidDate } from "./month";
import { findIssuer, inferYear, type ParsedMessage } from "./sms";

// 카드사 이용내역·명세서 파일(xls·xlsx·csv·pdf) → 거래 후보.
// 표 파일은 머리글(이용일·가맹점·이용금액 등)로 열을 찾고, 머리글이 없거나 PDF 면 줄마다 "날짜 … 가맹점 … 금액" 모양을 찾는다.
// 파일은 브라우저에서 글자로만 바꿔 보내고(src/lib/statement-file.ts), 여기서는 글자만 다룬다.

export type StatementInput = {
  /** 표 파일: 시트의 칸 글자 (여러 시트면 이어 붙인 것) */
  rows?: string[][];
  /** PDF: 한 줄씩 */
  lines?: string[];
  fileName?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

const FULL_DATE = /(?<!\d)(\d{4}|\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?!\d)\s*일?/;
const COMPACT_DATE = /(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/;
const SHORT_DATE = /(?<![\d.,])(\d{1,2})\s*[./]\s*(\d{1,2})(?![\d.,])/;
const TIME = /(?<!\d)(\d{1,2}):(\d{2})(?::\d{2})?(?!\d)/;

/** 칸·줄에서 날짜(와 시각). 연도가 없으면(09.01) 오늘 기준으로 추정 */
export function parseDateText(text: string, today: string): { date: string; time: string | null; end: number; index: number } | null {
  let date: string | null = null;
  let m: RegExpExecArray | null;
  if ((m = FULL_DATE.exec(text))) {
    const y = m[1].length === 2 ? 2000 + Number(m[1]) : Number(m[1]);
    date = `${y}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  } else if ((m = COMPACT_DATE.exec(text))) {
    date = `${m[1]}-${m[2]}-${m[3]}`;
  } else if ((m = SHORT_DATE.exec(text))) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) date = inferYear(mo, d, today);
  }
  if (!m || !date || !isValidDate(date)) return null;
  let end = m.index + m[0].length;
  const t = TIME.exec(text.slice(end));
  let time: string | null = null;
  if (t && text.slice(end, end + t.index).trim() === "") {
    const h = Number(t[1]);
    if (h <= 23) time = `${pad(h)}:${t[2]}`;
    end += t.index + t[0].length;
  }
  return { date, time, end, index: m.index };
}

/** 금액 칸: "12,500", "12,500원", "-12,500", "(12,500)" → 원 (부호 포함). 숫자가 아니면 null */
export function parseAmountText(text: string): number | null {
  const s = text.replace(/[원₩\s]/g, "");
  const m = /^(-)?\(?(-)?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\)?(-)?$/.exec(s);
  if (!m) return null;
  const n = Math.round(Number(m[3].replace(/,/g, "") + (m[4] ?? "")));
  if (!Number.isFinite(n)) return null;
  const negative = !!(m[1] || m[2] || m[5] || /^\(.*\)$/.test(s));
  return negative ? -n : n;
}

const norm = (h: string) => h.replace(/\([^)]*\)/g, "").replace(/[\s·/_-]+/g, "");

type Columns = {
  date: number;
  time: number;
  merchant: number;
  amount: number;
  cancel: number;
  installment: number;
  card: number;
};

const AMOUNT_EXCLUDE = /해외|외화|현지|달러|USD|수수료|잔액|할인|포인트|적립|누적|이자|원금|결제후|환율|한도|캐시백/i;
const AMOUNT_PREFERRED = /^(국내)?(이용|승인|거래|매출|사용)금액/;

/** 머리글 줄이면 열 위치, 아니면 null */
export function findColumns(row: string[]): Columns | null {
  const h = row.map((c) => norm(c ?? ""));
  const find = (re: RegExp, skip: number[] = []) => h.findIndex((x, i) => !skip.includes(i) && x.length <= 20 && re.test(x));

  const date = find(/^(이용|승인|거래|사용|매출)?(일자|일시|일|날짜)$|^(이용|승인|거래|사용|매출)(일자|일시|일)/);
  const amounts = h.map((x, i) => ({ x, i })).filter(({ x }) => x.length <= 20 && /금액/.test(x) && !AMOUNT_EXCLUDE.test(x));
  const amount = (amounts.find(({ x }) => AMOUNT_PREFERRED.test(x)) ?? amounts[0])?.i ?? -1;
  if (date < 0 || amount < 0) return null;
  const used = [date, amount];
  const time = find(/^(이용|승인|거래|사용|매출)?(시간|시각)$/, used);
  const merchant = find(/가맹점|이용하신곳|이용처|사용처|거래처|상호|적요|이용내역|내용/, used);
  const card = find(/카드/, [...used, merchant]);
  const installment = find(/할부|결제방법|이용구분|결제구분|일시불/, [...used, merchant, card]);
  const cancel = find(/취소|상태|승인구분|매출구분|거래구분|^구분$/, [...used, merchant, card, installment]);
  return { date, time, merchant, amount, cancel, installment, card };
}

function installmentOf(cell: string, header: string): string | null {
  const s = cell.trim();
  if (!s) return null;
  if (/일시불/.test(s)) return "일시불";
  const m = /(\d{1,2})\s*개월/.exec(s);
  if (m) return Number(m[1]) <= 1 ? "일시불" : `${Number(m[1])}개월`;
  if (/^\d{1,2}$/.test(s) && /할부/.test(header)) return Number(s) <= 1 ? "일시불" : `${Number(s)}개월`;
  return null;
}

const cardHintOf = (s: string) => /([\d*]{4})(?![\s\S]*[\d*]{4})/.exec(s)?.[1] ?? null;

function parseTable(rows: string[][], today: string, fileIssuer: string | null): ParsedMessage[] | null {
  const out: ParsedMessage[] = [];
  let cols: Columns | null = null;
  let header: string[] = [];
  let found = false;
  for (const row of rows) {
    // 머리글은 시트마다 다시 나올 수 있다 (여러 시트·여러 카드)
    const c = findColumns(row);
    if (c) {
      cols = c;
      header = row.map((x) => norm(x ?? ""));
      found = true;
      continue;
    }
    if (!cols) continue;
    const cell = (i: number) => (i >= 0 ? String(row[i] ?? "").trim() : "");
    const merchant = cell(cols.merchant).replace(/\s+/g, " ");
    if (/^(합계|소계|총계|합\s*계|총\s*합계)/.test(merchant) || /^(합계|소계|총계)/.test(cell(cols.date))) continue;
    const d = parseDateText(`${cell(cols.date)} ${cell(cols.time)}`, today);
    const signed = parseAmountText(cell(cols.amount));
    if (!d || signed === null || signed === 0) continue;
    const cardText = cell(cols.card);
    const status = `${cell(cols.cancel)} ${cell(cols.installment)}`;
    out.push({
      raw: row.map((x) => String(x ?? "").trim()).filter(Boolean).join(" | "),
      date: d.date,
      dateGuessed: false,
      time: d.time,
      amount: Math.abs(signed),
      merchant: merchant.slice(0, 100),
      issuer: findIssuer(cardText) ?? fileIssuer,
      cardHint: cardText ? cardHintOf(cardText) : null,
      installment: installmentOf(cell(cols.installment), header[cols.installment] ?? ""),
      cancelled: signed < 0 || /취소|거절/.test(status),
    });
  }
  return found ? out : null;
}

const SKIP_LINE = /합\s*계|소\s*계|총\s*계|합계금액|결제\s*(예정\s*)?금액\s*합/;
const MONEY_COMMA = /^-?\(?\d{1,3}(?:,\d{3})+\)?-?원?$/;
const MONEY_PLAIN = /^-?\d{3,}원?$/;
const NOISE_TOKEN = /^([\d*]{4}(-[\d*]{4}){0,3}|본인|가족|국내|해외|일시불|할부|\d{1,2}개월|[\d:]+)$/;

/** PDF·머리글 없는 표: 줄마다 "날짜 [시각] … 가맹점 … 금액 …" */
function parseLines(lines: string[], today: string, fileIssuer: string | null): ParsedMessage[] {
  const out: ParsedMessage[] = [];
  for (const raw of lines) {
    const line = raw.replace(/[ \t ]+/g, " ").trim();
    if (!line || SKIP_LINE.test(line)) continue;
    const d = parseDateText(line, today);
    // 날짜는 줄 앞쪽에 있어야 한다 (가맹점 이름 속 숫자에 속지 않게)
    if (!d || d.index > 12) continue;
    const tokens = line.slice(d.end).trim().split(" ").filter(Boolean);
    let ai = tokens.findIndex((t) => MONEY_COMMA.test(t));
    if (ai < 0) ai = tokens.findIndex((t, i) => MONEY_PLAIN.test(t) && !(i === 0 && /^\d{4}$/.test(t)));
    if (ai < 0) continue;
    const signed = parseAmountText(tokens[ai]);
    if (signed === null || signed === 0) continue;
    const before = tokens.slice(0, ai);
    const merchant = before.filter((t) => !NOISE_TOKEN.test(t)).join(" ");
    const after = tokens.slice(ai + 1).join(" ");
    const inst = /일시불/.test(line) ? "일시불" : (/(\d{1,2})\s*개월/.exec(after)?.[1] ?? null);
    out.push({
      raw: line,
      date: d.date,
      dateGuessed: false,
      time: d.time,
      amount: Math.abs(signed),
      merchant: merchant.slice(0, 100),
      // 줄 속 카드사는 "…카드" 낱말에서만 (가맹점 "롯데마트"에 속지 않게)
      issuer: findIssuer(before.filter((t) => /카드/.test(t)).join(" ")) ?? fileIssuer,
      cardHint: before.map((t) => /^[\d*]{4}(?:-[\d*]{4}){0,3}$/.test(t) ? cardHintOf(t) : null).find(Boolean) ?? null,
      installment: inst && inst !== "일시불" ? (Number(inst) <= 1 ? "일시불" : `${Number(inst)}개월`) : inst,
      cancelled: signed < 0 || /취소|거절/.test(line),
    });
  }
  return out;
}

/** 파일 이름·거래 앞쪽 글자(제목 등)에서 카드사. 가맹점 이름("하나로마트")에 속지 않게 거래 줄은 보지 않는다 */
function issuerOfFile(input: StatementInput, today: string): string | null {
  const head: string[] = [input.fileName ?? ""];
  for (const r of (input.rows ?? []).slice(0, 30)) {
    if (findColumns(r)) break;
    head.push(r.join(" "));
  }
  for (const l of (input.lines ?? []).slice(0, 30)) {
    const d = parseDateText(l, today);
    if (d && d.index <= 12) break;
    head.push(l);
  }
  return findIssuer(head.join("\n"));
}

/** 이 앱으로 가져오는 가계부 시트(월 시트의 "이달의 고정지출 내역" 표)를 카드 파일로 잘못 올렸는지 */
export function isLedgerSheet(input: StatementInput): boolean {
  return (input.rows ?? []).some((r) => r.some((c) => /이달의\s*(고정지출|수입\s*저축\s*지출)\s*내역/.test(c)));
}

const merchantKey = (s: string) => s.replace(/승인취소|취소|\s+/g, "").toLowerCase();

/**
 * 파일 속 거래 후보. 같은 파일 안에서 취소(음수) 줄과 짝이 맞는 원래 거래는 둘 다 뺀다 (합치면 0원).
 * 짝이 없는 취소는 남겨 두어 화면에서 알려 준다 (지난달에 입력한 거래의 취소 등).
 */
export function parseStatement(input: StatementInput, today: string): { messages: ParsedMessage[]; cancelledPairs: number } {
  const issuer = issuerOfFile(input, today);
  let list: ParsedMessage[];
  if (input.rows && input.rows.length > 0) {
    list = parseTable(input.rows, today, issuer) ?? parseLines(input.rows.map((r) => r.filter((c) => c !== "").join(" ")), today, issuer);
  } else {
    list = parseLines(input.lines ?? [], today, issuer);
  }
  list.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));

  const removed = new Set<ParsedMessage>();
  let cancelledPairs = 0;
  for (const c of list) {
    if (!c.cancelled || removed.has(c)) continue;
    const original = list.find(
      (o) => !o.cancelled && !removed.has(o) && o.amount === c.amount && o.date <= c.date && merchantKey(o.merchant) === merchantKey(c.merchant),
    );
    if (!original) continue;
    removed.add(original).add(c);
    cancelledPairs++;
  }
  return { messages: list.filter((m) => !removed.has(m)), cancelledPairs };
}
