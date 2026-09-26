import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, chip, kstMonth, signupAndCreateHousehold, uid } from "./helpers";


/** 설정 목록에서 이름으로 찾은 줄(details) */
function row(page: Page, name: string) {
  return page.locator("summary").filter({ hasText: new RegExp(`^${name}`) }).first().locator("xpath=..");
}

/** 설정 목록에서 이름으로 줄을 펼친다 */
async function openRow(page: Page, name: string) {
  await page.locator("summary").filter({ hasText: new RegExp(`^${name}`) }).first().click();
}

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

test("로그인하지 않으면 로그인 화면으로 보낸다", async ({ page }) => {
  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/login\?next=%2Ftransactions/);
});

test("가입 → 설정 → 거래 입력·조회·수정·삭제 → 고정지출 가져오기 → 로그아웃", async ({ page }) => {
  const loginId = uid();
  await signupAndCreateHousehold(page, loginId, "민수");

  // ── 설정: 소분류 추가, 대분류 추가, 숨김 ──
  await page.goto("/settings/categories");
  await openRow(page, "식비");
  const addSnack = page.getByLabel("식비 소분류 추가");
  await addSnack.fill("간식");
  await addSnack.locator("xpath=..").getByRole("button", { name: "추가" }).click();
  await expect(page.locator("summary").filter({ hasText: /^간식/ })).toBeVisible();

  await page.getByLabel("대분류 이름").fill("반려동물");
  await page.getByLabel("첫 소분류 이름").fill("사료");
  await page.getByRole("button", { name: "추가" }).last().click();
  await expect(page.locator("summary").filter({ hasText: /^반려동물/ })).toBeVisible();

  // 수입 대분류는 삭제 버튼이 없다
  await openRow(page, "수입");
  const incomeRow = row(page, "수입");
  await expect(incomeRow.getByRole("button", { name: "삭제" })).toHaveCount(0);

  // 편의점 소분류 숨기기
  await openRow(page, "편의점");
  const convRow = row(page, "편의점");
  await convRow.getByRole("button", { name: "숨기기" }).click();
  await expect(page.locator("summary").filter({ hasText: /^편의점숨김/ })).toBeVisible();

  // 태그 추가
  await page.goto("/settings/tags");
  await page.getByLabel("태그 추가").fill("과소비");
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.locator("summary").filter({ hasText: /^과소비/ })).toBeVisible();

  // ── 거래 입력 ──
  await page.goto("/transactions/new");
  await expect(page.getByRole("radio", { name: "지출", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.locator("input[name=amount]").fill("12000");
  await expect(page.locator("input[name=amount]")).toHaveValue("12,000");
  await chip(page, "식비");
  await expect(page.getByRole("radio", { name: "편의점" })).toHaveCount(0); // 숨긴 소분류는 안 보임
  await chip(page, "마트");
  await chip(page, "체크카드");
  await chip(page, "과소비");
  await page.locator("input[name=memo]").fill("장보기");
  await page.getByRole("button", { name: "저장", exact: true }).click();

  await expect(page).toHaveURL(/\/transactions\?month=/);
  const martRow = page.getByRole("link").filter({ hasText: "식비 · 마트" });
  await expect(martRow).toContainText("-12,000");
  await expect(martRow).toContainText("장보기 · 체크카드 · 민수");
  await expect(martRow).toContainText("#과소비");

  // 소분류 없이 저장하면 오류
  await page.goto("/transactions/new");
  await page.locator("input[name=amount]").fill("1000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("소분류를 골라 주세요.");

  // 저장하고 계속 입력: 수입 두 건
  await page.goto("/transactions/new");
  await chip(page, "수입");
  await chip(page, "월급");
  await page.locator("input[name=amount]").fill("3000000");
  await page.getByRole("button", { name: "저장하고 계속 입력" }).click();
  await expect(page.getByRole("status")).toHaveText("저장했어요. 이어서 입력하세요.");
  await expect(page.locator("input[name=amount]")).toHaveValue("");
  await expect(page.getByRole("radio", { name: "수입", exact: true }).first()).toHaveAttribute("aria-checked", "true");
  await chip(page, "부수입");
  await page.locator("input[name=amount]").fill("50000");
  await page.getByRole("button", { name: "저장", exact: true }).click();

  await expect(page.locator("dl")).toContainText("3,050,000");
  await expect(page.locator("dl")).toContainText("12,000");

  // 필터: 대분류 식비만
  await page.getByText("검색·필터").click();
  await page.getByLabel("대분류").selectOption({ label: "식비" });
  await page.getByRole("button", { name: "적용" }).click();
  await expect(page.getByRole("link").filter({ hasText: "식비 · 마트" })).toHaveCount(1);
  await expect(page.getByRole("link").filter({ hasText: "수입 · 월급" })).toHaveCount(0);
  await page.getByRole("link", { name: "초기화" }).click();

  // 수정
  await page.getByRole("link").filter({ hasText: "식비 · 마트" }).click();
  await expect(page.getByRole("heading", { name: "거래 수정" })).toBeVisible();
  await page.locator("input[name=amount]").fill("15000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("link").filter({ hasText: "식비 · 마트" })).toContainText("-15,000");

  // 삭제
  await page.getByRole("link").filter({ hasText: "수입 · 부수입" }).click();
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page).toHaveURL(/\/transactions\?month=/);
  await expect(page.getByRole("link").filter({ hasText: "수입 · 부수입" })).toHaveCount(0);

  // 거래에 쓴 소분류는 지울 수 없다
  await page.goto("/settings/categories");
  await openRow(page, "식비");
  await openRow(page, "마트");
  const martSetting = row(page, "마트");
  await martSetting.getByRole("button", { name: "삭제" }).click();
  await expect(martSetting.locator("p[role=alert]")).toHaveText("사용 중인 항목이라 지울 수 없어요. 대신 숨김을 써 주세요.");

  // ── 지난달 고정지출 가져오기 ──
  const thisMonth = kstMonth(0);
  const lastMonth = kstMonth(-1);
  await page.goto(`/transactions/new?month=${lastMonth}`);
  await expect(page.locator("input[name=occurredOn]")).toHaveValue(`${lastMonth}-01`);
  await page.locator("input[name=occurredOn]").fill(`${lastMonth}-25`);
  await chip(page, "고정지출");
  await chip(page, "통신비");
  await page.locator("input[name=amount]").fill("55000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`month=${lastMonth}`));

  await page.goto(`/transactions?month=${thisMonth}`);
  await page.getByRole("link", { name: "지난달 고정지출 가져오기" }).click();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await page.getByRole("button", { name: "고른 항목 가져오기" }).click();
  await expect(page).toHaveURL(new RegExp(`month=${thisMonth}`));
  await expect(page.getByRole("link").filter({ hasText: "고정지출 · 통신비" })).toContainText("-55,000");

  // ── 로그아웃 · 다시 로그인 ──
  await page.goto("/settings");
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.locator("input[name=loginId]").fill(loginId);
  await page.locator("input[name=password]").fill("wrong-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("아이디 또는 비밀번호가 맞지 않아요.");

  await page.locator("input[name=loginId]").fill(loginId.toUpperCase());
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("main").getByRole("link", { name: "거래 입력", exact: true })).toBeVisible();
});

test("다른 가계부의 거래는 보이지 않는다", async ({ page, browser }) => {
  const idA = uid();
  await signupAndCreateHousehold(page, idA, "A");
  await page.goto("/transactions/new");
  await chip(page, "식비");
  await chip(page, "외식");
  await page.locator("input[name=amount]").fill("30000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  const row = page.getByRole("link").filter({ hasText: "식비 · 외식" });
  const href = await row.getAttribute("href");

  const other = await browser.newPage();
  await signupAndCreateHousehold(other, uid(), "B");
  await other.goto("/transactions");
  await expect(other.getByText("이 달에 입력한 거래가 없어요.")).toBeVisible();
  // A의 거래 주소로 직접 들어가도 404
  const res = await other.goto(href!);
  expect(res?.status()).toBe(404);

  await other.close();

  // 이미 쓰는 아이디로는 가입할 수 없다 (로그인하지 않은 새 창)
  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/signup");
  await guest.locator("input[name=loginId]").fill(idA);
  await guest.locator("input[name=password]").fill(PASSWORD);
  await guest.locator("input[name=passwordConfirm]").fill(PASSWORD);
  await guest.getByRole("button", { name: "아이디 만들기" }).click();
  await expect(guest.locator("p[role=alert]")).toHaveText("이미 쓰고 있는 아이디예요.");
});
