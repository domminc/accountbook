import { Wallet } from "lucide-react";

/** 로그인·가입 화면 위의 앱 표시 */
export function BrandMark() {
  return (
    <span aria-hidden className="mb-5 flex size-12 items-center justify-center cta rounded-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_8px_32px_rgb(162_28_175/0.35)]">
      <Wallet size={26} strokeWidth={2.2} />
    </span>
  );
}
