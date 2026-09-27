// 카드 이용내역·명세서 파일을 브라우저에서 글자로 바꾼다. 원본 파일은 서버로 보내지 않는다.
// xls·xlsx·csv·html(카드사에서 받은 "엑셀" 중 상당수는 html 표) → 칸 글자, pdf → 줄 글자.
import type { StatementInput } from "./statement";

export const STATEMENT_ACCEPT = ".xlsx,.xls,.csv,.txt,.htm,.html,.pdf";
export const MAX_STATEMENT_FILE = 10 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLS = 40;
const MAX_CELL = 300;

/** PDF 에 비밀번호가 걸려 있다 (incorrect: 넣은 비밀번호가 틀림) */
export class PdfPasswordError extends Error {
  constructor(public incorrect: boolean) {
    super(incorrect ? "PDF 비밀번호가 맞지 않아요." : "비밀번호가 걸린 PDF예요. 비밀번호를 넣어 주세요.");
  }
}

export async function readStatementFile(file: File, password?: string): Promise<StatementInput> {
  if (file.size > MAX_STATEMENT_FILE) throw new Error("파일은 10MB까지 올릴 수 있어요.");
  const buf = new Uint8Array(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const base = { fileName: file.name.slice(0, 200) };
  if (ext === "pdf" || startsWith(buf, "%PDF")) return { ...base, lines: await pdfLines(buf, password) };
  return { ...base, rows: await sheetRows(buf, ext) };
}

function startsWith(buf: Uint8Array, s: string) {
  return s.split("").every((ch, i) => buf[i] === ch.charCodeAt(0));
}

/** UTF-8 이 아니면 EUC-KR (국내 카드사 csv·html 은 대부분 EUC-KR) */
function decodeText(buf: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("euc-kr").decode(buf);
  }
}

function looksLikeText(buf: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(buf.slice(0, 512)).replace(/^﻿|^ï»¿/, "").trimStart().toLowerCase();
  return head.startsWith("<");
}

async function sheetRows(buf: Uint8Array, ext: string): Promise<string[][]> {
  const XLSX = await import("xlsx");
  let wb;
  if (ext === "csv" || ext === "txt") {
    // 글자 그대로 (날짜·카드번호를 숫자로 바꾸지 않게)
    wb = XLSX.read(decodeText(buf), { type: "string", raw: true });
  } else if (ext === "htm" || ext === "html" || looksLikeText(buf)) {
    wb = XLSX.read(decodeText(buf), { type: "string", cellDates: true });
  } else {
    wb = XLSX.read(buf, { type: "array", cellDates: true });
  }
  const rows: string[][] = [];
  for (const name of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: "", blankrows: false });
    for (const r of data) {
      if (rows.length >= MAX_ROWS) return rows;
      rows.push(r.slice(0, MAX_COLS).map(cellText));
    }
  }
  return rows;
}

const pad = (n: number) => String(n).padStart(2, "0");

function cellText(v: unknown): string {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    const time = v.getHours() || v.getMinutes() ? `${pad(v.getHours())}:${pad(v.getMinutes())}` : "";
    // 시각만 있는 칸은 1899-12-30 날짜로 온다
    if (v.getFullYear() < 1901) return time;
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}${time ? ` ${time}` : ""}`;
  }
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim().slice(0, MAX_CELL);
}

type TextItem = { str: string; transform: number[]; width: number; height: number };

/** PDF 글자를 줄로: 같은 높이(y)에 있는 글자를 왼쪽부터 잇는다 */
async function pdfLines(buf: Uint8Array, password?: string): Promise<string[]> {
  const { getDocumentProxy } = await import("unpdf");
  let doc;
  try {
    doc = await getDocumentProxy(buf, password ? { password } : {});
  } catch (e) {
    if (e && typeof e === "object" && "name" in e && e.name === "PasswordException") {
      throw new PdfPasswordError(!!password && "code" in e && e.code === 2);
    }
    throw new Error("PDF를 읽지 못했어요. 파일이 손상됐거나 스캔한 이미지일 수 있어요.");
  }
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages && lines.length < MAX_ROWS; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as unknown[]).filter((i): i is TextItem => !!i && typeof i === "object" && "str" in i && "transform" in i);
    const rows: { y: number; items: TextItem[] }[] = [];
    for (const it of items) {
      if (!it.str.trim()) continue;
      const y = it.transform[5];
      const tol = Math.max(2, (it.height || 10) * 0.4);
      const row = rows.find((r) => Math.abs(r.y - y) <= tol);
      if (row) row.items.push(it);
      else rows.push({ y, items: [it] });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.transform[4] - b.transform[4]);
      let line = "";
      let prevEnd = -Infinity;
      for (const it of r.items) {
        const x = it.transform[4];
        const gap = x - prevEnd;
        line += line && gap > Math.max(1, (it.height || 10) * 0.25) ? ` ${it.str}` : it.str;
        prevEnd = x + it.width;
      }
      lines.push(line.replace(/\s+/g, " ").trim().slice(0, 1000));
    }
  }
  await doc.cleanup();
  return lines;
}
