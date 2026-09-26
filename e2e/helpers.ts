import { expect, type Page } from "@playwright/test";

export const PASSWORD = "test-password-1";

export const uid = () => `e2e${Date.now().toString().slice(-9)}${Math.floor(Math.random() * 10)}`;

/** 한국 시간 기준 이번 달(+offset) 'YYYY-MM' */
export function kstMonth(offset = 0) {
  const now = new Date(Date.now() + 9 * 3600_000);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function kstToday() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export async function signupAndCreateHousehold(page: Page, loginId: string, name: string) {
  await page.goto("/signup");
  await page.locator("input[name=loginId]").fill(loginId);
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.locator("input[name=passwordConfirm]").fill(PASSWORD);
  await page.getByRole("button", { name: "아이디 만들기" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.locator("input[name=displayName]").fill(name);
  await page.getByRole("button", { name: "가계부 만들기" }).click();
  await expect(page.getByRole("link", { name: "거래 입력" })).toBeVisible();
}

export async function chip(page: Page, name: string) {
  await page.getByRole("radio", { name, exact: true }).or(page.getByRole("checkbox", { name, exact: true })).first().click();
}

/** 거래 입력 화면에서 한 건 저장 */
export async function addTransaction(
  page: Page,
  t: { kind?: "지출" | "수입" | "저축"; group?: string; category: string; amount: number; date?: string; payment?: string; tags?: string[]; memo?: string },
) {
  await page.goto(`/transactions/new${t.date ? `?month=${t.date.slice(0, 7)}` : ""}`);
  if (t.kind && t.kind !== "지출") await page.getByRole("radio", { name: t.kind, exact: true }).first().click();
  if (t.date) await page.locator("input[name=occurredOn]").fill(t.date);
  await page.locator("input[name=amount]").fill(String(t.amount));
  if (t.group) await chip(page, t.group);
  await chip(page, t.category);
  if (t.payment) {
    // 마지막에 쓴 지출방법이 미리 골라져 있을 수 있다 (다시 누르면 해제되므로 확인 후 누른다)
    const pm = page.getByRole("radio", { name: t.payment, exact: true });
    if ((await pm.getAttribute("aria-checked")) !== "true") await pm.click();
  }
  for (const tag of t.tags ?? []) await chip(page, tag);
  if (t.memo) await page.locator("input[name=memo]").fill(t.memo);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/transactions\?month=/);
}
