import { expect, test } from "@playwright/test";
import { PASSWORD, addTransaction, signupAndCreateHousehold, uid } from "./helpers";

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

test("초대 링크로 배우자가 가입·참여하고 같은 가계부를 함께 쓴다", async ({ page, browser }) => {
  await signupAndCreateHousehold(page, uid(), "민수");
  await addTransaction(page, { group: "식비", category: "마트", amount: 12_000, memo: "민수 장보기" });

  // 초대 링크 만들기
  await page.goto("/settings/members");
  await page.getByRole("button", { name: "초대 링크 만들기" }).click();
  const link = await page.getByLabel("초대 링크").inputValue();
  expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{32}$/);
  await expect(page.getByText("아직 쓰지 않은 초대")).toBeVisible();

  // 배우자: 로그인 안 한 상태로 링크 → 로그인 화면 → 아이디 만들기 → 초대 화면
  const spouse = await (await browser.newContext()).newPage();
  await spouse.goto(link);
  await expect(spouse).toHaveURL(/\/login\?next=%2Finvite%2F/);
  await spouse.getByRole("link", { name: "처음이신가요? 아이디 만들기" }).click();
  // 로그인 화면에도 같은 이름의 입력 칸이 있으므로 가입 화면으로 바뀐 뒤 입력한다
  await expect(spouse).toHaveURL(/\/signup\?next=%2Finvite%2F/);
  await spouse.locator("input[name=loginId]").fill(uid());
  await spouse.locator("input[name=password]").fill(PASSWORD);
  await spouse.locator("input[name=passwordConfirm]").fill(PASSWORD);
  await spouse.getByRole("button", { name: "아이디 만들기" }).click();
  await expect(spouse).toHaveURL(/\/invite\//);
  await expect(spouse.getByText("우리집 가계부에 초대받았어요")).toBeVisible();
  await spouse.locator("input[name=displayName]").fill("지영");
  await spouse.getByRole("button", { name: "가계부 참여하기" }).click();
  await expect(spouse.getByRole("link", { name: "거래 입력" })).toBeVisible();

  // 배우자도 같은 거래를 본다
  await spouse.goto("/transactions");
  await expect(spouse.getByRole("link").filter({ hasText: "식비 · 마트" })).toContainText("민수 장보기 · 민수");
  await addTransaction(spouse, { group: "식비", category: "외식", amount: 30_000, memo: "지영 점심" });

  // 민수 쪽에서 배우자 거래가 보이고, 입력자로 거를 수 있다
  await page.goto("/transactions");
  await expect(page.getByRole("link").filter({ hasText: "식비 · 외식" })).toContainText("지영 점심 · 지영");
  await page.getByText("검색·필터").click();
  await page.getByLabel("입력자").selectOption({ label: "지영" });
  await page.getByRole("button", { name: "적용" }).click();
  await expect(page.getByRole("link").filter({ hasText: "식비 · 마트" })).toHaveCount(0);
  await expect(page.getByRole("link").filter({ hasText: "식비 · 외식" })).toHaveCount(1);

  // 구성원 목록·이름 바꾸기
  await page.goto("/settings/members");
  await expect(page.locator("li").filter({ hasText: "지영" })).toContainText("구성원");
  await expect(page.getByText("아직 쓰지 않은 초대")).toHaveCount(0);
  await page.getByLabel("내 이름").fill("민수아빠");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("저장했어요.");
  await spouse.goto("/transactions");
  await expect(spouse.getByRole("link").filter({ hasText: "식비 · 마트" })).toContainText("민수아빠");

  // 쓴 링크는 다시 쓸 수 없다
  const third = await (await browser.newContext()).newPage();
  await third.goto(`/signup?next=${encodeURIComponent(new URL(link).pathname)}`);
  await third.locator("input[name=loginId]").fill(uid());
  await third.locator("input[name=password]").fill(PASSWORD);
  await third.locator("input[name=passwordConfirm]").fill(PASSWORD);
  await third.getByRole("button", { name: "아이디 만들기" }).click();
  await expect(third.getByText("이미 사용한 초대 링크예요.")).toBeVisible();

  // 가계부가 이미 있는 사람은 참여할 수 없다
  await page.goto("/settings/members");
  await page.getByRole("button", { name: "초대 링크 만들기" }).click();
  const link2 = await page.getByLabel("초대 링크").inputValue();
  const other = await browser.newPage();
  await signupAndCreateHousehold(other, uid(), "다른사람");
  await other.goto(link2);
  await expect(other.getByText(/이미 .*에 참여하고 있어요/)).toBeVisible();

  // 초대 취소
  await page.goto("/settings/members");
  await page.getByRole("button", { name: "취소" }).click();
  await expect(page.getByText("아직 쓰지 않은 초대")).toHaveCount(0);
});

test("홈 화면 추가용 manifest는 로그인 없이 받을 수 있다", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.name).toBe("가계부");
  expect(json.icons.length).toBeGreaterThan(0);
  expect((await request.get("/icon-192.png")).status()).toBe(200);
});

test("배포 점검 주소는 로그인 없이 DB·환경 변수 상태를 알려준다 (비밀 값은 숨김)", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json).toMatchObject({ 상태: "정상", DB: "접속됨", 표: "모두 있음" });
  expect(json.쓰는_DB_주소).toContain(":****@");
  expect(JSON.stringify(json)).not.toContain(process.env.SESSION_SECRET ?? "never");
});
