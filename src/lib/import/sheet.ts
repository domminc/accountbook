// 참고 시트(디어나 가계부 v8·v9) xlsx 구조를 읽어 가져오기 데이터로 바꾼다.
// 셀 위치는 스크립트가 소분류 개수에 따라 표를 다시 만들기 때문에 고정 주소 대신 표 제목·머리글로 찾는다.
// 브라우저와 Node 양쪽에서 쓰도록 xlsx 읽기와 분리된 순수 함수다.
import { addMonths } from "../month";

export type Cell = string | number | boolean | Date | null | undefined;
export type SheetInput = { sheet: string; data: Cell[][] };

export type ImportKind = "income" | "saving" | "fixed_expense" | "variable_expense";

export type ImportData = {
  year: number;
  version: string | null;
  groups: { name: string; kind: ImportKind; categories: string[] }[];
  paymentMethods: string[];
  tags: string[];
  transactions: {
    date: string;
    amount: number;
    memo: string | null;
    group: string | null;
    category: string | null;
    paymentMethod: string | null;
    tag: string | null;
  }[];
  budgets: { month: string; group: string; amount: number }[];
  goals: { month: string; kind: "income" | "saving" | "expense"; amount: number; note: string | null }[];
  events: { date: string; budget: number | null; content: string }[];
  reserve: {
    categories: { name: string; note: string | null }[];
    ins: { date: string; amount: number; category: string; memo: string | null }[];
    outs: { date: string; amount: number; category: string; memo: string | null; note: string | null }[];
  };
  warnings: string[];
};

// 열 번호 (A=0)
const COL = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12, N: 13, O: 14, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25 };

/** 시트 대분류 이름으로 종류를 정한다 (시트 규칙: 수입·저축·고정지출 고정, 나머지는 비고정지출) */
export function kindOfGroupName(name: string): ImportKind {
  if (name === "수입") return "income";
  if (name === "저축") return "saving";
  if (name === "고정지출") return "fixed_expense";
  return "variable_expense";
}

const pad = (n: number) => String(n).padStart(2, "0");

function text(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function num(v: Cell): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\s원₩]/g, ""));
    return v.trim() && Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 날짜 셀 → 'YYYY-MM-DD'. 엑셀 일련번호나 '2026. 1. 5' 같은 글자도 받는다. */
export function toDate(v: Cell): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    return new Date(Math.round((v - 25569) * 86400_000)).toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const m = /^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/.exec(v.trim());
    if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  }
  return null;
}

const cell = (rows: Cell[][], r: number, c: number): Cell => rows[r]?.[c];

function findSheet(sheets: SheetInput[], name: string) {
  return sheets.find((s) => s.sheet.trim() === name)?.data ?? null;
}

