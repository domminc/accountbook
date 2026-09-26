import { expect, test } from "@playwright/test";
import { addTransaction, kstMonth, signupAndCreateHousehold, uid } from "./helpers";

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

test("과소비 알림: 태그·소분류 한도와 지난 3개월 평균", async ({ page }) => {
  await signupAndCreateHousehold(page, uid(), "민수");

  // 지난 두 달 카페 1만 원씩 → 이번 달 4만 원이면 평소보다 많음
  for (const offset of [-2, -1]) {
    await addTransaction(page, { group: "식비", category: "카페", amount: 10_000, date: `${kstMonth(offset)}-10` });
  }
  await addTransaction(page, { group: "식비", category: "카페", amount: 40_000, memo: "카페 몰아서" });

  // 태그 한도: 반성 2만 원
  await page.goto("/budget");
  await page.getByLabel("한도 항목").selectOption({ label: "#반성" });
  await page.getByLabel("월 한도").fill("20000");
  await page.getByRole("button", { name: "한도 추가" }).click();
  await expect(page.locator("li").filter({ hasText: "#반성" })).toContainText("이 달 0 / 한도 20,000");
  // 한도를 정한 항목은 다시 고를 수 없다
  await expect(page.getByLabel("한도 항목").locator("option", { hasText: "#반성" })).toHaveCount(0);

  await addTransaction(page, { group: "식비", category: "배달", amount: 17_000, tags: ["반성"] });
  await page.goto("/");
  const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "과소비 알림" }) });
  await expect(card.locator("li").first()).toContainText("#반성");
  await expect(card.locator("li").first()).toContainText("한도 80% 넘음");
  await expect(card.locator("li").first()).toContainText("한도 20,000 · 3,000 남음");
  await expect(card.locator("li").filter({ hasText: "식비 · 카페" })).toContainText("지난 3개월 평균 10,000 · 30,000 더 씀");

  await addTransaction(page, { group: "식비", category: "배달", amount: 5_000, tags: ["반성"] });
  await page.goto("/");
  await expect(card.locator("li").first()).toContainText("한도 초과");
  await expect(card.locator("li").first()).toContainText("2,000 초과");

  // 한도 삭제
  await page.goto("/budget");
  await page.getByRole("button", { name: "#반성 한도 삭제" }).click();
  await expect(page.getByRole("button", { name: "#반성 한도 삭제" })).toHaveCount(0);
});
