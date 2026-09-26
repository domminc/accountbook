// 대한민국 공휴일 (관공서의 공휴일에 관한 규정, 2026년 개정 반영).
// 음력 공휴일(설날·부처님오신날·추석)은 korean-lunar-calendar(한국천문연구원 자료)로 계산하고,
// 대체공휴일은 규정대로 만든다. 선거일·임시공휴일은 정해질 때마다 EXTRA 에 더한다.
import KoreanLunarCalendar from "korean-lunar-calendar";

/** 규정으로 정하지 않고 그때그때 지정되는 공휴일 */
const EXTRA: Record<string, string> = {
  "2025-01-27": "임시공휴일",
  "2025-06-03": "대통령 선거일",
  "2026-06-03": "지방선거일",
  "2028-04-12": "국회의원 선거일",
};

// 대체공휴일 규칙
// - "weekend": 토·일 또는 다른 공휴일과 겹치면 (삼일절·노동절·어린이날·부처님오신날·제헌절·광복절·개천절·한글날·성탄절)
// - "sunday": 일요일 또는 다른 공휴일과 겹치면 (설날·추석 연휴)
// - "none": 없음 (신정·현충일·선거일)
type SubRule = "weekend" | "sunday" | "none";
type Base = { date: string; name: string; rule: SubRule; group: string };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
};
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일 … 6=토

function lunarToSolar(year: number, month: number, day: number): string {
  const c = new KoreanLunarCalendar();
  if (!c.setLunarDate(year, month, day, false)) throw new Error(`음력 변환 실패: ${year}-${month}-${day}`);
  const s = c.getSolarCalendar();
  return `${s.year}-${pad(s.month)}-${pad(s.day)}`;
}

function baseHolidays(year: number): Base[] {
  const fixed = (md: string, name: string, rule: SubRule): Base => ({ date: `${year}-${md}`, name, rule, group: name });
  const seollal = lunarToSolar(year, 1, 1);
  const chuseok = lunarToSolar(year, 8, 15);
  const list: Base[] = [
    fixed("01-01", "신정", "none"),
    { date: addDays(seollal, -1), name: "설날 연휴", rule: "sunday", group: "설날" },
    { date: seollal, name: "설날", rule: "sunday", group: "설날" },
    { date: addDays(seollal, 1), name: "설날 연휴", rule: "sunday", group: "설날" },
    fixed("03-01", "삼일절", "weekend"),
    fixed("05-05", "어린이날", "weekend"),
    { date: lunarToSolar(year, 4, 8), name: "부처님오신날", rule: "weekend", group: "부처님오신날" },
    fixed("06-06", "현충일", "none"),
    fixed("08-15", "광복절", "weekend"),
    { date: addDays(chuseok, -1), name: "추석 연휴", rule: "sunday", group: "추석" },
    { date: chuseok, name: "추석", rule: "sunday", group: "추석" },
    { date: addDays(chuseok, 1), name: "추석 연휴", rule: "sunday", group: "추석" },
    fixed("10-03", "개천절", "weekend"),
    fixed("10-09", "한글날", "weekend"),
    fixed("12-25", "성탄절", "weekend"),
  ];
  // 2026년부터 노동절(5/1) 신설, 제헌절(7/17) 부활
  if (year >= 2026) list.push(fixed("05-01", "노동절", "weekend"), fixed("07-17", "제헌절", "weekend"));
  return list;
}

const cache = new Map<number, Map<string, string>>();

/** 그해 공휴일: 날짜(YYYY-MM-DD) → 이름. 대체공휴일 포함 */
export function holidaysOf(year: number): Map<string, string> {
  const hit = cache.get(year);
  if (hit) return hit;

  const base = baseHolidays(year);
  const result = new Map<string, string>();
  for (const b of base) result.set(b.date, result.has(b.date) ? `${result.get(b.date)}·${b.name}` : b.name);
  for (const [date, name] of Object.entries(EXTRA)) {
    if (date.startsWith(`${year}-`)) result.set(date, result.has(date) ? `${result.get(date)}·${name}` : name);
  }

  const countOn = (date: string) => base.filter((b) => b.date === date).length + (EXTRA[date] ? 1 : 0);
  const taken = new Set(result.keys());
  const nextFreeWeekday = (after: string) => {
    let d = addDays(after, 1);
    while (weekday(d) === 0 || weekday(d) === 6 || taken.has(d)) d = addDays(d, 1);
    return d;
  };

  // 휴일 묶음(설날·추석은 3일)마다 대체공휴일이 필요한지 본다. 같은 날 겹친 휴일은 대체공휴일 하나.
  const groups = new Map<string, Base[]>();
  for (const b of base) groups.set(b.group, [...(groups.get(b.group) ?? []), b]);
  const subs: { after: string; name: string }[] = [];
  const doneDates = new Set<string>();
  for (const days of groups.values()) {
    const rule = days[0].rule;
    if (rule === "none") continue;
    const needs = days.some((b) => {
      const w = weekday(b.date);
      const onWeekend = rule === "weekend" ? w === 0 || w === 6 : w === 0;
      return onWeekend || countOn(b.date) > 1;
    });
    if (!needs) continue;
    // 같은 날 겹친 두 휴일(예: 2025-05-05 어린이날·부처님오신날)은 한 번만
    const key = days.map((b) => b.date).join(",");
    if (days.length === 1 && doneDates.has(key)) continue;
    doneDates.add(key);
    subs.push({ after: days[days.length - 1].date, name: days[0].group });
  }
  subs.sort((a, b) => a.after.localeCompare(b.after));
  for (const s of subs) {
    const d = nextFreeWeekday(s.after);
    taken.add(d);
    result.set(d, `대체공휴일 (${s.name})`);
  }

  const sorted = new Map([...result.entries()].sort(([a], [b]) => a.localeCompare(b)));
  cache.set(year, sorted);
  return sorted;
}

export function holidayName(date: string): string | null {
  return holidaysOf(Number(date.slice(0, 4))).get(date) ?? null;
}

/** 달력 날짜 색: 일요일·공휴일은 빨강, 토요일은 파랑 */
export function dayTone(date: string): "holiday" | "sunday" | "saturday" | null {
  if (holidayName(date)) return "holiday";
  const w = weekday(date);
  return w === 0 ? "sunday" : w === 6 ? "saturday" : null;
}
