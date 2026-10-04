import { expect, test } from "@playwright/test";
import { signupAndCreateHousehold, uid } from "./helpers";

test("화면: 기본은 다크·루미너스 벤토, 설정에서 밝기·디자인을 바꾸면 기억한다", async ({ page }) => {
  await signupAndCreateHousehold(page, uid(), "민수");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-design", "bento");

  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "다크" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^루미너스 벤토/ })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "라이트" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: /^이리데센트 누아르/ }).click();
  await expect(html).toHaveAttribute("data-design", "noir");
  // 디자인을 바꿔도 밝기는 그대로
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.goto("/");
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(html).toHaveAttribute("data-design", "noir");

  await page.goto("/settings");
  await page.getByRole("button", { name: "기기 설정" }).click();
  await expect(page.getByRole("button", { name: "기기 설정" })).toHaveAttribute("aria-pressed", "true");
  await expect(html).toHaveAttribute("data-theme", "system");
  await expect(html).toHaveAttribute("data-design", "noir");
});
