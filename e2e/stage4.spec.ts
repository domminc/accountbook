import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { buildFixtureSheet } from "./fixture-sheet";
import { signupAndCreateHousehold, uid } from "./helpers";

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

test("시트 가져오기 → 이달의 정리·연간·예비비·달력·내보내기", async ({ page }, testInfo) => {
  const path = testInfo.outputPath("fixture.xlsx");
  await buildFixtureSheet(path);
  // 경로에 한글이 들어가면 파일 선택이 안 되는 경우가 있어 내용을 직접 넘긴다
  const file = {
    name: "2024 가계부.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: readFileSync(path),
  };
  await signupAndCreateHousehold(page, uid(), "민수");

  // ── 가져오기 ──
  await page.goto("/settings/data");
  await page.locator("input[type=file]").setInputFiles(file);
  const preview = page.getByRole("region", { name: "가져오기 미리보기" });
  await expect(preview).toContainText("2024년 시트");
  await expect(preview).toContainText("거래 5건");
  await expect(preview).toContainText("예비비 입금 1건 · 지출 1건");
  await expect(preview).toContainText("목표 1개 · 예산 2개 · 이벤트 1개");
  await expect(preview.locator("tbody tr").first()).toContainText("분류 필요 1");

  // 시작 날짜로 1월 5일 이전을 빼면 미리보기가 바뀐다
  await page.getByLabel("가져오기 시작 날짜").fill("2024-01-06");
  await expect(preview).toContainText("거래 4건 · 시작 날짜 이전 2건 제외");
  await page.getByLabel("가져오기 시작 날짜").fill("");

  await preview.getByRole("button", { name: "가져오기" }).click();
  await expect(page.getByRole("status")).toContainText("가져왔어요. 거래 5건 (분류 필요 1건)");

  // ── 이달의 정리 (2024-01) ──
  await page.goto("/?month=2024-01");
  const summary = page.getByRole("region", { name: "이달 요약" });
  await expect(summary).toContainText("2,825,000원"); // 3,000,000 − (55,000 + 120,000)
  await expect(page.getByRole("link", { name: /분류가 필요한 거래 1건/ })).toBeVisible();
  const goals = page.locator("section").filter({ has: page.getByRole("heading", { name: "목표 관리" }) });
  await expect(goals).toContainText("달성률 85.7%");
  await expect(goals).toContainText("보너스 모으기");
  const budget = page.locator("section").filter({ has: page.getByRole("heading", { name: "대분류별 예산" }) });
  await expect(budget.locator("li").filter({ hasText: "식비" })).toContainText("▲ 초과");
  await expect(budget.locator("li").filter({ hasText: "고정지출" })).toContainText("55,000 / 60,000");
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "이달의 이벤트" }) })).toContainText("결혼식");

  // 분류 필요 거래만 보기
  await page.goto("/transactions?month=2024-01&uncategorized=1");
  await expect(page.getByRole("link").filter({ hasText: "분류 필요" }).filter({ hasText: "7,000" })).toHaveCount(1);

  // ── 달력: 월 지출은 예비비 포함 ──
  await page.goto("/transactions/calendar?month=2024-01");
  await expect(page.locator("dl").first()).toContainText("275,000");

  // ── 연간: 총 지출 = 월 지출 + 예비비 ──
  await page.goto("/reports?year=2024");
  const annual = page.locator("dl").first();
  await expect(annual).toContainText("3,000,000");
  await expect(annual).toContainText("305,000");
  const expenseTable = page.locator("section").filter({ has: page.getByRole("heading", { name: "지출 월별 상세표" }) });
  // 지난 해이므로 평균은 12개월로 나눈다: 205,000 / 12 = 17,083
  await expect(expenseTable.locator("tr").filter({ hasText: "총 지출" })).toContainText("17,083");

  // ── 예비비: 가져온 내역 + 직접 입력 ──
  await page.goto("/reserve?year=2024");
  const totals = page.locator("dl").first();
  await expect(totals).toContainText("500,000");
  await expect(totals.locator("dd").last()).toHaveText("400,000");
  await expect(page.locator("summary").filter({ hasText: /^경조사/ })).toContainText("잔액 400,000");

  await page.getByLabel("지출 날짜").fill("2024-03-01");
  await page.getByLabel("지출 금액").fill("450000");
  await page.getByLabel("지출 분류").selectOption({ label: "경조사" });
  await page.getByLabel("지출 내용").fill("장례식");
  await page.getByRole("button", { name: "지출 추가" }).click();
  await expect(totals.locator("dd").last()).toHaveText("-50,000"); // 총 잔액은 음수 가능
  await expect(page.locator("summary").filter({ hasText: /^경조사/ })).toContainText("잔액 0"); // 분류별은 0

  await page.getByRole("button", { name: /3월 1일 .* 경조사 삭제/ }).click();
  await expect(totals.locator("dd").last()).toHaveText("400,000");

  // ── 같은 연도 다시 가져오기는 확인 후 덮어쓴다 ──
  await page.goto("/settings/data");
  await page.locator("input[type=file]").setInputFiles(file);
  await page.getByRole("region", { name: "가져오기 미리보기" }).getByRole("button", { name: "가져오기" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("2024년 시트를 이미 가져왔어요");
  await page.getByRole("button", { name: "지우고 다시 가져오기" }).click();
  await expect(page.getByRole("status")).toContainText("가져왔어요. 거래 5건");
  await page.goto("/reports?year=2024");
  await expect(page.locator("dl").first()).toContainText("305,000"); // 두 번 들어가지 않음

  // ── 내보내기 ──
  const csv = await page.request.get("/export/transactions");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const body = await csv.text();
  expect(body).toContain("날짜,유형,대분류,소분류,금액,지출방법,태그,내용,입력자");
  expect(body).toContain("2024-01-12,지출,식비,마트,120000,현금,반성,장보기,민수");
  expect(body).toContain("2024-01-15,분류 필요,,,7000");
});
