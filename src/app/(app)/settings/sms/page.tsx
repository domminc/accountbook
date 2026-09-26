import Link from "next/link";
import { withUser } from "@/lib/db";
import { requireHousehold } from "@/lib/household";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { cardClass } from "@/components/ui";
import { revokeInboundToken } from "./actions";
import { TokenForm } from "./token-form";

const dateTime = (d: Date) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);

export default async function SmsSettingsPage() {
  const m = await requireHousehold();
  const tokens = await withUser(
    m.userId,
    (tx) => tx<{ id: string; name: string; created_at: Date; last_used_at: Date | null; owner: string | null }[]>`
      select t.id, t.name, t.created_at, t.last_used_at, mem.display_name as owner
      from public.inbound_tokens t
      left join public.members mem on mem.user_id = t.user_id and mem.household_id = t.household_id
      where t.household_id = ${m.householdId} order by t.created_at
    `,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="text-sm text-muted">
          ← 설정
        </Link>
        <h1 className="mt-2 text-xl font-bold">문자 자동 입력</h1>
        <p className="mt-1 text-sm text-muted">
          휴대폰이 카드 승인 문자를 받으면 자동으로 가계부에 보내요. 같은 가맹점에 전에 입력한 적이 있으면 그때의 소분류·태그로 바로
          저장하고, 처음 보는 가맹점이나 취소·중복 의심 문자는 <Link href="/transactions/paste" className="underline underline-offset-4">카드 문자로 입력</Link>
          에 모아 두었다가 확인하게 해요. 지출방법은 카드 관리에서 연결한 카드로 정해요.
        </p>
      </div>

      <section className={`p-4 ${cardClass}`}>
        <h2 className="font-semibold">등록한 기기</h2>
        {tokens.length === 0 ? (
          <p className="mt-2 text-sm text-muted">아직 없어요.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 text-sm">
                  {t.name}
                  <span className="block text-xs text-muted">
                    {t.owner ?? "?"} · 만든 날 {dateTime(t.created_at)} · {t.last_used_at ? `마지막 사용 ${dateTime(t.last_used_at)}` : "아직 안 씀"}
                  </span>
                </span>
                <ActionForm action={revokeInboundToken.bind(null, t.id)}>
                  <SubmitButton className="px-2 text-sm text-danger" confirmMessage="이 기기의 자동 입력을 끊을까요?" aria-label={`${t.name} 토큰 삭제`}>
                    삭제
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <TokenForm />
        </div>
      </section>

      <section className={`p-4 text-sm ${cardClass}`}>
        <h2 className="font-semibold">아이폰 (단축어 앱)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>단축어 앱 → 자동화 → 새로운 자동화 → <b>메시지</b></li>
          <li>메시지 포함: <b>승인</b> (필요하면 발신자로 카드사 번호 선택) → <b>즉시 실행</b></li>
          <li>
            동작 추가 → <b>URL의 콘텐츠 가져오기</b>: URL에 위 주소, 방법 <b>POST</b>, 헤더에 <code>Authorization</code> = 위 값, 본문
            <b> JSON</b>에 키 <code>text</code> = <b>단축어 입력</b>(메시지 내용)
          </li>
          <li>(선택) 동작 추가 → <b>알림 보기</b>: 앞 단계의 결과 — 무엇이 저장됐는지 알려줘요</li>
        </ol>
      </section>

      <section className={`p-4 text-sm ${cardClass}`}>
        <h2 className="font-semibold">안드로이드 (MacroDroid 등 자동화 앱)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            트리거: <b>SMS 수신</b> (내용에 &lsquo;승인&rsquo; 포함). 카드사 앱 푸시만 오면 <b>알림 수신</b> 트리거
          </li>
          <li>
            동작: <b>HTTP 요청</b> — POST, 위 주소, 헤더 <code>Authorization</code> = 위 값, 본문 <code>text/plain</code>에 문자 내용
            변수(예: <code>[sms_message]</code>, <code>[notification]</code>)
          </li>
        </ol>
        <p className="mt-2 text-xs text-muted">같은 문자가 두 번 와도 한 번만 처리해요. 토큰이 새어 나갔다면 위에서 지우고 새로 만드세요.</p>
      </section>
    </div>
  );
}
