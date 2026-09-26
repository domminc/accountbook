import type { Tx } from "@/lib/db";
import { RECEIPT_MAX_BYTES, RECEIPTS_PER_TRANSACTION, detectImageType, type ReceiptType } from "@/lib/receipt";

export type ReceiptFile = { type: ReceiptType; data: Buffer };

/** 폼의 "receipt" 파일들을 읽어 검사한다. 빈 파일 칸은 건너뛴다. */
export async function readReceiptFiles(formData: FormData): Promise<{ files: ReceiptFile[] } | { error: string }> {
  const files: ReceiptFile[] = [];
  for (const v of formData.getAll("receipt")) {
    if (typeof v === "string" || v.size === 0) continue;
    if (v.size > RECEIPT_MAX_BYTES) return { error: "영수증 사진이 너무 커요. (1.5MB 이하)" };
    const data = Buffer.from(await v.arrayBuffer());
    const type = detectImageType(data);
    if (!type) return { error: "영수증은 사진(JPEG·PNG·WebP)만 올릴 수 있어요." };
    files.push({ type, data });
  }
  if (files.length > RECEIPTS_PER_TRANSACTION) return { error: `영수증은 거래 하나에 ${RECEIPTS_PER_TRANSACTION}장까지예요.` };
  return { files };
}

/** 거래에 영수증을 붙인다. 장수를 넘으면 false */
export async function insertReceipts(
  tx: Tx,
  householdId: string,
  userId: string,
  transactionId: string,
  files: ReceiptFile[],
): Promise<boolean> {
  if (files.length === 0) return true;
  const [{ n }] = await tx<{ n: number }[]>`
    select count(*)::int as n from public.transaction_receipts where transaction_id = ${transactionId}
  `;
  if (n + files.length > RECEIPTS_PER_TRANSACTION) return false;
  for (const f of files) {
    await tx`
      insert into public.transaction_receipts (household_id, transaction_id, content_type, data, created_by)
      values (${householdId}, ${transactionId}, ${f.type}, ${f.data}, ${userId})
    `;
  }
  return true;
}

export async function listReceiptIds(tx: Tx, householdId: string, transactionId: string): Promise<string[]> {
  const rows = await tx<{ id: string }[]>`
    select id from public.transaction_receipts
    where household_id = ${householdId} and transaction_id = ${transactionId} order by created_at
  `;
  return rows.map((r) => r.id);
}
