import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { findDuplicateGroups } from "@/lib/data/duplicates";
import { DuplicateList } from "./duplicate-list";

export default async function DuplicatesPage() {
  const m = await requireHousehold();
  const groups = await withUser(m.userId, (tx) => findDuplicateGroups(tx, m.householdId));

  return (
    <div>
      <Link href="/settings/data" className="text-sm text-muted">
        ← 데이터 가져오기·내보내기
      </Link>
      <h1 className="mt-2 text-xl font-bold">중복 거래 정리</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        같은 달에 소분류·금액·내용이 같은 거래를 모았어요. 어디서 들어왔는지 보고 지울 것을 고르세요. 고정지출은 먼저 넣은 한 건만 남기고
        나머지를 골라 두었어요. 다른 거래는 실제로 두 번 쓴 것일 수 있어 직접 골라 주세요.
      </p>
      <DuplicateList groups={groups} />
    </div>
  );
}