export function parseWorkbook(sheets: SheetInput[]): ImportData {
  const warnings: string[] = [];
  const settings = findSheet(sheets, "설정");
  if (!settings) throw new Error("\"설정\" 탭이 없어요. 디어나 가계부 시트 파일인지 확인해 주세요.");

  // ── 설정: 시작 연·월, 대분류·소분류, 지출방법 ──
  const year = num(cell(settings, 2, COL.C));
  const startMonth = num(cell(settings, 2, COL.E)) ?? 1;
  if (!year || year < 2000 || year > 2100) throw new Error("\"설정\" 탭에서 가계부 시작 연도를 읽지 못했어요.");
  if (num(cell(settings, 2, 6)) !== null && num(cell(settings, 2, 6)) !== 1) {
    warnings.push("시트의 가계부 시작일이 1일이 아니에요. 웹 가계부는 달력 월(1일~말일) 기준으로 합계를 내요.");
  }
  const version = text(cell(settings, 2, COL.T));

  const groups = new Map<string, { name: string; kind: ImportKind; categories: string[] }>();
  const addCategory = (groupName: string, category: string) => {
    let g = groups.get(groupName);
    if (!g) {
      g = { name: groupName, kind: kindOfGroupName(groupName), categories: [] };
      groups.set(groupName, g);
    }
    if (!g.categories.includes(category)) g.categories.push(category);
  };
  for (let r = 5; r <= 28; r++) {
    const name = text(cell(settings, r, COL.B));
    if (!name) continue;
    for (let c = COL.C; c <= COL.C + 14; c++) {
      const sub = text(cell(settings, r, c));
      if (sub) addCategory(name, sub);
    }
    if (!groups.has(name)) groups.set(name, { name, kind: kindOfGroupName(name), categories: [] });
  }

  const paymentMethods: string[] = [];
  for (let c = COL.C; c <= COL.C + 9; c++) {
    const pm = text(cell(settings, 1, c));
    if (pm && !paymentMethods.includes(pm)) paymentMethods.push(pm);
  }

  const tags: string[] = [];
  const transactions: ImportData["transactions"] = [];
  const budgets: ImportData["budgets"] = [];
  const goals: ImportData["goals"] = [];
  const events: ImportData["events"] = [];

  // ── 월별시트 1~12 ──
  for (let n = 1; n <= 12; n++) {
    const rows = findSheet(sheets, String(n));
    if (!rows) continue;
    const month = addMonths(`${year}-${pad(startMonth)}`, n - 1);

    for (let r = 14; r <= 23; r++) {
      const tag = text(cell(rows, r, COL.E));
      if (tag && !tags.includes(tag)) tags.push(tag);
    }

    // 거래: "No / * 날짜" 머리글(고정지출 표, 수입·저축·지출 표) 아래 행
    const firstHeader = rows.findIndex((row) => text(row?.[COL.S]) === "No" && (text(row?.[COL.T]) ?? "").includes("날짜"));
    if (firstHeader >= 0) {
      for (let r = firstHeader + 1; r < rows.length; r++) {
        const row = rows[r] ?? [];
        if (text(row[COL.S]) === "No") continue;
        const date = toDate(row[COL.T]);
        const amount = num(row[COL.V]);
        if (!date || amount === null) continue;
        if (amount <= 0 || !Number.isInteger(amount)) {
          warnings.push(`${n}번 시트 ${r + 1}행: 금액(${amount})이 1원 이상 정수가 아니라 건너뛰었어요.`);
          continue;
        }
        const group = text(row[COL.W]);
        const category = text(row[COL.X]);
        const paymentMethod = text(row[COL.Y]);
        const tag = text(row[COL.Z]);
        // 대분류·소분류가 모두 있어야 분류된 거래 (시트도 둘 중 하나라도 없으면 집계하지 않는다)
        const classified = group && category;
        if (classified) addCategory(group, category);
        if (paymentMethod && !paymentMethods.includes(paymentMethod)) paymentMethods.push(paymentMethod);
        if (tag && !tags.includes(tag)) tags.push(tag);
        transactions.push({
          date,
          amount,
          memo: text(row[COL.U])?.slice(0, 200) ?? null,
          group: classified ? group : null,
          category: classified ? category : null,
          paymentMethod,
          tag,
        });
      }
    }

    // 목표 관리 표: B열 수입/저축/지출, C열 목표, J열 세부 목표
    const goalTitle = rows.findIndex((row) => (text(row?.[COL.B]) ?? "").startsWith("목표 관리"));
    const weeklyTitle = rows.findIndex((row) => (text(row?.[COL.B]) ?? "").startsWith("주간별 고정지출"));
    if (goalTitle >= 0) {
      const end = weeklyTitle > goalTitle ? weeklyTitle : goalTitle + 60;
      for (let r = goalTitle + 1; r < end; r++) {
        const label = text(cell(rows, r, COL.B));
        const kind = label === "수입" ? "income" : label === "저축" ? "saving" : label === "지출" ? "expense" : null;
        if (!kind) continue;
        const amount = num(cell(rows, r, COL.C));
        const note = text(cell(rows, r, COL.J))?.slice(0, 500) ?? null;
        if ((amount && amount > 0) || note) goals.push({ month, kind, amount: Math.max(0, Math.round(amount ?? 0)), note });
      }
    }

    // 주간별 표: 대분류 이름이 있는 행의 C열이 그 대분류 예산
    if (weeklyTitle >= 0) {
      for (let r = weeklyTitle + 1; r < rows.length; r++) {
        const label = text(cell(rows, r, COL.B));
        if (!label || label === "대분류" || label.endsWith("합계") || label.startsWith("총 ") || label.startsWith("주간별")) continue;
        const amount = num(cell(rows, r, COL.C));
        if (amount && amount > 0) budgets.push({ month, group: label, amount: Math.round(amount) });
      }
    }

    // 이달의 이벤트: "날짜 / 예산 / 내용" 머리글 아래, 날짜가 있는 행만
    const eventHeader = rows.findIndex((row) => text(row?.[COL.H]) === "날짜" && text(row?.[COL.I]) === "예산");
    if (eventHeader >= 0) {
      for (let r = eventHeader + 1; r < Math.min(eventHeader + 30, goalTitle >= 0 ? goalTitle : rows.length); r++) {
        const date = toDate(cell(rows, r, COL.H));
        const content = text(cell(rows, r, COL.J));
        if (!date || !content) continue;
        const budget = num(cell(rows, r, COL.I));
        events.push({ date, budget: budget && budget > 0 ? Math.round(budget) : null, content: content.slice(0, 200) });
      }
    }
  }

  // ── 예비비 ──
  const reserve: ImportData["reserve"] = { categories: [], ins: [], outs: [] };
  const rs = findSheet(sheets, "예비비");
  if (rs) {
    const catHeader = rs.findIndex((row) => (text(row?.[COL.B]) ?? "").replace("*", "").trim() === "분류");
    if (catHeader >= 0) {
      for (let r = catHeader + 1; r < catHeader + 20; r++) {
        const name = text(cell(rs, r, COL.B));
        if (!name) break;
        reserve.categories.push({ name, note: text(cell(rs, r, COL.F)) });
      }
    }
    const addReserveCategory = (name: string) => {
      if (!reserve.categories.some((c) => c.name === name)) reserve.categories.push({ name, note: null });
    };

    const inHeader = rs.findIndex((row) => text(row?.[COL.B]) === "날짜" && (text(row?.[COL.C]) ?? "").includes("입금"));
    if (inHeader >= 0) {
      for (let r = inHeader + 1; r < rs.length; r++) {
        const date = toDate(cell(rs, r, COL.B));
        const amount = num(cell(rs, r, COL.C));
        const category = text(cell(rs, r, COL.D));
        if (!date || !amount || amount <= 0 || !category) continue;
        addReserveCategory(category);
        reserve.ins.push({ date, amount: Math.round(amount), category, memo: text(cell(rs, r, COL.E)) });
      }
    }

    const outHeader = rs.findIndex((row) => text(row?.[COL.J]) === "No" && (text(row?.[COL.K]) ?? "").includes("날짜"));
    if (outHeader >= 0) {
      for (let r = outHeader + 1; r < rs.length; r++) {
        const date = toDate(cell(rs, r, COL.K));
        const amount = num(cell(rs, r, COL.M));
        const category = text(cell(rs, r, COL.N));
        if (!date || !amount || amount <= 0 || !category) continue;
        addReserveCategory(category);
        reserve.outs.push({
          date,
          amount: Math.round(amount),
          category,
          memo: text(cell(rs, r, COL.L))?.slice(0, 200) ?? null,
          note: text(cell(rs, r, COL.O))?.slice(0, 200) ?? null,
        });
      }
    }
  }

  return {
    year,
    version,
    groups: [...groups.values()],
    paymentMethods,
    tags,
    transactions,
    budgets,
    goals,
    events,
    reserve,
    warnings,
  };
}

