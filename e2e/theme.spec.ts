import { expect, test } from "@playwright/test";
import { signupAndCreateHousehold, uid } from "./helpers";

test("화면: 기본은 다크·루미너스 벤토, 설정에서 밝기·디자인을 바꾸면 기억한다", async ({ page }) => {
  await signupAndCreateHousehold(page, uid(), "민수");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-design", "bento");

  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "다크", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^루미너스 벤토/ })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "라이트", exact: true }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: /^정밀 핀테크/ }).click();
  await expect(html).toHaveAttribute("data-design", "fintech");
  // 디자인을 바꿔도 밝기는 그대로
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.goto("/");
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(html).toHaveAttribute("data-design", "fintech");

  await page.goto("/settings");
  await page.getByRole("button", { name: "기기 설정", exact: true }).click();
  await expect(page.getByRole("button", { name: "기기 설정", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(html).toHaveAttribute("data-theme", "system");
  await expect(html).toHaveAttribute("data-design", "fintech");
});

test("지워진 디자인 값이 쿠키에 남아 있어도 기본(루미너스 벤토)으로 연다", async ({ page, context }) => {
  await context.addCookies([{ name: "design", value: "noir", url: "http://localhost:3200" }]);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-design", "bento");
});
