import { requireHousehold } from "@/lib/household";
import { BottomNav } from "@/components/bottom-nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // 로그인 + 가계부가 있어야 들어올 수 있다
  await requireHousehold();
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-5 pb-28">{children}</main>
      <BottomNav />
    </>
  );
}
