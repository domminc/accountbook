import { expect, test } from "@playwright/test";
import { chip, signupAndCreateHousehold, uid } from "./helpers";

test("오프라인에서 입력한 거래는 기기에 저장했다가 연결되면 한 번만 올린다", async ({ page, context }) => {
  await signupAndCreateHousehold(page, uid(), "민수");

  // 서비스 워커가 입력 화면을 받아 둘 때까지
  await expect
    .poll(() => page.evaluate(async () => Boolean(await caches.match("/transactions/new", { cacheName: "ab-pages-v1" }))), {
      timeout: 20_000,
    })
    .toBe(true);

  await context.setOffline(true);
  // 연결이 없으면 어느 화면이든 받아 둔 입력 화면으로 연다
  await page.goto("/");
  await expect(page).toHaveURL(/\/transactions\/new$/);
  await expect(page.getByText("인터넷 연결이 없어요. 새 거래는 이 기기에 저장했다가 연결되면 올려요.")).toBeVisible();

  await page.locator("input[name=amount]").fill("12000");
  await chip(page, "식비");
  await chip(page, "마트");
  await page.locator("input[name=memo]").fill("지하철 장보기");
  await page.getByRole("button", { name: "저장하고 계속 입력" }).click();
  await expect(page.locator("p[role=status]")).toHaveText("인터넷 연결이 없어 이 기기에 저장했어요. 연결되면 자동으로 올려요.");
  await expect(page.getByText("기기에 저장된 거래 1건")).toBeVisible();
  // 날짜·분류는 남고 금액·내용은 비운다
  await expect(page.locator("input[name=amount]")).toHaveValue("");
  await expect(page.getByRole("radio", { name: "마트", exact: true })).toHaveAttribute("aria-checked", "true");

  await page.locator("input[name=amount]").fill("3000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("기기에 저장된 거래 2건")).toBeVisible();

  const queued = await page.evaluate(() => localStorage.getItem("ab_offline_tx"));
  expect(queued).toBeTruthy();

  // 연결되면 자동으로 올리고 대기열을 비운다
  await context.setOffline(false);
  await expect(page.getByText(/기기에 저장된 거래/)).toHaveCount(0, { timeout: 20_000 });
  await page.goto("/transactions");
  const rows = page.getByRole("link").filter({ hasText: "식비 · 마트" });
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "지하철 장보기" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "지하철 장보기" })).toContainText("12,000");

  // 응답을 못 받아 같은 거래를 다시 올려도 한 번만 저장된다
  await page.evaluate((raw) => localStorage.setItem("ab_offline_tx", raw!), queued);
  await page.reload();
  await expect(page.getByText(/기기에 저장된 거래/)).toHaveCount(0, { timeout: 20_000 });
  await page.reload();
  await expect(rows).toHaveCount(2);

  // 로그아웃하면 받아 둔 입력 화면을 지운다
  await page.goto("/settings");
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect
    .poll(() => page.evaluate(async () => Boolean(await caches.match("/transactions/new", { cacheName: "ab-pages-v1" }))))
    .toBe(false);
});
