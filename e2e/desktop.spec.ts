import { devices, expect, test } from "@playwright/test";
import { signupAndCreateHousehold, uid } from "./helpers";

// PC 브라우저 (넓은 화면): 왼쪽 메뉴, 넓은 본문, 내역 표 + 한 줄 입력
test.use({ ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } });

test("PC: 왼쪽 메뉴와 내역 표 위 한 줄 입력으로 이어서 입력", async ({ page }) => {
  await signupAndCreateHousehold(page, uid(), "민수");

  const side = page.getByRole("navigation", { name: "PC 메뉴" });
  await expect(side).toBeVisible();
  await expect(page.getByRole("navigation", { name: "메뉴", exact: true })).toBeHidden();
  await side.getByRole("link", { name: "거래 내역" }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(side.getByRole("link", { name: "거래 내역" })).toHaveAttribute("aria-current", "page");

  const quick = page.getByRole("form", { name: "빠른 입력" });
  await quick.getByLabel("소분류").selectOption({ label: "마트" });
  await quick.getByLabel("금액").fill("12000");
  await quick.getByLabel("지출방법").selectOption({ label: "체크카드" });
  await quick.getByLabel("내용").fill("PC 장보기");
  await quick.getByLabel("내용").press("Enter");
  await expect(quick.getByRole("status")).toHaveText("추가했어요. 이어서 입력하세요.");
  // 금액·내용만 비우고 금액 칸으로
  await expect(quick.getByLabel("금액")).toHaveValue("");
  await expect(quick.getByLabel("금액")).toBeFocused();
  await expect(quick.getByLabel("소분류").locator("option:checked")).toHaveText("마트");

  await page.keyboard.type("3500");
  await quick.getByLabel("내용").fill("PC 간식");
  await quick.getByLabel("내용").press("Enter");

  const table = page.getByRole("table");
  await expect(table.getByRole("row").filter({ hasText: "PC 간식" })).toContainText("-3,500");
  const first = table.getByRole("row").filter({ hasText: "PC 장보기" });
  await expect(first).toContainText("식비 · 마트");
  await expect(first).toContainText("체크카드");
  await expect(first).toContainText("-12,000");

  // 줄을 누르면 수정 화면
  await first.getByRole("link").click();
  await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "거래 수정" })).toBeVisible();

  // 이달의 정리는 넓게 (요약 옆에 바로 가기)
  await side.getByRole("link", { name: "이달의 정리" }).click();
  await expect(page.getByRole("region", { name: "이달 요약" })).toContainText("15,500");
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw);
});
