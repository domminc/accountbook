import { requireHousehold } from "@/lib/household";
import { BottomNav, MainArea } from "@/components/bottom-nav";
import { OfflineSync } from "@/components/offline-sync";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // 로그인 + 가계부가 있어야 들어올 수 있다
  const m = await requireHousehold();
  return (
    <div className="flex min-h-full flex-1 flex-col lg:pl-56">
      <MainArea>
        <OfflineSync userId={m.userId} />
        {children}
      </MainArea>
      <BottomNav householdName={m.householdName} />
    </div>
  );
}
