import { expect, test } from "@playwright/test";
import { signupAndCreateHousehold, uid } from "./helpers";

test("연·월 선택으로 바로 이동", async ({ page }) => {
  await signupAndCreateHousehold(page, uid(), "민수");

  await page.goto("/transactions?month=2026-09");
  await expect(page.getByLabel("연도")).toHaveValue("2026");
  await expect(page.getByLabel("월", { exact: true })).toHaveValue("9");

  await page.getByLabel("월", { exact: true }).selectOption("3");
  await expect(page).toHaveURL(/\/transactions\?month=2026-03$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2026년 3월");

  await page.getByLabel("연도").selectOption("2024");
  await expect(page).toHaveURL(/\/transactions\?month=2024-03$/);
  await expect(page.getByLabel("월", { exact: true })).toHaveValue("3");

  // 화살표도 그대로
  await page.getByRole("link", { name: "다음 달" }).click();
  await expect(page).toHaveURL(/month=2024-04$/);
  await expect(page.getByLabel("월", { exact: true })).toHaveValue("4");

  await page.goto("/reports?year=2026");
  await page.getByLabel("연도").selectOption("2025");
  await expect(page).toHaveURL(/\/reports\?year=2025$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2025년");
});