/** 시작 날짜 이전 거래·예비비·이벤트를 뺀다. (예: 2025-11-01부터 실사용) */
export function applyCutoff(data: ImportData, from: string | null): { data: ImportData; skipped: number } {
  if (!from) return { data, skipped: 0 };
  const keep = <T extends { date: string }>(list: T[]) => list.filter((x) => x.date >= from);
  const fromMonth = from.slice(0, 7);
  const next: ImportData = {
    ...data,
    transactions: keep(data.transactions),
    events: keep(data.events),
    budgets: data.budgets.filter((b) => b.month >= fromMonth),
    goals: data.goals.filter((g) => g.month >= fromMonth),
    reserve: { ...data.reserve, ins: keep(data.reserve.ins), outs: keep(data.reserve.outs) },
  };
  const skipped =
    data.transactions.length - next.transactions.length +
    (data.reserve.ins.length - next.reserve.ins.length) +
    (data.reserve.outs.length - next.reserve.outs.length);
  return { data: next, skipped };
}

/** 미리보기용 월별 합계 (시트 이달의 정리와 같은 규칙) */
export function previewByMonth(data: ImportData) {
  const kindOf = new Map(data.groups.map((g) => [g.name, g.kind]));
  const months = new Map<string, { count: number; income: number; saving: number; expense: number; uncategorized: number }>();
  for (const t of data.transactions) {
    const m = t.date.slice(0, 7);
    const row = months.get(m) ?? { count: 0, income: 0, saving: 0, expense: 0, uncategorized: 0 };
    row.count += 1;
    const kind = t.group ? kindOf.get(t.group) : undefined;
    if (!kind) row.uncategorized += 1;
    else if (kind === "income") row.income += t.amount;
    else if (kind === "saving") row.saving += t.amount;
    else row.expense += t.amount;
    months.set(m, row);
  }
  return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));
}
