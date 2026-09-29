import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

// 로그인 없이 보는 안내 문서 (개인정보처리방침, 계정 삭제 안내). 스토어 심사·앱 안에서 링크로 연다.
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link href="/" aria-label="가계부 처음으로" className="inline-block">
        <BrandMark />
      </Link>
      <article className="rounded-3xl bg-surface p-6 text-[15px] leading-relaxed shadow-card sm:p-8 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-2 [&_table]:mt-3 [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-1 [&_th]:pr-3 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </article>
    </main>
  );
}
