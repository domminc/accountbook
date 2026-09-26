// 가계부 월 = 달력 월 (1일 ~ 말일). 날짜는 'YYYY-MM-DD', 월은 'YYYY-MM' 문자열로 다룬다.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");

/** 한국 시간 기준 오늘 'YYYY-MM-DD' */
export function todayKST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function currentMonthKST(now = new Date()): string {
  return todayKST(now).slice(0, 7);
}

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

/** 쿼리 문자열의 월. 잘못되면 이번 달. */
export function parseMonth(value: unknown, now = new Date()): string {
  return isValidMonth(value) ? value : currentMonthKST(now);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  return { start: `${month}-01`, end: `${month}-${pad(daysInMonth(y, m))}` };
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** 날짜를 다른 달의 같은 날로 옮긴다. 그 달에 없는 날(31일 등)은 말일로. */
export function shiftDateToMonth(date: string, month: string): string {
  const day = Number(date.slice(8, 10));
  const [y, m] = month.split("-").map(Number);
  return `${month}-${pad(Math.min(day, daysInMonth(y, m)))}`;
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** '2026-01-05' → '1월 5일 (월)' */
export function formatDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${weekday})`;
}
