import { expect, test } from "@playwright/test";
import { addMonths } from "../src/lib/month";
import { addTransaction, kstMonth, kstToday, signupAndCreateHousehold, uid } from "./helpers";

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

test("이달의 정리: 합계·목표·예산·비중·결제수단·태그·무지출·이벤트·주간표·달력", async ({ page }) => {
  const month = kstMonth(0);
  const today = kstToday();
  await signupAndCreateHousehold(page, uid(), "민수");

  await addTransaction(page, { kind: "수입", category: "월급", amount: 4_000_000, date: today });
  await addTransaction(page, { kind: "저축", category: "적금", amount: 1_000_000, date: today });
  await addTransaction(page, { group: "고정지출", category: "통신비", amount: 700_000, payment: "체크카드", date: today });
  await addTransaction(page, { group: "식비", category: "마트", amount: 300_000, payment: "체크카드", tags: ["반성"], date: today });
  await addTransaction(page, { group: "건강", category: "약국", amount: 10_000, payment: "현금", date: today });

  // ── 목표·예산 ──
  await page.goto(`/budget?month=${month}`);
  await page.getByLabel("수입 목표", { exact: true }).fill("5000000");
  await page.getByLabel("수입 세부 목표").fill("부수입 늘리기");
  await page.getByLabel("지출 목표", { exact: true }).fill("1000000");
  await page.getByLabel("식비 예산").fill("250000");
  await page.getByLabel("고정지출 예산").fill("1000000");
  await page.getByRole("button", { name: "목표·예산 저장" }).click();
  await expect(page.getByRole("status")).toHaveText("저장했어요.");
  await expect(page.getByLabel("식비 예산")).toHaveValue("250,000");

  await page.getByLabel("이벤트 내용").fill("어머니 생신");
  await page.getByLabel("이벤트 예산").fill("200000");
  await page.getByRole("button", { name: "이벤트 추가" }).click();
  await expect(page.getByText("어머니 생신")).toBeVisible();

  // ── 이달의 정리 ──
  await page.goto(`/?month=${month}`);
  const summary = page.getByRole("region", { name: "이달 요약" });
  await expect(summary).toContainText("2,990,000원"); // 남은 금액 = 4,000,000 − 1,010,000
  await expect(summary).toContainText("4,000,000");
  await expect(summary).toContainText("1,010,000");
  await expect(summary).toContainText("25.0%"); // 저축률
  await expect(summary).toContainText("고정 700,000 · 비고정 310,000");

  const goals = page.locator("section").filter({ has: page.getByRole("heading", { name: "목표 관리" }) });
  await expect(goals).toContainText("달성률 80.0%");
  await expect(goals).toContainText("목표까지 1,000,000");
  await expect(goals).toContainText("10,000 초과"); // 지출 목표 1,000,000 < 1,010,000
  await expect(goals).toContainText("부수입 늘리기");
  await expect(goals).toContainText("월급 4,000,000");

  const budget = page.locator("section").filter({ has: page.getByRole("heading", { name: "대분류별 예산" }) });
  await expect(budget.locator("li").filter({ hasText: "식비" })).toContainText("▲ 초과");
  await expect(budget.locator("li").filter({ hasText: "고정지출" })).not.toContainText("초과");
  await expect(budget).toContainText("310,000 / 250,000"); // 총 비고정지출 / 총 예산

  // 비중: 분모 2,010,000 — 건강(0.5%)은 그 외로
  const share = page.locator("section").filter({ has: page.getByRole("heading", { name: "저축·지출 비중" }) });
  await expect(share.locator("li")).toHaveText([/저축.*50%/, /고정지출.*35%/, /식비.*15%/, /그 외.*0%/]);

  const pay = page.locator("section").filter({ has: page.getByRole("heading", { name: "결제 수단별 지출" }) });
  await expect(pay.locator("li")).toHaveText(["체크카드1,000,000", "현금10,000"]);
  const tags = page.locator("section").filter({ has: page.getByRole("heading", { name: "태그별 금액" }) });
  await expect(tags.locator("li")).toHaveText(["반성300,000"]);

  const day = Number(today.slice(8));
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "무지출 Day" }) })).toContainText(`${day - 1}일`);
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "이달의 이벤트" }) })).toContainText("어머니 생신");

  // ── 주간별 표 ──
  await page.getByRole("link", { name: "주간별 표" }).click();
  const food = page.locator("section").filter({ has: page.locator("caption", { hasText: "식비" }) });
  await expect(food).toContainText("300,000");
  await expect(food).toContainText("▲ 50,000 초과");

  // ── 달력 ──
  await page.goto(`/transactions/calendar?month=${month}`);
  await expect(page.locator("dl").first()).toContainText("1,010,000");
  await page.getByRole("link", { name: new RegExp(`^${Number(today.slice(5, 7))}월 ${day}일`) }).click();
  await expect(page.getByRole("link").filter({ hasText: "식비 · 마트" })).toBeVisible();

  // ── 다음 달로 목표·예산 복사 ──
  await page.goto(`/budget?month=${addMonths(month, 1)}`);
  await page.getByRole("button", { name: "지난달 목표·예산 가져오기" }).click();
  await expect(page.getByRole("status")).toHaveText("지난달 항목 4개를 가져왔어요.");
  await expect(page.getByLabel("식비 예산")).toHaveValue("250,000");
});
