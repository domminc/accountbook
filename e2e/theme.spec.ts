import { expect, test } from "@playwright/test";
import { signupAndCreateHousehold, uid } from "./helpers";

test("화면 테마: 기본은 다크, 설정에서 라이트·기기 설정으로 바꾸면 기억한다", async ({ page }) => {
  await signupAndCreateHousehold(page, uid(), "민수");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "다크" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "라이트" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.goto("/settings");
  await page.getByRole("button", { name: "기기 설정" }).click();
  await expect(page.getByRole("button", { name: "기기 설정" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
});
