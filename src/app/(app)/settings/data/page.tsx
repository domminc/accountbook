import Link from "next/link";
import { cardClass, secondaryButtonClass } from "@/components/ui";
import { ImportForm } from "./import-form";

export default function DataPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="text-sm text-muted">
          ← 설정
        </Link>
        <h1 className="mt-2 text-xl font-bold">데이터 가져오기·내보내기</h1>
      </div>

      <section className={`p-4 ${cardClass}`}>
        <h2 className="font-semibold">시트 가져오기</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          디어나 가계부 시트(v8·v9)의 설정·거래·목표·예산·이벤트·예비비를 가져와요. 없는 카테고리·지출방법·태그는 새로 만들어요. 파일은
          서버에 올리지 않고 이 브라우저에서 읽어요.
        </p>
        <ImportForm />
      </section>

      <section className={`p-4 ${cardClass}`}>
        <h2 className="font-semibold">내보내기 (CSV)</h2>
        <p className="mt-1 text-sm text-muted">엑셀·구글 시트에서 열 수 있어요.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <a href="/export/transactions" className={`flex flex-1 items-center justify-center ${secondaryButtonClass}`}>
            거래 전체
          </a>
          <a href="/export/reserve" className={`flex flex-1 items-center justify-center ${secondaryButtonClass}`}>
            예비비 전체
          </a>
        </div>
      </section>
    </div>
  );
}
