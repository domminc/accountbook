import { expect, test } from "@playwright/test";
import { addTransaction, kstMonth, signupAndCreateHousehold, uid } from "./helpers";

test("중복 거래 정리: 출처를 보여 주고, 고정지출은 먼저 넣은 한 건만 남기게 골라 둔다", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await signupAndCreateHousehold(page, uid(), "민수");
  const month = kstMonth(0);
  await addTransaction(page, { group: "고정지출", category: "통신비", amount: 55_000, memo: "휴대폰 요금", date: `${month}-01` });
  await addTransaction(page, { group: "고정지출", category: "통신비", amount: 55_000, memo: "휴대폰요금", date: `${month}-05` });
  await addTransaction(page, { group: "식비", category: "카페", amount: 4_500, memo: "스타벅스", date: `${month}-02` });
  await addTransaction(page, { group: "식비", category: "카페", amount: 4_500, memo: "스타벅스", date: `${month}-03` });
  await addTransaction(page, { group: "식비", category: "카페", amount: 5_000, memo: "스타벅스", date: `${month}-03` });

  await page.goto("/settings/data");
  await page.getByRole("link", { name: "중복 거래 찾기" }).click();
  await expect(page.getByRole("heading", { name: "중복 거래 정리" })).toBeVisible();
  await expect(page.getByText("중복 의심 2묶음 · 거래 4건")).toBeVisible();
  await expect(page.getByText("직접 입력").first()).toBeVisible();

  // 고정지출: 먼저 넣은 것은 남기고 두 번째를 골라 둠, 카페는 직접 고른다
  await expect(page.getByLabel(/휴대폰 요금 .* 1번째 지우기/)).not.toBeChecked();
  await expect(page.getByLabel(/휴대폰 요금 .* 2번째 지우기/)).toBeChecked();
  await expect(page.getByLabel(/스타벅스 .* 2번째 지우기/)).not.toBeChecked();

  await page.getByRole("button", { name: "고른 1건 지우기" }).click();
  await expect(page.getByText("중복 의심 1묶음 · 거래 2건")).toBeVisible();

  await page.goto(`/transactions?month=${month}`);
  await expect(page.getByRole("link").filter({ hasText: /휴대폰 ?요금/ })).toHaveCount(1);
  await expect(page.getByRole("link").filter({ hasText: "스타벅스" })).toHaveCount(3);
});
