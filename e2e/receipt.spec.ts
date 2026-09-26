import { crc32, deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { chip, signupAndCreateHousehold, uid } from "./helpers";

// 테스트용 PNG (40x60, 가로 줄무늬). 브라우저에서 JPEG 로 줄여 올린다
function makePng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8비트
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw.set(y % 10 < 5 ? [220, 40, 40] : [250, 250, 250], y * (width * 3 + 1) + 1 + x * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const PNG = makePng(40, 60);
const file = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

test("영수증 사진: 입력할 때 붙이기, 수정 화면에서 추가·삭제, 다른 가계부는 못 봄", async ({ page, browser }) => {
  await signupAndCreateHousehold(page, uid(), "민수");

  await page.goto("/transactions/new");
  await page.locator("input[name=amount]").fill("23000");
  await chip(page, "식비");
  await chip(page, "마트");
  await page.locator("input[name=memo]").fill("영수증 장보기");
  await page.getByLabel("영수증 사진 추가").setInputFiles(file("r1.png"));
  await expect(page.getByRole("img", { name: "고른 영수증 1" })).toBeVisible();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/transactions\?month=/);

  const row = page.getByRole("link").filter({ hasText: "영수증 장보기" });
  await expect(row).toContainText("영수증 1");
  await row.click();
  const img = page.getByRole("img", { name: "영수증 1" });
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  const src = await img.getAttribute("src");
  const res = await page.request.get(src!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/jpeg");

  // 수정 화면에서 한 장 더 → 두 장, 첫 장 삭제 → 한 장
  await page.getByLabel("영수증 사진 추가").setInputFiles(file("r2.png"));
  await expect(page.getByRole("img", { name: "영수증 2" })).toBeVisible();
  await page.getByRole("button", { name: "영수증 1 삭제" }).click();
  await expect(page.getByRole("img", { name: "영수증 2" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "영수증 1" })).toBeVisible();
  expect((await page.request.get(src!)).status()).toBe(404);

  // 다른 가계부 사람은 영수증 주소를 알아도 못 본다
  const other = await (await browser.newContext()).newPage();
  await signupAndCreateHousehold(other, uid(), "남");
  const kept = await page.getByRole("img", { name: "영수증 1" }).getAttribute("src");
  expect((await other.request.get(kept!)).status()).toBe(404);
  // 로그인하지 않으면 로그인 화면으로
  const anon = await browser.newContext();
  const r = await anon.request.get(new URL(kept!, page.url()).href, { maxRedirects: 0 });
  expect([302, 303, 307]).toContain(r.status());
});
