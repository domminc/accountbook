import { expect, test } from "@playwright/test";
import { addTransaction, kstToday, signupAndCreateHousehold, uid } from "./helpers";

test("카드 문자 붙여넣기: 지출방법·소분류 추천, 취소·중복 표시, 한 번에 저장", async ({ page }) => {
  await signupAndCreateHousehold(page, uid(), "민수");
  const today = kstToday();
  const mmdd = `${today.slice(5, 7)}/${today.slice(8, 10)}`;

  // 신한카드를 체크카드 지출방법에 연결, 스타벅스는 지난번에 카페·현금으로 입력
  await page.goto("/assets/cards");
  await page.getByLabel("카드명 *", { exact: true }).fill("생활비카드");
  await page.getByLabel("카드사", { exact: true }).fill("신한카드");
  await page.getByLabel("연결할 지출방법", { exact: true }).selectOption({ label: "체크카드" });
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.locator("summary").filter({ hasText: "생활비카드" })).toBeVisible();
  await addTransaction(page, { group: "식비", category: "카페", amount: 5_000, payment: "현금", memo: "스타벅스" });

  const text = [
    `[Web발신]\n신한카드(1234)승인 홍*동 4,500원(일시불)${mmdd} 12:34 스타 벅스 누적1,234,567원`,
    `[Web발신]\n삼성1234승인 홍*동\n45,000원 일시불\n${mmdd} 18:02 이마트 성수점\n누적 512,300원`,
    `[Web발신]\n신한카드(1234)승인취소 홍*동 9,000원(일시불)${mmdd} 13:00 김밥천국`,
  ].join("\n");

  await page.goto("/transactions/new");
  await page.getByRole("link", { name: "카드 문자로 입력" }).click();
  await page.getByLabel("문자 내용").fill(text);
  await page.getByRole("button", { name: "문자 읽기" }).click();
  await expect(page.getByRole("heading", { name: "찾은 거래 3건" })).toBeVisible();

  // 1: 신한 → 연결한 체크카드, 스타벅스 → 지난번 소분류(카페)
  await expect(page.getByLabel("1번째 소분류").locator("option:checked")).toHaveText("카페");
  await expect(page.getByLabel("1번째 지출방법").locator("option:checked")).toHaveText("체크카드");
  await expect(page.getByLabel("1번째 금액")).toHaveValue("4,500");
  // 2: 처음 보는 가맹점은 소분류를 고른다
  await expect(page.getByLabel("2번째 내용")).toHaveValue("이마트 성수점");
  await expect(page.getByLabel("2번째 소분류").locator("option:checked")).toHaveText("고르기");
  // 3: 취소 문자는 저장하지 않는다
  await expect(page.getByText("취소 문자예요.")).toBeVisible();
  await expect(page.getByLabel("3번째 거래 저장")).toBeDisabled();

  // 소분류를 안 고르면 저장하지 않는다
  await page.getByRole("button", { name: "2건 저장" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("2번째: 소분류를 골라 주세요.");
  await page.getByLabel("2번째 소분류").selectOption({ label: "마트" });
  await page.getByRole("button", { name: "2건 저장" }).click();
  await expect(page).toHaveURL(/\/transactions\?month=/);
  await expect(page.getByRole("link").filter({ hasText: "식비 · 카페" }).filter({ hasText: "스타 벅스" })).toContainText("4,500");
  await expect(page.getByRole("link").filter({ hasText: "식비 · 마트" })).toContainText("이마트 성수점");

  // 같은 문자를 다시 붙여 넣으면 이미 입력한 것으로 표시하고 빼 둔다
  await page.goto("/transactions/paste");
  await page.getByLabel("문자 내용").fill(text);
  await page.getByRole("button", { name: "문자 읽기" }).click();
  await expect(page.getByText("같은 날 같은 금액 거래가 이미 있어요 (스타 벅스)")).toBeVisible();
  await expect(page.getByLabel("1번째 거래 저장")).not.toBeChecked();
  await expect(page.getByRole("button", { name: "0건 저장" })).toBeDisabled();
});
