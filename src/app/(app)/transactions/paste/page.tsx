import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { loadFormOptions } from "../form-data";
import { PasteForm } from "./paste-form";

export default async function PastePage() {
  const m = await requireHousehold();
  const options = await withUser(m.userId, (tx) => loadFormOptions(tx, m.householdId));

  return (
    <div>
      <Link href="/transactions/new" className="text-sm text-muted">
        ← 거래 입력
      </Link>
      <h1 className="mt-2 text-xl font-bold">문자로 입력</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        카드 승인 문자나 알림을 복사해 붙여 넣으세요. 여러 건을 한 번에 넣어도 돼요. 지출방법은 카드 관리에 연결한 카드로,
        소분류는 같은 가맹점에 지난번에 고른 것으로 채워요.
      </p>
      <PasteForm groups={options.groups} paymentMethods={options.paymentMethods} />
    </div>
  );
}
