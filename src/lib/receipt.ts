// 영수증 사진 검사 (서버). 브라우저가 줄여 보내지만, 형식은 파일 앞 바이트로 다시 확인한다.

export const RECEIPT_MAX_BYTES = 1_572_864; // 1.5MB (DB 제약과 같음)
export const RECEIPTS_PER_TRANSACTION = 5;

export type ReceiptType = "image/jpeg" | "image/png" | "image/webp";

export function detectImageType(b: Uint8Array): ReceiptType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  return null;
}

function ascii(b: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...b.slice(start, end));
}
