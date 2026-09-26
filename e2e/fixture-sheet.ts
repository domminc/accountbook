// 테스트용 가짜 디어나 가계부 시트(xlsx). 실제 개인 데이터는 쓰지 않는다.
import writeExcelFile from "write-excel-file/node";

type Value = string | number | Date;
type Grid = Map<number, Map<number, Value>>;

function grid(cells: [row: number, col: number, value: Value][]): Grid {
  const g: Grid = new Map();
  for (const [r, c, v] of cells) {
    if (!g.has(r)) g.set(r, new Map());
    g.get(r)!.set(c, v);
  }
  return g;
}

function toSheetData(g: Grid) {
  const maxRow = Math.max(...g.keys());
  const maxCol = Math.max(...[...g.values()].flatMap((r) => [...r.keys()]));
  return Array.from({ length: maxRow + 1 }, (_, r) =>
    Array.from({ length: maxCol + 1 }, (_, c) => {
      const v = g.get(r)?.get(c);
      if (v === undefined) return null;
      if (v instanceof Date) return { value: v, type: Date, format: "yyyy-mm-dd" };
      return { value: v };
    }),
  );
}

const d = (s: string) => new Date(`${s}T00:00:00Z`);
// 열: B=1 C=2 E=4 F=5 H=7 I=8 J=9 K=10 L=11 M=12 N=13 S=18 T=19 U=20 V=21 W=22 X=23 Y=24 Z=25

export const FIXTURE_YEAR = 2024;

export async function buildFixtureSheet(filePath: string) {
  const settings = grid([
    [1, 1, "지출방법(최대 10개)"],
    [1, 2, "체크카드"],
    [1, 3, "현금"],
    [2, 1, "가계부 시작 년도"],
    [2, 2, FIXTURE_YEAR],
    [2, 4, 1],
    [2, 6, 1],
    [5, 1, "수입"],
    [5, 2, "월급"],
    [6, 1, "저축"],
    [6, 2, "적금"],
    [7, 1, "고정지출"],
    [7, 2, "통신비"],
    [8, 1, "식비"],
    [8, 2, "마트"],
    [8, 3, "외식"],
  ]);

  const jan = grid([
    [14, 4, "반성"],
    [14, 7, "날짜"],
    [14, 8, "예산"],
    [14, 9, "내용"],
    [15, 7, d("2024-01-20")],
    [15, 8, 50000],
    [15, 9, "결혼식"],
    [5, 18, "No"],
    [5, 19, "* 날짜"],
    [6, 19, d("2024-01-05")],
    [6, 21, 55000],
    [6, 22, "고정지출"],
    [6, 23, "통신비"],
    [6, 24, "체크카드"],
    [28, 18, "No"],
    [28, 19, "* 날짜"],
    [29, 19, d("2024-01-10")],
    [29, 20, "급여"],
    [29, 21, 3000000],
    [29, 22, "수입"],
    [29, 23, "월급"],
    [30, 19, d("2024-01-12")],
    [30, 20, "장보기"],
    [30, 21, 120000],
    [30, 22, "식비"],
    [30, 23, "마트"],
    [30, 24, "현금"],
    [30, 25, "반성"],
    [31, 19, d("2024-01-15")],
    [31, 21, 7000],
    [34, 1, "목표 관리 (자동 계산 / [목표]는 직접 입력)"],
    [36, 1, "수입"],
    [36, 2, 3500000],
    [36, 9, "보너스 모으기"],
    [54, 1, "주간별 고정지출 내역 정리 (자동 계산 / [예산]은 직접 입력)"],
    [56, 1, "고정지출"],
    [56, 2, 60000],
    [67, 1, "주간별 비고정지출 내역 정리 (자동 계산 / [예산]은 직접 입력)"],
    [69, 1, "식비"],
    [69, 2, 100000],
  ]);

  const feb = grid([
    [28, 18, "No"],
    [28, 19, "* 날짜"],
    [29, 19, d("2024-02-03")],
    [29, 21, 30000],
    [29, 22, "식비"],
    [29, 23, "외식"],
    [29, 24, "체크카드"],
  ]);

  const reserve = grid([
    [8, 1, "* 분류"],
    [8, 9, "No"],
    [8, 10, "* 날짜"],
    [9, 1, "경조사"],
    [9, 5, "메모"],
    [9, 10, d("2024-01-20")],
    [9, 11, "결혼식"],
    [9, 12, 100000],
    [9, 13, "경조사"],
    [24, 1, "날짜"],
    [24, 2, "* 입금 금액 (or 예산)"],
    [25, 1, d("2024-01-02")],
    [25, 2, 500000],
    [25, 3, "경조사"],
    [25, 4, "적립"],
  ]);

  await writeExcelFile([
    { sheet: "설정", data: toSheetData(settings) },
    { sheet: "1", data: toSheetData(jan) },
    { sheet: "2", data: toSheetData(feb) },
    { sheet: "예비비", data: toSheetData(reserve) },
  ]).toFile(filePath);
}
