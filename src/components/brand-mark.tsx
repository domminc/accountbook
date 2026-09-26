import { Wallet } from "lucide-react";

/** 로그인·가입 화면 위의 앱 표시 */
export function BrandMark() {
  return (
    <span aria-hidden className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-sm">
      <Wallet size={26} strokeWidth={2.2} />
    </span>
  );
}
