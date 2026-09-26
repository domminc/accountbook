import { expect, test } from "@playwright/test";
import { addTransaction, kstToday, signupAndCreateHousehold, uid } from "./helpers";

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

test("문자 자동 입력: 아는 가맹점은 바로 저장(태그까지), 모르는 건 확인 대기, 같은 문자는 한 번만", async ({ page, request }) => {
  await signupAndCreateHousehold(page, uid(), "민수");
  const today = kstToday();
  const mmdd = `${today.slice(5, 7)}/${today.slice(8, 10)}`;

  // 신한카드 → 체크카드 연결, 스타벅스는 지난번에 카페·#반성
  await page.goto("/assets/cards");
  await page.getByLabel("카드명 *", { exact: true }).fill("생활비카드");
  await page.getByLabel("카드사", { exact: true }).fill("신한카드");
  await page.getByLabel("연결할 지출방법", { exact: true }).selectOption({ label: "체크카드" });
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.locator("summary").filter({ hasText: "생활비카드" })).toBeVisible();
  await addTransaction(page, { group: "식비", category: "카페", amount: 5_000, payment: "현금", memo: "스타벅스", date: `${today.slice(0, 7)}-01`, tags: ["반성"] });

  // 설정에서 토큰 만들기
  await page.goto("/settings");
  await page.getByRole("link", { name: /문자 자동 입력/ }).click();
  await page.getByLabel("기기 이름").fill("민수 아이폰");
  await page.getByRole("button", { name: "토큰 만들기" }).click();
  const auth = await page.getByLabel("헤더 Authorization 값").inputValue();
  expect(auth).toMatch(/^Bearer ab_/);
  await expect(page.getByLabel("주소 (POST)")).toHaveValue(/\/api\/sms$/);

  const known = `[Web발신]\n신한카드(1234)승인 홍*동 4,500원(일시불)${mmdd} 12:34 스타벅스 누적1,234,567원`;
  const unknown = `[Web발신]\n신한카드(1234)승인 홍*동 12,000원(일시불)${mmdd} 13:10 처음가는식당 누적1,246,567원`;

  // 토큰이 틀리면 거절
  expect((await request.post("/api/sms", { headers: { Authorization: "Bearer nope" }, data: { text: known } })).status()).toBe(401);

  // 아이폰 단축어처럼 JSON 으로
  const r1 = await request.post("/api/sms", { headers: { Authorization: auth }, data: { text: known } });
  expect(r1.status()).toBe(200);
  expect(await r1.text()).toContain("가계부에 저장: 스타벅스 4,500원");
  // 안드로이드처럼 text/plain 으로, 모르는 가맹점
  const r2 = await request.post("/api/sms", {
    headers: { Authorization: auth, "Content-Type": "text/plain; charset=utf-8" },
    data: unknown,
  });
  expect(await r2.text()).toContain("확인 필요 1건");
  // 같은 문자가 다시 와도 한 번만
  const r3 = await request.post("/api/sms", { headers: { Authorization: auth, Accept: "application/json" }, data: { text: known } });
  expect(await r3.json()).toMatchObject({ saved: [], duplicates: 1 });

  // 바로 저장된 거래: 카페, 연결한 카드의 지출방법(체크카드), 지난번 태그(#반성)
  await page.goto("/transactions");
  const auto = page.getByRole("link").filter({ hasText: "식비 · 카페" }).filter({ hasText: "4,500" });
  await expect(auto).toContainText("스타벅스 · 체크카드");
  await expect(auto).toContainText("#반성");

  // 확인이 필요한 문자는 카드 문자로 입력 화면에
  await page.goto("/transactions/paste");
  await expect(page.getByText("자동으로 받은 문자 중 확인이 필요한 1건이 포함돼 있어요.")).toBeVisible();
  await expect(page.getByLabel("1번째 내용")).toHaveValue("처음가는식당");
  await page.getByLabel("1번째 소분류").selectOption({ label: "외식" });
  await page.getByRole("checkbox", { name: "1번째 태그 반성" }).click();
  await page.getByRole("button", { name: "1건 저장" }).click();
  await expect(page).toHaveURL(/\/transactions\?month=/);
  await expect(page.getByRole("link").filter({ hasText: "식비 · 외식" })).toContainText("#반성");

  // 확인 끝: 다시 열면 받은 문자가 없다
  await page.goto("/transactions/paste");
  await expect(page.getByText(/자동으로 받은 문자 중/)).toHaveCount(0);

  // 버리기
  await request.post("/api/sms", { headers: { Authorization: auth }, data: { text: `신한카드 승인취소 4,500원 ${mmdd} 14:00 스타벅스` } });
  await page.goto("/transactions/paste");
  await page.getByRole("button", { name: "1번째 받은 문자 버리기" }).click();
  await expect(page.getByRole("heading", { name: "찾은 거래 0건" })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/자동으로 받은 문자 중/)).toHaveCount(0);

  // 기기 삭제하면 그 토큰은 더 못 쓴다
  await page.goto("/settings/sms");
  await expect(page.locator("li").filter({ hasText: "민수 아이폰" })).toContainText("마지막 사용");
  await page.getByRole("button", { name: "민수 아이폰 토큰 삭제" }).click();
  await expect(page.getByText("아직 없어요.")).toBeVisible();
  expect((await request.post("/api/sms", { headers: { Authorization: auth }, data: { text: unknown + "x" } })).status()).toBe(401);
});
