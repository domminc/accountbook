import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "계정 삭제 안내 · 가계부" };

// Google Play 의 "계정 삭제 URL": 앱을 설치하지 않은 사람도 삭제 방법과 지워지는 데이터를 볼 수 있어야 한다
export default function AccountDeletionPage() {
  return (
    <>
      <h1>계정 삭제 안내</h1>
      <p>{LEGAL.serviceName} 계정과 데이터를 지우는 방법입니다. 웹과 안드로이드 앱 모두 같습니다.</p>

      <h2>앱이나 웹에서 직접 지우기</h2>
      <ol>
        <li>
          <Link href="/login" className="underline underline-offset-4">
            {LEGAL.siteUrl.replace("https://", "")}
          </Link>{" "}
          또는 앱에서 로그인합니다.
        </li>
        <li>
          <b>설정 &gt; 계정·보안 &gt; 회원 탈퇴</b>로 갑니다.
        </li>
        <li>비밀번호를 입력하고 안내를 확인한 뒤 <b>탈퇴하기</b>를 누릅니다. 바로 지워집니다.</li>
      </ol>
      <p>
        로그인한 상태라면{" "}
        <Link href="/account/delete" className="underline underline-offset-4">
          회원 탈퇴 화면
        </Link>
        으로 바로 갈 수 있습니다.
      </p>

      <h2>로그인할 수 없는 경우</h2>
      <p>
        {LEGAL.contactEmail}로 아이디와 함께 삭제를 요청하면 본인 확인 후 7일 안에 지우고 결과를 알려 드립니다.
      </p>

      <h2>지워지는 데이터</h2>
      <ul>
        <li>아이디, 비밀번호, Face ID·지문 로그인 등록, 문자 자동 입력 토큰</li>
        <li>
          혼자 쓰던 가계부: 가계부와 그 안의 거래·예산·목표·예비비·자산·대출·카드·통장·결제일·영수증 사진·받은 카드 문자 등 모든 데이터
        </li>
      </ul>

      <h2>남는 데이터</h2>
      <ul>
        <li>
          가계부를 다른 구성원과 함께 쓰던 경우, 가계부 데이터는 남은 구성원이 계속 씁니다. 내가 입력한 거래도 남고 입력자 표시만 사라집니다. 가계부
          전체를 지우려면 모든 구성원이 탈퇴하면 됩니다.
        </li>
        <li>호스팅 업체의 접속 기록과 데이터베이스 백업에 남은 사본은 각 업체의 보관 기간이 지나면 자동으로 지워집니다.</li>
      </ul>
      <p>
        탈퇴 전에 설정 &gt; 데이터 가져오기·내보내기에서 거래를 CSV로 내려받아 둘 수 있습니다. 자세한 내용은{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          개인정보처리방침
        </Link>
        을 보세요.
      </p>
    </>
  );
}
