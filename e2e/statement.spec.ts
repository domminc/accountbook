import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { addTransaction, kstMonth, signupAndCreateHousehold, uid } from "./helpers";

/** 문자열 → EUC-KR(CP949) 바이트. 국내 카드사 csv 가 이 인코딩이다 (Node 에는 인코더가 없어 디코더로 표를 만든다) */
function eucKr(text: string): Buffer {
  const table = new Map<string, number[]>();
  const dec = new TextDecoder("euc-kr");
  for (let a = 0x81; a <= 0xfe; a++)
    for (let b = 0x41; b <= 0xfe; b++) {
      const ch = dec.decode(Uint8Array.of(a, b));
      if (ch.length === 1 && ch !== "\ufffd" && !table.has(ch)) table.set(ch, [a, b]);
    }
  return Buffer.from([...text].flatMap((ch) => (ch.charCodeAt(0) < 0x80 ? [ch.charCodeAt(0)] : (table.get(ch) ?? [0x3f]))));
}

/** 글자만 있는 한 쪽짜리 PDF. 한 줄의 칸을 따로 그려서 같은 높이 글자를 잇는지도 본다 */
function simplePdf(lines: string[][]): Buffer {
  const esc = (s: string) => s.replace(/[()\\]/g, "\\$&");
  const content = lines
    .flatMap((cells, i) => cells.map((c, j) => `BT /F1 10 Tf ${40 + j * 150} ${800 - i * 16} Td (${esc(c)}) Tj ET`))
    .join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

test("카드 이용내역 파일(xls·csv·pdf)로 거래 채우기", async ({ page }) => {
  await signupAndCreateHousehold(page, uid(), "민수");
  const month = kstMonth(0);
  const d = (day: string) => `${month.replace("-", ".")}.${day}`;
  // 스타벅스는 지난번에 카페·현금으로 입력
  await addTransaction(page, { group: "식비", category: "카페", amount: 5_000, payment: "현금", memo: "스타벅스", date: `${month}-01` });

  // ── 진짜 엑셀 97 (xls) 파일, 제목 줄·합계·결제 후 취소 짝 ──
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["신한카드 이용내역"],
      ["이용일자", "이용카드", "이용가맹점", "이용금액", "이용구분"],
      [d("02"), "본인 1234", "스타벅스", "4,500", "일시불"],
      [d("02"), "본인 1234", "김밥천국", "9,000", "일시불"],
      [d("03"), "본인 1234", "이마트 성수점", "45,000", "3개월"],
      [d("04"), "본인 1234", "김밥천국", "-9,000", "일시불"],
      ["합계", "", "", "49,500", ""],
    ]),
    "이용내역",
  );
  const xls = XLSX.write(wb, { bookType: "biff8", type: "buffer" }) as Buffer;

  await page.goto("/transactions/paste");
  await expect(page.getByRole("heading", { name: "카드 문자·파일로 입력" })).toBeVisible();
  const fileInput = page.getByLabel("카드 이용내역·명세서 파일");
  await fileInput.setInputFiles({ name: "이용내역.xls", mimeType: "application/vnd.ms-excel", buffer: xls });
  await expect(page.getByRole("heading", { name: "찾은 거래 2건" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("파일에서 거래 2건을 찾았어요. 결제 후 취소된 1건은 뺐어요.");
  await expect(page.getByLabel("1번째 내용")).toHaveValue("스타벅스");
  await expect(page.getByLabel("1번째 금액")).toHaveValue("4,500");
  await expect(page.getByLabel("1번째 소분류").locator("option:checked")).toHaveText("카페");
  await expect(page.getByLabel("1번째 지출방법").locator("option:checked")).toHaveText("현금");
  await expect(page.getByLabel("2번째 내용")).toHaveValue("이마트 성수점");
  await expect(page.getByText("3개월")).toBeVisible();

  // 소분류가 빈 거래에 한꺼번에
  await page.getByLabel("소분류가 빈 1건에 한꺼번에").selectOption({ label: "마트" });
  await page.getByRole("button", { name: "적용" }).click();
  await expect(page.getByLabel("2번째 소분류").locator("option:checked")).toHaveText("마트");
  await page.getByRole("button", { name: "2건 저장" }).click();
  await expect(page).toHaveURL(new RegExp(`/transactions\\?month=${month}`));
  await expect(page.getByRole("link").filter({ hasText: "식비 · 마트" })).toContainText("이마트 성수점");

  // ── EUC-KR csv: 이미 넣은 거래는 중복으로 빼 둔다 ──
  const csv = ["승인일자,가맹점명,승인금액(원),취소여부", `${month}-03,이마트 성수점,45000,N`, `${month}-05,배달의민족,23000,N`].join("\r\n");
  await page.goto("/transactions/paste");
  await fileInput.setInputFiles({ name: "samsung.csv", mimeType: "text/csv", buffer: eucKr(csv) });
  await expect(page.getByRole("heading", { name: "찾은 거래 2건" })).toBeVisible();
  await expect(page.getByText("같은 날 같은 금액 거래가 이미 있어요 (이마트 성수점)")).toBeVisible();
  await expect(page.getByLabel("1번째 거래 저장")).not.toBeChecked();
  await expect(page.getByLabel("2번째 내용")).toHaveValue("배달의민족");
  await expect(page.getByLabel("2번째 거래 저장")).toBeChecked();

  // ── 카드사 "엑셀" 중 많은 것은 확장자만 xls 인 EUC-KR html 표 ──
  const html = `<html><head><meta http-equiv="Content-Type" content="text/html; charset=euc-kr"></head><body><table>
    <tr><td>현대카드 이용내역</td></tr>
    <tr><th>이용일</th><th>가맹점명</th><th>이용금액</th></tr>
    <tr><td>${d("07")}</td><td>다이소 강남점</td><td>6,000</td></tr></table></body></html>`;
  await page.goto("/transactions/paste");
  await fileInput.setInputFiles({ name: "hyundai.xls", mimeType: "application/vnd.ms-excel", buffer: eucKr(html) });
  await expect(page.getByRole("heading", { name: "찾은 거래 1건" })).toBeVisible();
  await expect(page.getByLabel("1번째 내용")).toHaveValue("다이소 강남점");
  await expect(page.getByLabel("1번째 금액")).toHaveValue("6,000");

  // ── PDF 명세서 ──
  const pdf = simplePdf([
    ["KB Card Statement"],
    [d("06"), "1234 NETFLIX", "17,000"],
    ["Total", "", "17,000"],
  ]);
  await page.goto("/transactions/paste");
  await fileInput.setInputFiles({ name: "statement.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByRole("heading", { name: "찾은 거래 1건" })).toBeVisible();
  await expect(page.getByLabel("1번째 내용")).toHaveValue("NETFLIX");
  await expect(page.getByLabel("1번째 금액")).toHaveValue("17,000");

  // 거래가 없는 파일
  await fileInput.setInputFiles({ name: "empty.csv", mimeType: "text/csv", buffer: Buffer.from("메모\n안녕") });
  await expect(page.locator("p[role=alert]")).toContainText("파일에서 거래(날짜·금액)를 찾지 못했어요.");
});
