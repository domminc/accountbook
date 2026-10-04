import Link from "next/link";
import { cookies } from "next/headers";
import { ChevronRight } from "lucide-react";
import { cardClass, segmentGroupClass, segmentItemClass } from "@/components/ui";
import { DESIGN_COOKIE, DESIGN_DESC, DESIGN_LABEL, DESIGNS, THEME_COOKIE, THEME_LABEL, THEMES, parseDesign, parseTheme } from "@/lib/theme";
import { setTheme } from "./theme/actions";

const LINKS = [
  { href: "/settings/members", title: "구성원·초대", desc: "배우자 초대, 내 이름" },
  { href: "/assets", title: "자산·대출·카드·통장·결제일", desc: "순자산 기록, 대출 상환, 매달 나가는 돈" },
  { href: "/settings/sms", title: "문자 자동 입력", desc: "카드 승인 문자를 받으면 자동으로 거래 입력 (아이폰 단축어·안드로이드)" },
  { href: "/settings/categories", title: "카테고리", desc: "대분류·소분류 추가, 이름 변경, 순서, 숨김" },
  { href: "/settings/payment-methods", title: "지출방법", desc: "체크카드, 현금 등" },
  { href: "/settings/tags", title: "태그", desc: "과소비, 돌발지출 등 거래에 붙이는 표시" },
  { href: "/settings/data", title: "데이터 가져오기·내보내기", desc: "구글 시트(xlsx) 가져오기, CSV 내보내기" },
];

export default async function SettingsPage() {
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  const design = parseDesign(jar.get(DESIGN_COOKIE)?.value);
  return (
    <div>
      <h1 className="text-xl font-bold">설정</h1>
      <section aria-labelledby="theme-title" className={`mt-4 p-4 ${cardClass}`}>
        <h2 id="theme-title" className="font-medium">
          화면
        </h2>
        <p className="mt-0.5 text-sm text-muted">이 기기에만 적용돼요.</p>
        <p className="eyebrow mt-4 text-xs font-medium text-muted">디자인</p>
        <form action={setTheme} className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {DESIGNS.map((d) => (
            <button
              key={d}
              type="submit"
              name="design"
              value={d}
              aria-pressed={design === d}
              className={`tile rounded-xl px-4 py-3 text-left transition ${design === d ? "border-accent ring-2 ring-accent/30" : "hover:border-border-strong"}`}
            >
              <span className="block font-semibold">{DESIGN_LABEL[d]}</span>
              <span className="mt-0.5 block text-xs text-muted">{DESIGN_DESC[d]}</span>
            </button>
          ))}
        </form>
        <p className="eyebrow mt-4 text-xs font-medium text-muted">밝기</p>
        <form action={setTheme} className={`mt-1.5 grid-cols-3 ${segmentGroupClass}`}>
          {THEMES.map((t) => (
            <button key={t} type="submit" name="theme" value={t} aria-pressed={theme === t} className={segmentItemClass(theme === t)}>
              {THEME_LABEL[t]}
            </button>
          ))}
        </form>
      </section>
      <ul className={`mt-4 divide-y divide-border overflow-hidden ${cardClass}`}>
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center gap-3 px-4 py-4 transition hover:bg-fill">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{l.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{l.desc}</span>
              </span>
              <ChevronRight aria-hidden size={18} className="shrink-0 text-subtle" />
            </Link>
          </li>
        ))}
      </ul>
      <form action="/logout" method="post" className="mt-6">
        <button type="submit" className="text-sm text-muted underline underline-offset-4">
          로그아웃
        </button>
      </form>
    </div>
  );
}
