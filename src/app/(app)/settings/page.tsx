import Link from "next/link";
import { cardClass } from "@/components/ui";

const LINKS = [
  { href: "/settings/members", title: "구성원·초대", desc: "배우자 초대, 내 이름" },
  { href: "/settings/account", title: "계정·보안", desc: "Face ID·지문 로그인, 비밀번호 바꾸기, 회원 탈퇴" },
  { href: "/assets", title: "자산·대출·카드·통장·결제일", desc: "순자산 기록, 대출 상환, 매달 나가는 돈" },
  { href: "/settings/sms", title: "문자 자동 입력", desc: "카드 승인 문자를 받으면 자동으로 거래 입력 (아이폰 단축어·안드로이드)" },
  { href: "/settings/categories", title: "카테고리", desc: "대분류·소분류 추가, 이름 변경, 순서, 숨김" },
  { href: "/settings/payment-methods", title: "지출방법", desc: "체크카드, 현금 등" },
  { href: "/settings/tags", title: "태그", desc: "과소비, 돌발지출 등 거래에 붙이는 표시" },
  { href: "/settings/data", title: "데이터 가져오기·내보내기", desc: "구글 시트(xlsx) 가져오기, CSV 내보내기" },
];

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-xl font-bold">설정</h1>
      <ul className={`mt-4 divide-y divide-border ${cardClass}`}>
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="block px-4 py-4">
              <span className="font-medium">{l.title}</span>
              <span className="mt-0.5 block text-sm text-muted">{l.desc}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center gap-4 text-sm text-muted">
        <form action="/logout" method="post">
          <button type="submit" className="underline underline-offset-4">
            로그아웃
          </button>
        </form>
        <Link href="/privacy" className="underline underline-offset-4">
          개인정보처리방침
        </Link>
      </div>
    </div>
  );
}
