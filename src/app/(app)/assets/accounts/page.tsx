import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { loadRecords } from "@/lib/data/finance";
import { RecordList } from "../record-list";

export default async function AccountsPage() {
  const m = await requireHousehold();
  const accounts = await withUser(m.userId, (tx) => loadRecords(tx, m.householdId, "bank_accounts"));
  const join = (parts: unknown[]) => parts.filter((p) => p !== null && p !== undefined && p !== "").join(" · ");

  return (
    <>
      <p className="text-xs text-muted">계좌번호는 끝 4자리만 저장해요.</p>
      <RecordList
        kind="bank_accounts"
        rows={accounts}
        title={(a) => (
          <>
            {String(a.bank)}
            {a.account_last4 ? <span className="ml-1.5 text-sm font-normal text-muted tabular-nums">****{String(a.account_last4)}</span> : null}
          </>
        )}
        summary={(a) => join([a.account_type, a.holder, a.purpose, a.note]) || "정보 없음"}
      />
    </>
  );
}
