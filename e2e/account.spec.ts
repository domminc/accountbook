import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, addTransaction, signupAndCreateHousehold, uid } from "./helpers";

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

async function logout(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function login(page: Page, loginId: string, password = PASSWORD) {
  await page.locator("input[name=loginId]").fill(loginId);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}

test("스토어 심사용 공개 안내: 개인정보처리방침·계정 삭제 안내·앱 연결 파일", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "개인정보처리방침" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "개인정보처리방침", level: 1 })).toBeVisible();
  await expect(page.getByText("생체 정보는 기기 밖으로 나오지 않으며")).toBeVisible();
  await expect(page.getByText("개인정보 보호책임자: 김영진")).toBeVisible();

  await page.getByRole("link", { name: "계정 삭제 안내" }).click();
  await expect(page).toHaveURL(/\/account-deletion$/);
  await expect(page.getByRole("heading", { name: "지워지는 데이터" })).toBeVisible();

  // 환경 변수를 넣기 전에는 빈 목록
  const res = await page.request.get("/.well-known/assetlinks.json");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual([]);

  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ id: "/", scope: "/", display: "standalone" });
  expect(manifest.shortcuts[0]).toMatchObject({ name: "거래 입력", url: "/transactions/new" });
});

test("Face ID·지문(패스키) 등록·로그인·삭제, 비밀번호 바꾸기", async ({ page }) => {
  // 기기의 Face ID 대신 크롬의 가상 인증기 (사용자 확인 자동 통과)
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  const loginId = uid();
  await signupAndCreateHousehold(page, loginId, "민수");

  await page.goto("/settings");
  await page.getByRole("link", { name: /계정·보안/ }).click();
  await expect(page.getByText(`아이디 ${loginId}`)).toBeVisible();
  await page.getByRole("button", { name: "이 기기 등록하기" }).click();
  await expect(page.getByRole("status")).toHaveText("이 기기를 등록했어요. 다음부터 Face ID·지문으로 로그인할 수 있어요.");
  await expect(page.locator("li").filter({ hasText: "iPhone" })).toContainText("등록");

  // 같은 기기를 두 번 등록하지 않는다
  await page.getByRole("button", { name: "이 기기 등록하기" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("이 기기는 이미 등록돼 있어요.");

  // 아이디 없이 Face ID 로 로그인
  await logout(page);
  await page.getByRole("button", { name: "Face ID·지문으로 로그인" }).click();
  await expect(page.getByRole("main").getByRole("link", { name: "거래 입력", exact: true })).toBeVisible();
  await page.goto("/settings/account");
  await expect(page.locator("li").filter({ hasText: "iPhone" })).toContainText("마지막 사용");

  // 비밀번호 바꾸기
  const newPassword = "new-password-2";
  await page.getByLabel("지금 비밀번호").fill("wrong-password");
  await page.getByLabel("새 비밀번호", { exact: true }).fill(newPassword);
  await page.getByLabel("새 비밀번호 확인").fill(newPassword);
  await page.getByRole("button", { name: "비밀번호 바꾸기" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("지금 비밀번호가 맞지 않아요.");
  await page.getByLabel("지금 비밀번호").fill(PASSWORD);
  await page.getByLabel("새 비밀번호", { exact: true }).fill(newPassword);
  await page.getByLabel("새 비밀번호 확인").fill(newPassword);
  await page.getByRole("button", { name: "비밀번호 바꾸기" }).click();
  await expect(page.getByRole("status")).toHaveText("비밀번호를 바꿨어요.");

  // 패스키를 지우면 그 기기로는 로그인할 수 없다
  await page.locator("li").filter({ hasText: "iPhone" }).getByRole("button", { name: "삭제" }).click();
  await expect(page.locator("li").filter({ hasText: "iPhone" })).toHaveCount(0);
  await logout(page);
  await page.getByRole("button", { name: "Face ID·지문으로 로그인" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("등록되지 않은 패스키예요.");

  // 옛 비밀번호는 안 되고 새 비밀번호로 로그인
  await login(page, loginId);
  await expect(page.getByText("아이디 또는 비밀번호가 맞지 않아요.")).toBeVisible();
  await login(page, loginId, newPassword);
  await expect(page.getByRole("main").getByRole("link", { name: "거래 입력", exact: true })).toBeVisible();
});

test("회원 탈퇴: 함께 쓰는 가계부는 남고, 마지막 사람이 탈퇴하면 모두 지운다", async ({ page, browser }) => {
  const ownerId = uid();
  await signupAndCreateHousehold(page, ownerId, "민수");
  await addTransaction(page, { group: "식비", category: "마트", amount: 12_000, memo: "민수 장보기" });

  // 배우자 초대
  await page.goto("/settings/members");
  await page.getByRole("button", { name: "초대 링크 만들기" }).click();
  const link = await page.getByLabel("초대 링크").inputValue();
  const spouseId = uid();
  const spouse = await (await browser.newContext()).newPage();
  spouse.on("dialog", (d) => d.accept());
  await spouse.goto("/signup");
  await spouse.locator("input[name=loginId]").fill(spouseId);
  await spouse.locator("input[name=password]").fill(PASSWORD);
  await spouse.locator("input[name=passwordConfirm]").fill(PASSWORD);
  await spouse.getByRole("button", { name: "아이디 만들기" }).click();
  await expect(spouse).toHaveURL(/\/onboarding$/);
  await spouse.goto(link);
  await spouse.locator("input[name=displayName]").fill("지영");
  await spouse.getByRole("button", { name: "가계부 참여하기" }).click();
  await expect(spouse.getByRole("main").getByRole("link", { name: "거래 입력", exact: true })).toBeVisible();

  // 민수의 다른 기기 (탈퇴 뒤에도 로그인 쿠키가 남아 있는 경우)
  const otherDevice = await (await browser.newContext()).newPage();
  await otherDevice.goto("/login");
  await login(otherDevice, ownerId);
  await expect(otherDevice.getByRole("main").getByRole("link", { name: "거래 입력", exact: true })).toBeVisible();

  // 민수 탈퇴: 안내에 가계부가 남는다고 나온다
  await page.goto("/settings/account");
  await page.getByRole("link", { name: "탈퇴하기" }).click();
  await expect(page).toHaveURL(/\/account\/delete$/);
  await expect(page.getByText("지영님이 계속 써요")).toBeVisible();
  await page.locator("input[name=password]").fill("wrong-password");
  await page.getByLabel("위 내용을 확인했고").check();
  await page.getByRole("button", { name: "탈퇴하기" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("비밀번호가 맞지 않아요.");
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.getByRole("button", { name: "탈퇴하기" }).click();
  await expect(page).toHaveURL(/\/login\?deleted=1$/);
  await expect(page.getByRole("status")).toContainText("탈퇴했어요.");
  await login(page, ownerId);
  await expect(page.locator("p[role=alert]")).toHaveText("아이디 또는 비밀번호가 맞지 않아요.");

  await otherDevice.goto("/");
  await expect(otherDevice.getByRole("heading", { name: "탈퇴한 계정이에요" })).toBeVisible();
  await otherDevice.getByRole("button", { name: "로그아웃" }).click();
  await expect(otherDevice).toHaveURL(/\/login$/);

  // 지영은 가계부를 계속 쓰고, 만든 사람을 이어받았다. 민수가 입력한 거래는 남는다.
  await spouse.goto("/settings/members");
  await expect(spouse.locator("li").filter({ hasText: "지영" })).toContainText("만든 사람");
  await expect(spouse.locator("li").filter({ hasText: "민수" })).toHaveCount(0);
  await spouse.goto("/transactions");
  await expect(spouse.getByRole("link").filter({ hasText: "식비 · 마트" })).toContainText("민수 장보기");

  // 지영도 탈퇴하면 가계부까지 지운다
  await spouse.goto("/account/delete");
  await expect(spouse.getByText("모든 데이터를 지워요")).toBeVisible();
  await spouse.locator("input[name=password]").fill(PASSWORD);
  await spouse.getByLabel("위 내용을 확인했고").check();
  await spouse.getByRole("button", { name: "탈퇴하기" }).click();
  await expect(spouse).toHaveURL(/\/login\?deleted=1$/);
  await login(spouse, spouseId);
  await expect(spouse.locator("p[role=alert]")).toHaveText("아이디 또는 비밀번호가 맞지 않아요.");
});

test("가계부를 만들기 전에도 탈퇴할 수 있다", async ({ page }) => {
  await page.goto("/signup");
  await page.locator("input[name=loginId]").fill(uid());
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.locator("input[name=passwordConfirm]").fill(PASSWORD);
  await page.getByRole("button", { name: "아이디 만들기" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("link", { name: "회원 탈퇴" }).click();
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.getByLabel("위 내용을 확인했고").check();
  await page.getByRole("button", { name: "탈퇴하기" }).click();
  await expect(page).toHaveURL(/\/login\?deleted=1$/);
});
