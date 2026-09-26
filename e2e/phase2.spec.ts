import { expect, test } from "@playwright/test";
import { addMonths } from "../src/lib/month";
import { addTransaction, kstMonth, kstToday, signupAndCreateHousehold, uid } from "./helpers";

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

test("자산·대출·카드·통장·결제일", async ({ page }) => {
  const month = kstMonth(0);
  const today = kstToday();
  await signupAndCreateHousehold(page, uid(), "민수");

  // ── 자산: 기본 항목 → 금액 입력 → 순자산 ──
  await page.goto(`/assets?month=${month}`);
  await page.getByRole("button", { name: "기본 항목으로 시작하기" }).click();
  await page.getByLabel("집 시세 금액").fill("300000000");
  await page.getByLabel("예적금 금액").fill("20000000");
  await page.getByLabel("주택담보대출 금액").fill("150000000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  const worth = page.getByRole("region", { name: "순자산" });
  await expect(worth).toContainText("170,000,000원");
  await expect(worth).toContainText("자산 320,000,000 · 부채 150,000,000");

  // 다음 달로 지난달 금액 가져오기
  await page.goto(`/assets?month=${addMonths(month, 1)}`);
  await expect(worth).toContainText("아직 입력하지 않았어요");
  await page.getByRole("button", { name: "지난달 금액 가져오기" }).click();
  await expect(worth).toContainText("170,000,000원");
  await expect(page.getByLabel("집 시세 금액")).toHaveValue("300,000,000");

  // ── 대출: 상환 기록으로 원금잔액·누적이자 (시트 예시와 같은 값) ──
  await page.goto("/assets/loans");
  await page.getByLabel("대출명 *").fill("주택담보대출");
  await page.getByLabel("대출원금").fill("100000000");
  await page.getByLabel("금리 (%)").fill("4.3");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  const loan = page.locator("details").filter({ has: page.locator("summary", { hasText: "주택담보대출" }) }).first();
  await expect(loan.locator("summary")).toContainText("잔액 100,000,000");
  await loan.locator("summary").click();
  for (const [p, i] of [["1000000", "200001"], ["20000", "123232"]]) {
    await loan.getByLabel("상환원금").fill(p);
    await loan.getByLabel("이자").fill(i);
    await loan.getByRole("button", { name: "상환 기록 추가" }).click();
    await expect(loan.getByLabel("상환원금")).toHaveValue("");
  }
  await expect(loan.locator("summary")).toContainText("잔액 98,980,000");
  await expect(loan.locator("summary")).toContainText("누적이자 323,233");
  await expect(page.locator("dl").first()).toContainText("98,980,000");

  // ── 카드 ──
  await page.goto("/assets/cards");
  await page.getByLabel("카드명 *", { exact: true }).fill("생활비카드");
  await page.getByLabel("카드사", { exact: true }).fill("현대카드");
  await page.getByLabel("결제일", { exact: true }).fill("13일");
  await page.getByLabel("매월 카드값 예산", { exact: true }).fill("800000");
  await page.getByLabel("연결할 지출방법", { exact: true }).selectOption({ label: "체크카드" });
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.locator("summary").filter({ hasText: "생활비카드" })).toContainText("결제일 13일 · 예산 800,000");
  await expect(page.locator("summary").filter({ hasText: "생활비카드" })).toContainText("지출방법 체크카드");

  // 연결한 지출방법으로 쓴 지출만 카드 사용액에 들어간다
  await addTransaction(page, { group: "식비", category: "마트", amount: 700_000, payment: "체크카드" });
  await addTransaction(page, { group: "식비", category: "외식", amount: 50_000, payment: "현금" });
  await page.goto("/assets/cards");
  const usage = page.locator("section").filter({ has: page.getByRole("heading", { name: "이번 달 카드 사용" }) });
  await expect(usage).toContainText("700,000 / 800,000");
  await expect(usage).toContainText("80% 넘음");
  await expect(usage).toContainText("남은 예산 100,000");
  await expect(usage.getByRole("meter", { name: "생활비카드 카드 예산 사용" })).toHaveAttribute("aria-valuenow", "700000");
  await page.goto("/");
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "카드별 사용" }) })).toContainText(
    "700,000 / 800,000",
  );

  // 한 지출방법은 카드 하나에만 연결한다
  await page.goto("/assets/cards");
  const addCard = page.locator("details").filter({ has: page.locator("summary", { hasText: "+ 카드 추가" }) });
  await addCard.locator("summary").click();
  await addCard.getByLabel("카드명 *", { exact: true }).fill("비상카드");
  await addCard.getByLabel("연결할 지출방법", { exact: true }).selectOption({ label: "체크카드" });
  await addCard.getByRole("button", { name: "추가", exact: true }).click();
  await expect(addCard.locator("p[role=alert]")).toHaveText("이미 다른 카드에 연결한 지출방법이에요.");

  // ── 통장: 계좌번호는 끝 4자리만 ──
  await page.goto("/assets/accounts");
  await page.getByLabel("은행 *", { exact: true }).fill("국민은행");
  await page.getByLabel("계좌번호 끝 4자리", { exact: true }).fill("12a4");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("계좌번호는 끝 4자리 숫자만 입력해 주세요.");
  // 오류가 나도 입력한 값은 남아 있다
  await expect(page.getByLabel("은행 *", { exact: true })).toHaveValue("국민은행");
  await page.getByLabel("계좌번호 끝 4자리", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.locator("summary").filter({ hasText: "국민은행" })).toContainText("****1234");

  // ── 결제일: 오늘 결제 → 대시보드 알림 → 거래로 입력 ──
  await page.goto(`/assets/payments?month=${month}`);
  await page.getByLabel("내용 *", { exact: true }).fill("휴대폰 요금");
  await page.getByLabel("금액 *", { exact: true }).fill("55000");
  await page.getByLabel("결제일 (매월) *", { exact: true }).fill(String(Number(today.slice(8))));
  await page.getByLabel("구분 (소분류)", { exact: true }).selectOption({ label: "통신비" });
  await page.getByLabel("지출방법", { exact: true }).selectOption({ label: "체크카드" });
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.locator("summary").filter({ hasText: "휴대폰 요금" })).toContainText("고정지출 · 통신비");

  const addForm = page.locator("details").filter({ has: page.locator("summary", { hasText: "+ 결제 추가" }) });
  await addForm.locator("summary").click();
  await addForm.getByLabel("내용 *", { exact: true }).fill("구분 없는 결제");
  await addForm.getByLabel("금액 *", { exact: true }).fill("1000");
  await addForm.getByLabel("결제일 (매월) *", { exact: true }).fill("1");
  await addForm.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByLabel("구분 없는 결제 거래로 입력", { exact: true })).toBeDisabled();

  await page.goto("/");
  const due = page.locator("section").filter({ has: page.getByRole("heading", { name: "결제 예정" }) });
  await expect(due).toContainText("휴대폰 요금");
  await expect(due).toContainText("오늘");

  await page.goto(`/assets/payments?month=${month}`);
  await expect(page.getByLabel("휴대폰 요금 거래로 입력", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "고른 결제를 거래로 입력" }).click();
  await expect(page.getByRole("link", { name: "입력함" })).toBeVisible();

  await page.goto(`/transactions?month=${month}`);
  const tx = page.getByRole("link").filter({ hasText: "고정지출 · 통신비" });
  await expect(tx).toContainText("-55,000");
  await expect(tx).toContainText("휴대폰 요금 · 체크카드");

  // 이미 입력한 결제는 대시보드 알림에서 빠진다
  await page.goto("/");
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "결제 예정" }) })).not.toContainText("휴대폰 요금");
});
